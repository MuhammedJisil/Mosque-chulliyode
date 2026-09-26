const express = require('express');
const router = express.Router();
const fs = require('fs');
const prisma = require('../config/db');
const authMiddleware = require('../middleware/auth');
const upload = require('../middleware/upload');
const { isConfigured, uploadToCloudinary } = require('../utils/cloudinary');

// Get all Income records with filters
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { search, category, paymentMode, month, year, startDate, endDate, sort = 'newest' } = req.query;

    const where = {};

    if (search && search.trim() !== '') {
      const q = search.trim();
      where.OR = [
        { donorName: { contains: q } },
        { donorPhone: { contains: q } },
        { donorAddress: { contains: q } },
        { description: { contains: q } },
      ];
    }

    if (category && category !== 'All') {
      where.category = category;
    }

    if (paymentMode && paymentMode !== 'All') {
      where.paymentMode = paymentMode;
    }

    // Date range filters
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) {
        const e = new Date(endDate);
        e.setHours(23, 59, 59, 999);
        where.date.lte = e;
      }
    } else if (month && year) {
      const m = parseInt(month);
      const y = parseInt(year);
      where.date = {
        gte: new Date(y, m - 1, 1),
        lte: new Date(y, m, 0, 23, 59, 59, 999),
      };
    } else if (year) {
      const y = parseInt(year);
      where.date = {
        gte: new Date(y, 0, 1),
        lte: new Date(y, 11, 31, 23, 59, 59, 999),
      };
    }

    const orderBy = {
      date: sort === 'oldest' ? 'asc' : 'desc'
    };

    const incomes = await prisma.income.findMany({
      where,
      orderBy,
    });

    const totalSum = incomes.reduce((acc, curr) => acc + curr.amount, 0);

    res.json({
      success: true,
      incomes: incomes.map(item => ({
        ...item,
        customFields: item.customFields ? JSON.parse(item.customFields) : []
      })),
      totalCount: incomes.length,
      totalSum,
    });
  } catch (error) {
    console.error('Fetch incomes error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Single Income details
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const income = await prisma.income.findUnique({
      where: { id: parseInt(req.params.id) }
    });
    if (!income) {
      return res.status(404).json({ success: false, message: 'Income record not found' });
    }
    res.json({
      success: true,
      income: {
        ...income,
        customFields: income.customFields ? JSON.parse(income.customFields) : []
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create Income record
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      donorName,
      donorPhone,
      donorAddress,
      category,
      amount,
      paymentMode,
      description,
      customFields,
      proofImage,
      date
    } = req.body;

    if (!donorName || !category || amount === undefined || !paymentMode) {
      return res.status(400).json({
        success: false,
        message: 'Donor name, Category, Amount, and Payment Mode are required.'
      });
    }

    let finalProofImage = proofImage || null;
    if (proofImage && typeof proofImage === 'string' && proofImage.startsWith('data:image/') && isConfigured()) {
      try {
        const uploaded = await uploadToCloudinary(proofImage, 'mosque_income_proofs');
        if (uploaded?.url) {
          finalProofImage = uploaded.url;
        }
      } catch (uploadErr) {
        console.warn('Cloudinary upload warning (fallback to base64):', uploadErr.message);
      }
    }

    const newIncome = await prisma.income.create({
      data: {
        donorName,
        donorPhone: donorPhone || '',
        donorAddress: donorAddress || '',
        category,
        amount: parseFloat(amount),
        paymentMode,
        description: description || '',
        customFields: customFields ? JSON.stringify(customFields) : null,
        proofImage: finalProofImage,
        date: date ? new Date(date) : new Date(),
      }
    });

    res.status(201).json({
      success: true,
      message: 'Income record added successfully',
      income: {
        ...newIncome,
        customFields: newIncome.customFields ? JSON.parse(newIncome.customFields) : []
      }
    });
  } catch (error) {
    console.error('Create income error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update Income record
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const {
      donorName,
      donorPhone,
      donorAddress,
      category,
      amount,
      paymentMode,
      description,
      customFields,
      proofImage,
      date
    } = req.body;

    let finalProofImage = proofImage;
    if (proofImage && typeof proofImage === 'string' && proofImage.startsWith('data:image/') && isConfigured()) {
      try {
        const uploaded = await uploadToCloudinary(proofImage, 'mosque_income_proofs');
        if (uploaded?.url) {
          finalProofImage = uploaded.url;
        }
      } catch (uploadErr) {
        console.warn('Cloudinary upload warning (fallback to base64):', uploadErr.message);
      }
    }

    const updated = await prisma.income.update({
      where: { id: parseInt(req.params.id) },
      data: {
        donorName,
        donorPhone,
        donorAddress,
        category,
        amount: amount !== undefined ? parseFloat(amount) : undefined,
        paymentMode,
        description,
        customFields: customFields !== undefined ? JSON.stringify(customFields) : undefined,
        ...(finalProofImage !== undefined ? { proofImage: finalProofImage } : {}),
        ...(date ? { date: new Date(date) } : {}),
      }
    });

    res.json({
      success: true,
      message: 'Income record updated successfully',
      income: {
        ...updated,
        customFields: updated.customFields ? JSON.parse(updated.customFields) : []
      }
    });
  } catch (error) {
    console.error('Update income error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete Income record
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await prisma.income.delete({
      where: { id: parseInt(req.params.id) }
    });
    res.json({ success: true, message: 'Income record deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Upload proof file (multipart or Cloudinary)
router.post('/upload-proof', authMiddleware, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  if (isConfigured()) {
    try {
      const result = await uploadToCloudinary(req.file.path, 'mosque_income_proofs');
      // Clean up local temp file after upload
      fs.unlink(req.file.path, () => {});
      if (result?.url) {
        return res.json({ success: true, fileUrl: result.url });
      }
    } catch (uploadErr) {
      console.warn('Cloudinary upload error, using local fallback:', uploadErr.message);
    }
  }

  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ success: true, fileUrl });
});

module.exports = router;
