const express = require('express');
const router = express.Router();
const prisma = require('../config/db');
const authMiddleware = require('../middleware/auth');

// Helper to compute due months and total due amount for a member
function calculateMemberDue(member, payments) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1 to 12

  // Determine starting month/year based on joiningDate
  const joinDate = member.joiningDate ? new Date(member.joiningDate) : new Date(currentYear, 0, 1);
  let startYear = joinDate.getFullYear();
  let startMonth = joinDate.getMonth() + 1;

  // For sane bounds, do not look back more than 2 years if joined long ago
  if (startYear < currentYear - 1) {
    startYear = currentYear - 1;
    startMonth = 1;
  }

  // Create set of paid (year-month) keys
  const paidSet = new Set(payments.map(p => `${p.year}-${p.month}`));

  const dueMonths = [];
  let y = startYear;
  let m = startMonth;

  while (y < currentYear || (y === currentYear && m <= currentMonth)) {
    const key = `${y}-${m}`;
    if (!paidSet.has(key)) {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      dueMonths.push({
        month: m,
        year: y,
        label: `${monthNames[m - 1]} ${y}`,
      });
    }
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }

  const monthlyTotal = (member.monthlyDonation || 0) + (member.hasMadrasa ? (member.madrasaMonthlyFee || 0) : 0);
  const monthsDueAmount = dueMonths.length * monthlyTotal;

  // Calculate Member Opening Balance (Past Arrears from manual records)
  const totalOpeningBalance = Number(member.openingBalance || 0);
  const paidOpeningBalance = payments.reduce((sum, p) => sum + Number(p.openingBalanceAmount || 0), 0);
  const netOpeningBalanceDue = Math.max(0, totalOpeningBalance - paidOpeningBalance);

  const totalDueAmount = monthsDueAmount + netOpeningBalanceDue;

  // Is current month paid?
  const isCurrentMonthPaid = paidSet.has(`${currentYear}-${currentMonth}`);
  const nextDueMonth = dueMonths.length > 0 ? dueMonths[0] : null;
  const dueMonthsNames = dueMonths.map(d => d.label).join(', ');

  return {
    dueMonthsCount: dueMonths.length,
    dueMonths,
    dueMonthsNames,
    nextDueMonth,
    monthlyTotal,
    openingBalance: totalOpeningBalance,
    paidOpeningBalance,
    netOpeningBalanceDue,
    monthsDueAmount,
    totalDueAmount,
    isCurrentMonthPaid,
  };
}

// Get all Members with search, status filter, and due calculations
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { search, status } = req.query;

    const where = {};
    if (search && search.trim() !== '') {
      const q = search.trim();
      where.OR = [
        { name: { contains: q } },
        { phone: { contains: q } },
        { address: { contains: q } },
      ];
    }

    if (status && status !== 'All') {
      where.status = status;
    }

    const members = await prisma.member.findMany({
      where,
      include: {
        payments: {
          orderBy: { paymentDate: 'desc' }
        }
      },
      orderBy: { name: 'asc' }
    });

    const membersWithDue = members.map(m => {
      const dueInfo = calculateMemberDue(m, m.payments);
      return {
        ...m,
        ...dueInfo,
      };
    });

    res.json({
      success: true,
      members: membersWithDue,
      totalCount: membersWithDue.length,
    });
  } catch (error) {
    console.error('Fetch members error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Single member with complete payment history
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const member = await prisma.member.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        payments: {
          orderBy: [{ year: 'desc' }, { month: 'desc' }]
        }
      }
    });

    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    const dueInfo = calculateMemberDue(member, member.payments);

    res.json({
      success: true,
      member: {
        ...member,
        ...dueInfo,
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create Member
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      name,
      address,
      phone,
      joiningDate,
      monthlyDonation = 100,
      openingBalance = 0,
      status = 'Active',
      hasMadrasa = false,
      madrasaChildrenCount = 0,
      madrasaMonthlyFee = 0,
      notes
    } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ success: false, message: 'Name and Phone number are required.' });
    }

    const newMember = await prisma.member.create({
      data: {
        name,
        address: address || '',
        phone,
        joiningDate: joiningDate ? new Date(joiningDate) : new Date(),
        monthlyDonation: parseFloat(monthlyDonation) || 100,
        openingBalance: parseFloat(openingBalance) || 0,
        status: status || 'Active',
        hasMadrasa: Boolean(hasMadrasa),
        madrasaChildrenCount: parseInt(madrasaChildrenCount) || 0,
        madrasaMonthlyFee: parseFloat(madrasaMonthlyFee) || 0,
        notes: notes || '',
      }
    });

    res.status(201).json({
      success: true,
      message: 'Member registered successfully',
      member: newMember,
    });
  } catch (error) {
    console.error('Create member error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update Member
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const {
      name,
      address,
      phone,
      joiningDate,
      monthlyDonation,
      openingBalance,
      status,
      hasMadrasa,
      madrasaChildrenCount,
      madrasaMonthlyFee,
      notes
    } = req.body;

    const updated = await prisma.member.update({
      where: { id: parseInt(req.params.id) },
      data: {
        name,
        address,
        phone,
        ...(joiningDate ? { joiningDate: new Date(joiningDate) } : {}),
        ...(monthlyDonation !== undefined ? { monthlyDonation: parseFloat(monthlyDonation) } : {}),
        ...(openingBalance !== undefined ? { openingBalance: parseFloat(openingBalance) } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(hasMadrasa !== undefined ? { hasMadrasa: Boolean(hasMadrasa) } : {}),
        ...(madrasaChildrenCount !== undefined ? { madrasaChildrenCount: parseInt(madrasaChildrenCount) } : {}),
        ...(madrasaMonthlyFee !== undefined ? { madrasaMonthlyFee: parseFloat(madrasaMonthlyFee) } : {}),
        notes,
      }
    });

    res.json({
      success: true,
      message: 'Member updated successfully',
      member: updated,
    });
  } catch (error) {
    console.error('Update member error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete Member
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await prisma.member.delete({
      where: { id: parseInt(req.params.id) }
    });
    res.json({ success: true, message: 'Member deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Record a Member Payment
router.post('/:id/payments', authMiddleware, async (req, res) => {
  try {
    const memberId = parseInt(req.params.id);
    const {
      month = 0,
      year = new Date().getFullYear(),
      membershipAmount = 0,
      madrasaAmount = 0,
      openingBalanceAmount = 0,
      paymentMode = 'Cash in Hand',
      notes
    } = req.body;

    const member = await prisma.member.findUnique({ where: { id: memberId } });
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    const mNum = parseInt(month) || 0;
    const yNum = parseInt(year) || new Date().getFullYear();

    // Check if payment for this month and year has already been recorded (for monthly subscriptions)
    if (mNum > 0 && parseFloat(membershipAmount) > 0) {
      const existingPayment = await prisma.memberPayment.findFirst({
        where: {
          memberId,
          month: mNum,
          year: yNum,
        }
      });

      if (existingPayment) {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const mName = monthNames[mNum - 1];
        return res.status(400).json({
          success: false,
          message: `${member.name} has already paid for ${mName} ${yNum} on ${new Date(existingPayment.paymentDate).toLocaleDateString('en-GB')}. Please select an unpaid pending month or pay towards opening balance.`
        });
      }
    }

    const parsedMembership = parseFloat(membershipAmount) || 0;
    const parsedMadrasa = parseFloat(madrasaAmount) || 0;
    const parsedOpeningBal = parseFloat(openingBalanceAmount) || 0;
    const totalAmount = parsedMembership + parsedMadrasa + parsedOpeningBal;

    if (totalAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Payment total amount must be greater than zero.' });
    }

    const receiptNo = `RCP-${yNum}${String(mNum).padStart(2, '0')}-${String(memberId).padStart(3, '0')}-${Date.now().toString().slice(-4)}`;

    // Create payment record
    const payment = await prisma.memberPayment.create({
      data: {
        memberId,
        month: mNum,
        year: yNum,
        membershipAmount: parsedMembership,
        madrasaAmount: parsedMadrasa,
        openingBalanceAmount: parsedOpeningBal,
        totalAmount,
        paymentMode,
        receiptNo,
        notes: notes || '',
      }
    });

    // Automatically sync as an Income entry
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthStr = mNum > 0 ? monthNames[mNum - 1] : '';

    let incomeDesc = '';
    if (mNum > 0 && parsedMembership > 0) {
      incomeDesc += `Monthly subscription for ${monthStr} ${yNum}.`;
    }
    if (parsedMadrasa > 0) {
      incomeDesc += ` (Includes Madrasa Fee: ₹${parsedMadrasa})`;
    }
    if (parsedOpeningBal > 0) {
      incomeDesc += ` (Past Arrears / Opening Balance Paid: ₹${parsedOpeningBal})`;
    }
    if (!incomeDesc) {
      incomeDesc = `Payment towards past opening balance/arrears`;
    }
    if (notes) incomeDesc += ` Note: ${notes}`;

    await prisma.income.create({
      data: {
        donorName: member.name,
        donorPhone: member.phone || '',
        donorAddress: member.address || '',
        category: 'Donation',
        amount: totalAmount,
        paymentMode: paymentMode,
        description: incomeDesc,
        date: new Date(),
      }
    });

    res.status(201).json({
      success: true,
      message: 'Payment recorded and synced to Income successfully',
      payment,
    });
  } catch (error) {
    console.error('Record member payment error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
