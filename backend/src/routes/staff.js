const express = require('express');
const router = express.Router();
const prisma = require('../config/db');
const authMiddleware = require('../middleware/auth');

// Helper to compute pending salary months for a staff member (with full partial payment support)
function calculateStaffPending(staff, payments = []) {
  if (staff.status !== 'Active') {
    return {
      pendingMonthsCount: 0,
      pendingMonths: [],
      totalPendingSalary: 0,
      isCurrentMonthPaid: true,
      nextDueMonth: null,
      pendingMonthsNames: '',
      hasPartialPayment: false,
    };
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12

  const joinDate = staff.joiningDate ? new Date(staff.joiningDate) : new Date(currentYear, 0, 1);
  let startYear = joinDate.getFullYear();
  let startMonth = joinDate.getMonth() + 1;

  if (startYear < currentYear - 1) {
    startYear = currentYear - 1;
    startMonth = 1;
  }

  // Calculate sum of payments made per month-year
  const paidMap = new Map(); // key: "YYYY-M" -> total paid number
  payments.forEach(p => {
    const key = `${p.year}-${p.month}`;
    paidMap.set(key, (paidMap.get(key) || 0) + (p.amount || 0));
  });

  const pendingMonths = [];
  let y = startYear;
  let m = startMonth;
  let hasPartialPayment = false;
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  while (y < currentYear || (y === currentYear && m <= currentMonth)) {
    const key = `${y}-${m}`;
    const paidForMonth = paidMap.get(key) || 0;
    const monthlySalary = staff.salary || 0;
    const remainingDue = Math.max(0, monthlySalary - paidForMonth);

    if (remainingDue > 0) {
      const isPartial = paidForMonth > 0;
      if (isPartial) hasPartialPayment = true;

      pendingMonths.push({
        month: m,
        year: y,
        label: isPartial
          ? `${monthNames[m - 1]} ${y} (₹${paidForMonth} paid, ₹${remainingDue} due)`
          : `${monthNames[m - 1]} ${y}`,
        shortLabel: `${monthNames[m - 1]} ${y}`,
        paidAmount: paidForMonth,
        remainingDue,
        isPartial,
        totalSalary: monthlySalary,
      });
    }

    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }

  const totalPendingSalary = pendingMonths.reduce((sum, item) => sum + item.remainingDue, 0);
  const currentKey = `${currentYear}-${currentMonth}`;
  const currentPaid = paidMap.get(currentKey) || 0;
  const isCurrentMonthPaid = currentPaid >= (staff.salary || 0);
  const nextDueMonth = pendingMonths.length > 0 ? pendingMonths[0] : null;
  const pendingMonthsNames = pendingMonths.map(p => p.shortLabel).join(', ');

  return {
    pendingMonthsCount: pendingMonths.length,
    pendingMonths,
    pendingMonthsNames,
    totalPendingSalary,
    isCurrentMonthPaid,
    nextDueMonth,
    hasPartialPayment,
  };
}

// Get all Staff members with optional search, status filter, and pending salary calculations
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { search, category, status } = req.query;

    const where = {};
    if (search && search.trim() !== '') {
      const q = search.trim();
      where.OR = [
        { name: { contains: q } },
        { phone: { contains: q } },
        { description: { contains: q } },
      ];
    }

    if (category && category !== 'All') {
      where.category = category;
    }

    if (status && status !== 'All') {
      where.status = status;
    }

    const staff = await prisma.staff.findMany({
      where,
      include: {
        payments: {
          orderBy: { paymentDate: 'desc' }
        }
      },
      orderBy: { name: 'asc' }
    });

    const staffWithPending = staff.map(s => {
      const pendingInfo = calculateStaffPending(s, s.payments);
      return {
        ...s,
        ...pendingInfo,
      };
    });

    const totalSalaryCommitment = staff
      .filter(s => s.status === 'Active')
      .reduce((acc, curr) => acc + curr.salary, 0);

    const totalPendingSalaries = staffWithPending.reduce((acc, s) => acc + (s.totalPendingSalary || 0), 0);

    res.json({
      success: true,
      staff: staffWithPending,
      totalCount: staffWithPending.length,
      totalSalaryCommitment,
      totalPendingSalaries,
    });
  } catch (error) {
    console.error('Fetch staff error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Single Staff member with payment history
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const staff = await prisma.staff.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        payments: {
          orderBy: [{ year: 'desc' }, { month: 'desc' }]
        }
      }
    });
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff member not found' });
    }
    const pendingInfo = calculateStaffPending(staff, staff.payments);
    res.json({ success: true, staff: { ...staff, ...pendingInfo } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create Staff
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, phone, salary, category, joiningDate, status = 'Active', description } = req.body;

    if (!name || salary === undefined || !category) {
      return res.status(400).json({
        success: false,
        message: 'Name, Salary, and Category are required.'
      });
    }

    const newStaff = await prisma.staff.create({
      data: {
        name,
        phone: phone ? String(phone).trim() : '',
        salary: parseFloat(salary),
        category,
        joiningDate: joiningDate ? new Date(joiningDate) : new Date(),
        status,
        description: description || '',
      }
    });

    res.status(201).json({
      success: true,
      message: 'Staff member added successfully',
      staff: newStaff,
    });
  } catch (error) {
    console.error('Create staff error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update Staff
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { name, phone, salary, category, joiningDate, status, description } = req.body;

    const updated = await prisma.staff.update({
      where: { id: parseInt(req.params.id) },
      data: {
        name,
        phone: phone !== undefined ? String(phone).trim() : undefined,
        ...(salary !== undefined ? { salary: parseFloat(salary) } : {}),
        category,
        ...(joiningDate ? { joiningDate: new Date(joiningDate) } : {}),
        ...(status !== undefined ? { status } : {}),
        description,
      }
    });

    res.json({
      success: true,
      message: 'Staff member updated successfully',
      staff: updated,
    });
  } catch (error) {
    console.error('Update staff error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete Staff
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const staffId = parseInt(req.params.id);
    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
      include: { payments: true }
    });

    if (staff) {
      const paymentIds = (staff.payments || []).map(p => p.id);
      // Delete any synced expense records
      await prisma.expense.deleteMany({
        where: {
          OR: [
            { staffId: staffId },
            ...(paymentIds.length > 0 ? [{ staffPaymentId: { in: paymentIds } }] : []),
            { paidTo: staff.name, category: 'Staff Salary' }
          ]
        }
      });

      await prisma.staff.delete({
        where: { id: staffId }
      });
    }

    res.json({ success: true, message: 'Staff member and associated expense records deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Salary Payout (Supports Full Payout, Part-by-Part Partial Payments, & Installments)
router.post('/:id/payout', authMiddleware, async (req, res) => {
  try {
    const staffId = parseInt(req.params.id);
    const { amount, paymentMode = 'Cash in Hand', month, year, notes, paymentDate } = req.body;

    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
      include: { payments: true }
    });
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff member not found' });
    }

    const payMonth = parseInt(month) || (new Date().getMonth() + 1);
    const payYear = parseInt(year) || new Date().getFullYear();

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthLabel = monthNames[payMonth - 1];

    // Calculate how much has already been paid for this specific month/year
    const alreadyPaid = staff.payments
      .filter(p => p.month === payMonth && p.year === payYear)
      .reduce((sum, p) => sum + p.amount, 0);

    const remainingDueBefore = Math.max(0, staff.salary - alreadyPaid);

    if (alreadyPaid >= staff.salary) {
      return res.status(400).json({
        success: false,
        message: `Salary for ${monthLabel} ${payYear} (₹${staff.salary}) has already been fully disbursed to ${staff.name}.`
      });
    }

    const payAmount = amount !== undefined && amount !== null && amount !== ''
      ? parseFloat(amount)
      : remainingDueBefore;

    if (isNaN(payAmount) || payAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Payment amount must be greater than 0.'
      });
    }

    const remainingDueAfter = Math.max(0, remainingDueBefore - payAmount);
    const isPartial = remainingDueAfter > 0;
    const isPartiallyCovered = alreadyPaid > 0;

    const receiptNo = `SAL-${payYear}${String(payMonth).padStart(2, '0')}-${String(staffId).padStart(3, '0')}-${Date.now().toString().slice(-4)}`;
    const effectiveDate = paymentDate ? new Date(paymentDate) : new Date();

    // 1. Build informative notes for StaffPayment
    let paymentRemarks = notes || '';
    if (!paymentRemarks) {
      if (isPartial) {
        paymentRemarks = `Partial salary payout (₹${payAmount}). Remaining balance due: ₹${remainingDueAfter}.`;
      } else if (isPartiallyCovered) {
        paymentRemarks = `Salary installment (₹${payAmount}) completing full salary for ${monthLabel} ${payYear}.`;
      } else {
        paymentRemarks = `Full salary disbursement for ${monthLabel} ${payYear}.`;
      }
    }

    const staffPayment = await prisma.staffPayment.create({
      data: {
        staffId,
        month: payMonth,
        year: payYear,
        amount: payAmount,
        paymentMode,
        receiptNo,
        notes: paymentRemarks,
        paymentDate: effectiveDate,
      }
    });

    // 2. Automatically log in Expense with link
    const purpose = isPartial
      ? `Staff Salary (Partial Payout) - ${staff.name} (${staff.category}) for ${monthLabel} ${payYear}`
      : `Staff Salary - ${staff.name} (${staff.category}) for ${monthLabel} ${payYear}`;

    let expenseDesc = `Salary disbursement. Phone: ${staff.phone || 'N/A'}. Receipt: ${receiptNo}.`;
    if (isPartial) {
      expenseDesc += ` [Partial Payment: ₹${payAmount} of ₹${staff.salary}. Remaining due: ₹${remainingDueAfter}]`;
    }
    if (notes) expenseDesc += ` Remarks: ${notes}`;

    const expense = await prisma.expense.create({
      data: {
        purpose,
        paidTo: staff.name,
        category: 'Staff Salary',
        amount: payAmount,
        paymentMode,
        description: expenseDesc,
        staffPaymentId: staffPayment.id,
        staffId: staff.id,
        date: effectiveDate,
      }
    });

    res.status(201).json({
      success: true,
      message: isPartial
        ? `Partial salary payment of ₹${payAmount} recorded for ${staff.name} (${monthLabel} ${payYear})! Remaining due: ₹${remainingDueAfter}.`
        : `Salary payment of ₹${payAmount} for ${staff.name} (${monthLabel} ${payYear}) recorded in Expenses and Staff History!`,
      payment: staffPayment,
      expense,
      remainingDue: remainingDueAfter,
      isPartial,
    });
  } catch (error) {
    console.error('Staff payout error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Revert / Delete Staff Salary Payout
router.delete('/:id/payments/:paymentId', authMiddleware, async (req, res) => {
  try {
    const staffId = parseInt(req.params.id);
    const paymentId = parseInt(req.params.paymentId);

    const payment = await prisma.staffPayment.findFirst({
      where: { id: paymentId, staffId }
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Salary payment record not found' });
    }

    // Delete linked expense
    await prisma.expense.deleteMany({
      where: {
        OR: [
          { staffPaymentId: paymentId },
          ...(payment.receiptNo ? [{ description: { contains: payment.receiptNo } }] : [])
        ]
      }
    });

    // Delete staff payment
    await prisma.staffPayment.delete({
      where: { id: paymentId }
    });

    res.json({
      success: true,
      message: 'Salary payment reverted and corresponding Expense record removed successfully.'
    });
  } catch (error) {
    console.error('Revert staff payment error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
