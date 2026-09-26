const express = require('express');
const router = express.Router();
const fs = require('fs');
const prisma = require('../config/db');
const authMiddleware = require('../middleware/auth');
const upload = require('../middleware/upload');
const { isConfigured, uploadToCloudinary } = require('../utils/cloudinary');

// Get all Expense records with filters
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { search, category, paymentMode, month, year, startDate, endDate, sort = 'newest' } = req.query;

    const where = {};

    if (search && search.trim() !== '') {
      const q = search.trim();
      where.OR = [
        { purpose: { contains: q } },
        { paidTo: { contains: q } },
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

    const expenses = await prisma.expense.findMany({
      where,
      orderBy,
    });

    const totalSum = expenses.reduce((acc, curr) => acc + curr.amount, 0);

    res.json({
      success: true,
      expenses: expenses.map(item => ({
        ...item,
        customFields: item.customFields ? JSON.parse(item.customFields) : []
      })),
      totalCount: expenses.length,
      totalSum,
    });
  } catch (error) {
    console.error('Fetch expenses error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Single Expense details
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const expense = await prisma.expense.findUnique({
      where: { id: parseInt(req.params.id) }
    });
    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense record not found' });
    }
    res.json({
      success: true,
      expense: {
        ...expense,
        customFields: expense.customFields ? JSON.parse(expense.customFields) : []
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create Expense record
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      purpose,
      paidTo,
      category,
      amount,
      paymentMode,
      description,
      customFields,
      proofImage,
      date
    } = req.body;

    if (!purpose || !paidTo || !category || amount === undefined || !paymentMode) {
      return res.status(400).json({
        success: false,
        message: 'Expense Purpose, Paid To, Category, Amount, and Payment Mode are required.'
      });
    }

    let finalProofImage = proofImage || null;
    if (proofImage && typeof proofImage === 'string' && proofImage.startsWith('data:image/') && isConfigured()) {
      try {
        const uploaded = await uploadToCloudinary(proofImage, 'mosque_expense_proofs');
        if (uploaded?.url) {
          finalProofImage = uploaded.url;
        }
      } catch (uploadErr) {
        console.warn('Cloudinary upload warning (fallback to base64):', uploadErr.message);
      }
    }

    const newExpense = await prisma.expense.create({
      data: {
        purpose,
        paidTo,
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
      message: 'Expense record added successfully',
      expense: {
        ...newExpense,
        customFields: newExpense.customFields ? JSON.parse(newExpense.customFields) : []
      }
    });
  } catch (error) {
    console.error('Create expense error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update Expense record
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const {
      purpose,
      paidTo,
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
        const uploaded = await uploadToCloudinary(proofImage, 'mosque_expense_proofs');
        if (uploaded?.url) {
          finalProofImage = uploaded.url;
        }
      } catch (uploadErr) {
        console.warn('Cloudinary upload warning (fallback to base64):', uploadErr.message);
      }
    }

    const updated = await prisma.expense.update({
      where: { id: parseInt(req.params.id) },
      data: {
        purpose,
        paidTo,
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
      message: 'Expense record updated successfully',
      expense: {
        ...updated,
        customFields: updated.customFields ? JSON.parse(updated.customFields) : []
      }
    });
  } catch (error) {
    console.error('Update expense error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete Expense record
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await prisma.expense.delete({
      where: { id: parseInt(req.params.id) }
    });
    res.json({ success: true, message: 'Expense record deleted successfully' });
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
      const result = await uploadToCloudinary(req.file.path, 'mosque_expense_proofs');
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
