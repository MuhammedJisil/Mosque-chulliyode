const express = require('express');
const router = express.Router();
const prisma = require('../config/db');
const authMiddleware = require('../middleware/auth');

// Get all settings (including opening balance)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const settings = await prisma.setting.findMany();
    const config = {};
    settings.forEach(s => {
      config[s.key] = s.value;
    });

    res.json({
      success: true,
      settings: config,
      openingBalance: parseFloat(config['opening_balance'] || '0'),
      openingBalanceDate: config['opening_balance_date'] || null,
      openingBalanceNotes: config['opening_balance_notes'] || '',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update Opening Balance
router.post('/opening-balance', authMiddleware, async (req, res) => {
  try {
    const { amount, date, notes } = req.body;
    if (amount === undefined || isNaN(amount)) {
      return res.status(400).json({ success: false, message: 'Valid opening balance amount is required' });
    }

    const val = parseFloat(amount).toString();
    const dateVal = date || new Date().toISOString().split('T')[0];
    const notesVal = notes || '';

    // Upsert opening_balance
    await prisma.setting.upsert({
      where: { key: 'opening_balance' },
      update: { value: val },
      create: { key: 'opening_balance', value: val }
    });

    await prisma.setting.upsert({
      where: { key: 'opening_balance_date' },
      update: { value: dateVal },
      create: { key: 'opening_balance_date', value: dateVal }
    });

    await prisma.setting.upsert({
      where: { key: 'opening_balance_notes' },
      update: { value: notesVal },
      create: { key: 'opening_balance_notes', value: notesVal }
    });

    res.json({
      success: true,
      message: 'Opening balance updated successfully',
      openingBalance: parseFloat(val),
      openingBalanceDate: dateVal,
      openingBalanceNotes: notesVal,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
