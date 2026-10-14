const express = require('express');
const router = express.Router();
const prisma = require('../config/db');
const authMiddleware = require('../middleware/auth');

const DEFAULT_INCOME_CATEGORIES = [
  'Member Monthly Payment',
  'Donation',
  'Donation Box Collection',
  'Ramadan Collection',
  'Jumma Collection',
  'Zakat',
  'Fitra',
  'Sadaqah',
  'General Rent',
  'Event & Programs',
  'Fundraising',
  'Friday Collection',
  'Rental Property',
  'Ramadan Box',
  'Hall Booking',
  'Construction Fund',
  'Nikah Registration',
  'Other',
];

const DEFAULT_EXPENSE_CATEGORIES = [
  'Electricity Bill',
  'Water Bill',
  'Maintenance & Repairs',
  'Cleaning Supplies',
  'Events & Programs',
  'Construction',
  'Staff Salary',
  'Staff Payroll Payouts',
  'Water & Sanitation',
  'Sound System',
  'Masjid Renovation',
  'Security & Surveillance',
  'Stationery & Printing',
  'Miscellaneous',
  'Other',
];

// Get categories by type (auto-seeds defaults into database on first startup)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { type } = req.query; // INCOME or EXPENSE
    const where = type ? { type } : {};

    const initialized = await prisma.setting.findUnique({
      where: { key: 'CATEGORIES_INITIALIZED' }
    });

    if (!initialized) {
      for (const name of DEFAULT_INCOME_CATEGORIES) {
        await prisma.customCategory.upsert({
          where: { type_name: { type: 'INCOME', name } },
          update: {},
          create: { type: 'INCOME', name }
        }).catch(() => {});
      }
      for (const name of DEFAULT_EXPENSE_CATEGORIES) {
        await prisma.customCategory.upsert({
          where: { type_name: { type: 'EXPENSE', name } },
          update: {},
          create: { type: 'EXPENSE', name }
        }).catch(() => {});
      }
      await prisma.setting.upsert({
        where: { key: 'CATEGORIES_INITIALIZED' },
        update: { value: 'true' },
        create: { key: 'CATEGORIES_INITIALIZED', value: 'true' }
      }).catch(() => {});
    }

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

// Update category name
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Category name is required.' });
    }

    const trimmedName = name.trim();
    const existing = await prisma.customCategory.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const oldName = existing.name;
    const updated = await prisma.customCategory.update({
      where: { id },
      data: { name: trimmedName }
    });

    // Also update existing records that were categorized under the old category name
    if (existing.type === 'INCOME') {
      await prisma.income.updateMany({
        where: { category: oldName },
        data: { category: trimmedName }
      });
    } else if (existing.type === 'EXPENSE') {
      await prisma.expense.updateMany({
        where: { category: oldName },
        data: { category: trimmedName }
      });
    }

    res.json({ success: true, category: updated, message: 'Category updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete category
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.customCategory.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    await prisma.customCategory.delete({ where: { id } });
    res.json({ success: true, message: 'Category removed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

