const express = require('express');
const router = express.Router();
const prisma = require('../config/db');
const authMiddleware = require('../middleware/auth');

// GET /api/food-duties - List schedules with filters + spotlight summary (today/tomorrow)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { startDate, endDate, division, status, search } = req.query;

    const where = {};

    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.date = { gte: start, lte: end };
    } else if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      where.date = { gte: start };
    }

    if (status && status !== 'All') {
      where.status = status;
    }

    if (division && division !== 'All') {
      where.OR = [
        { division: { contains: division } },
        { member: { division: { contains: division } } }
      ];
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { customName: { contains: q } },
        { phone: { contains: q } },
        { division: { contains: q } },
        { member: { name: { contains: q } } },
        { member: { phone: { contains: q } } },
        { member: { division: { contains: q } } },
        { member: { idNumber: { contains: q } } },
      ];
    }

    const duties = await prisma.foodDuty.findMany({
      where,
      include: {
        member: {
          select: {
            id: true,
            name: true,
            phone: true,
            division: true,
            idNumber: true,
            address: true,
          }
        }
      },
      orderBy: { date: 'asc' }
    });

    // Compute Today and Tomorrow for Quick Spotlight Cards
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const tomorrowEnd = new Date(todayEnd);
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

    const todayDuties = await prisma.foodDuty.findMany({
      where: {
        date: { gte: todayStart, lte: todayEnd }
      },
      include: {
        member: {
          select: { id: true, name: true, phone: true, division: true, idNumber: true, address: true }
        }
      }
    });

    const tomorrowDuties = await prisma.foodDuty.findMany({
      where: {
        date: { gte: tomorrowStart, lte: tomorrowEnd }
      },
      include: {
        member: {
          select: { id: true, name: true, phone: true, division: true, idNumber: true, address: true }
        }
      }
    });

    res.json({
      success: true,
      duties,
      todayDuties,
      tomorrowDuties,
      totalCount: duties.length,
    });
  } catch (error) {
    console.error('Fetch food duties error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/food-duties - Create single duty OR bulk schedule rotation
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      memberId,
      customName,
      phone,
      division,
      date,
      mealType = 'All Day',
      status = 'Pending',
      notes,
      bulkAssignments, // Optional: array of { memberId, customName, phone, division, date, mealType }
    } = req.body;

    if (Array.isArray(bulkAssignments) && bulkAssignments.length > 0) {
      // Bulk creation
      const createdList = [];
      for (const item of bulkAssignments) {
        if (!item.date) continue;
        const entry = await prisma.foodDuty.create({
          data: {
            memberId: item.memberId ? parseInt(item.memberId) : null,
            customName: item.customName || null,
            phone: item.phone ? String(item.phone).trim() : null,
            division: item.division || null,
            date: new Date(item.date),
            mealType: item.mealType || 'All Day',
            status: item.status || 'Pending',
            notes: item.notes || null,
          }
        });
        createdList.push(entry);
      }
      return res.status(201).json({
        success: true,
        message: `Successfully scheduled ${createdList.length} food duties`,
        count: createdList.length,
      });
    }

    // Single creation
    if (!date) {
      return res.status(400).json({ success: false, message: 'Duty date is required.' });
    }

    let dutyPhone = phone;
    let dutyDivision = division;
    let dutyName = customName;

    if (memberId) {
      const member = await prisma.member.findUnique({ where: { id: parseInt(memberId) } });
      if (member) {
        if (!dutyPhone) dutyPhone = member.phone;
        if (!dutyDivision) dutyDivision = member.division;
        if (!dutyName) dutyName = member.name;
      }
    }

    const newDuty = await prisma.foodDuty.create({
      data: {
        memberId: memberId ? parseInt(memberId) : null,
        customName: dutyName || null,
        phone: dutyPhone ? String(dutyPhone).trim() : null,
        division: dutyDivision || null,
        date: new Date(date),
        mealType: mealType || 'All Day',
        status: status || 'Pending',
        notes: notes || null,
      },
      include: {
        member: true,
      }
    });

    res.status(201).json({
      success: true,
      message: 'Food duty scheduled successfully',
      duty: newDuty,
    });
  } catch (error) {
    console.error('Create food duty error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/food-duties/swap - Swap dates between two duty entries
router.post('/swap', authMiddleware, async (req, res) => {
  try {
    const { dutyId1, dutyId2 } = req.body;
    if (!dutyId1 || !dutyId2) {
      return res.status(400).json({ success: false, message: 'Both duty IDs are required to swap' });
    }

    const duty1 = await prisma.foodDuty.findUnique({ where: { id: parseInt(dutyId1) }, include: { member: true } });
    const duty2 = await prisma.foodDuty.findUnique({ where: { id: parseInt(dutyId2) }, include: { member: true } });

    if (!duty1 || !duty2) {
      return res.status(404).json({ success: false, message: 'One or both duty entries not found' });
    }

    const tempDate = duty1.date;
    await prisma.$transaction([
      prisma.foodDuty.update({
        where: { id: duty1.id },
        data: {
          date: duty2.date,
          status: 'Swapped',
          notes: duty1.notes ? `${duty1.notes} (Swapped with #${duty2.id})` : `Swapped with #${duty2.id}`
        }
      }),
      prisma.foodDuty.update({
        where: { id: duty2.id },
        data: {
          date: tempDate,
          status: 'Swapped',
          notes: duty2.notes ? `${duty2.notes} (Swapped with #${duty1.id})` : `Swapped with #${duty1.id}`
        }
      })
    ]);

    res.json({
      success: true,
      message: `Successfully swapped dates between ${duty1.member?.name || duty1.customName || 'House 1'} and ${duty2.member?.name || duty2.customName || 'House 2'}!`,
    });
  } catch (error) {
    console.error('Swap duties error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/food-duties/:id - Update duty entry
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const {
      memberId,
      customName,
      phone,
      division,
      date,
      mealType,
      status,
      notes,
    } = req.body;

    const data = {};
    if (memberId !== undefined) data.memberId = memberId ? parseInt(memberId) : null;
    if (customName !== undefined) data.customName = customName;
    if (phone !== undefined) data.phone = phone ? String(phone).trim() : null;
    if (division !== undefined) data.division = division;
    if (date !== undefined) data.date = new Date(date);
    if (mealType !== undefined) data.mealType = mealType;
    if (status !== undefined) data.status = status;
    if (notes !== undefined) data.notes = notes;

    const updated = await prisma.foodDuty.update({
      where: { id },
      data,
      include: { member: true },
    });

    res.json({
      success: true,
      message: 'Food duty updated successfully',
      duty: updated,
    });
  } catch (error) {
    console.error('Update food duty error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/food-duties/:id - Delete duty entry
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.foodDuty.delete({ where: { id } });
    res.json({ success: true, message: 'Food duty deleted successfully' });
  } catch (error) {
    console.error('Delete food duty error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
