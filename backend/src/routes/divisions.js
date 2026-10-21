const express = require('express');
const router = express.Router();
const prisma = require('../config/db');
const authMiddleware = require('../middleware/auth');

const DEFAULT_DIVISIONS = [
  'General / Area',
  'Chulliyode',
  'Town',
  'Kozhikode Road',
  'Ward 1',
  'Ward 2',
  'Ward 3',
];

// Get divisions (auto-seeds defaults and any existing member divisions on first run)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const initialized = await prisma.setting.findUnique({
      where: { key: 'DIVISIONS_INITIALIZED' }
    });

    if (!initialized) {
      // Harvest any existing member divisions from DB
      const existingMembers = await prisma.member.findMany({
        where: { division: { not: null } },
        select: { division: true },
        distinct: ['division']
      });

      const toSeed = new Set(DEFAULT_DIVISIONS);
      existingMembers.forEach(m => {
        if (m.division && m.division.trim()) {
          toSeed.add(m.division.trim());
        }
      });

      for (const name of toSeed) {
        await prisma.customCategory.upsert({
          where: { type_name: { type: 'DIVISION', name } },
          update: {},
          create: { type: 'DIVISION', name }
        }).catch(() => {});
      }

      await prisma.setting.upsert({
        where: { key: 'DIVISIONS_INITIALIZED' },
        update: { value: 'true' },
        create: { key: 'DIVISIONS_INITIALIZED', value: 'true' }
      }).catch(() => {});
    }

    const divisions = await prisma.customCategory.findMany({
      where: { type: 'DIVISION' },
      orderBy: { name: 'asc' }
    });
    res.json({ success: true, divisions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Add new division
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Division name is required.' });
    }

    const trimmedName = name.trim();
    const existing = await prisma.customCategory.findFirst({
      where: { type: 'DIVISION', name: trimmedName }
    });

    if (existing) {
      return res.json({ success: true, division: existing, message: 'Division already exists' });
    }

    const division = await prisma.customCategory.create({
      data: {
        type: 'DIVISION',
        name: trimmedName,
      }
    });

    res.status(201).json({ success: true, division, message: 'Division created successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update division name
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Division name is required.' });
    }

    const trimmedName = name.trim();
    const existing = await prisma.customCategory.findUnique({ where: { id } });
    if (!existing || existing.type !== 'DIVISION') {
      return res.status(404).json({ success: false, message: 'Division not found' });
    }

    const oldName = existing.name;
    const updated = await prisma.customCategory.update({
      where: { id },
      data: { name: trimmedName }
    });

    // Propagate change to Members, Madrasa Students, Food Duties
    await prisma.member.updateMany({
      where: { division: oldName },
      data: { division: trimmedName }
    });

    await prisma.madrasaStudent.updateMany({
      where: { division: oldName },
      data: { division: trimmedName }
    });

    await prisma.foodDuty.updateMany({
      where: { division: oldName },
      data: { division: trimmedName }
    });

    res.json({ success: true, division: updated, message: 'Division updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete division
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.customCategory.findUnique({ where: { id } });
    if (!existing || existing.type !== 'DIVISION') {
      return res.status(404).json({ success: false, message: 'Division not found' });
    }

    await prisma.customCategory.delete({ where: { id } });
    res.json({ success: true, message: 'Division removed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
