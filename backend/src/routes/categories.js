const express = require('express');
const router = express.Router();
const prisma = require('../config/db');
const authMiddleware = require('../middleware/auth');

// Get categories by type
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { type } = req.query; // INCOME or EXPENSE
    const where = type ? { type } : {};
    const categories = await prisma.customCategory.findMany({
      where,
      orderBy: { name: 'asc' }
    });
    res.json({ success: true, categories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Add new custom category
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { type, name } = req.body;
    if (!type || !name) {
      return res.status(400).json({ success: false, message: 'Type (INCOME or EXPENSE) and name are required.' });
    }

    const trimmedName = name.trim();
    const existing = await prisma.customCategory.findFirst({
      where: { type, name: trimmedName }
    });

    if (existing) {
      return res.json({ success: true, category: existing, message: 'Category already exists' });
    }

    const category = await prisma.customCategory.create({
      data: {
        type,
        name: trimmedName,
      }
    });

    res.status(201).json({ success: true, category, message: 'Category created successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
