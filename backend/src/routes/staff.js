const express = require('express');
const router = express.Router();
const prisma = require('../config/db');
const authMiddleware = require('../middleware/auth');

// Helper to compute pending salary months for a staff member
function calculateStaffPending(staff, payments = []) {
  if (staff.status !== 'Active') {
    return {
      pendingMonthsCount: 0,
      pendingMonths: [],
      totalPendingSalary: 0,
      isCurrentMonthPaid: true,
      nextDueMonth: null,
      pendingMonthsNames: ''
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

  const paidSet = new Set(payments.map(p => `${p.year}-${p.month}`));
  const pendingMonths = [];
  let y = startYear;
  let m = startMonth;

  while (y < currentYear || (y === currentYear && m <= currentMonth)) {
    const key = `${y}-${m}`;
    if (!paidSet.has(key)) {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      pendingMonths.push({
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

  const totalPendingSalary = pendingMonths.length * (staff.salary || 0);
  const isCurrentMonthPaid = paidSet.has(`${currentYear}-${currentMonth}`);
  const nextDueMonth = pendingMonths.length > 0 ? pendingMonths[0] : null;
  const pendingMonthsNames = pendingMonths.map(p => p.label).join(', ');

  return {
    pendingMonthsCount: pendingMonths.length,
    pendingMonths,
    pendingMonthsNames,
    totalPendingSalary,
    isCurrentMonthPaid,
    nextDueMonth,
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

    if (!name || !phone || salary === undefined || !category) {
      return res.status(400).json({
        success: false,
        message: 'Name, Phone, Salary, and Category are required.'
      });
    }

    const newStaff = await prisma.staff.create({
      data: {
        name,
        phone,
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
        phone,
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
    await prisma.staff.delete({
      where: { id: parseInt(req.params.id) }
    });
    res.json({ success: true, message: 'Staff member deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Quick Payout: Logs an Expense record for Staff Salary AND records a StaffPayment entry
router.post('/:id/payout', authMiddleware, async (req, res) => {
  try {
    const staffId = parseInt(req.params.id);
    const { amount, paymentMode = 'Cash in Hand', month, year, notes } = req.body;

    const staff = await prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff member not found' });
    }

    const payMonth = parseInt(month) || (new Date().getMonth() + 1);
    const payYear = parseInt(year) || new Date().getFullYear();

    // Check if salary for this month/year has already been recorded
    const existingPayment = await prisma.staffPayment.findFirst({
      where: {
        staffId,
        month: payMonth,
        year: payYear,
      }
    });

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthLabel = monthNames[payMonth - 1];

    if (existingPayment) {
      return res.status(400).json({
        success: false,
        message: `Salary for ${monthLabel} ${payYear} has already been disbursed to ${staff.name} on ${new Date(existingPayment.paymentDate).toLocaleDateString('en-GB')}.`
      });
    }

    const payAmount = amount ? parseFloat(amount) : staff.salary;
    const receiptNo = `SAL-${payYear}${String(payMonth).padStart(2, '0')}-${String(staffId).padStart(3, '0')}-${Date.now().toString().slice(-4)}`;

    // 1. Record Staff Payment
    const staffPayment = await prisma.staffPayment.create({
      data: {
        staffId,
        month: payMonth,
        year: payYear,
        amount: payAmount,
        paymentMode,
        receiptNo,
        notes: notes || '',
        paymentDate: new Date(),
      }
    });

    // 2. Automatically log in Expense
    const purpose = `Staff Salary - ${staff.name} (${staff.category}) for ${monthLabel} ${payYear}`;
    let expenseDesc = `Monthly salary disbursement. Phone: ${staff.phone}. Receipt: ${receiptNo}.`;
    if (notes) expenseDesc += ` Remarks: ${notes}`;

    const expense = await prisma.expense.create({
      data: {
        purpose,
        paidTo: staff.name,
        category: 'Staff Salary',
        amount: payAmount,
        paymentMode,
        description: expenseDesc,
        date: new Date(),
      }
    });

    res.status(201).json({
      success: true,
      message: `Salary payout of ₹${payAmount} for ${staff.name} (${monthLabel} ${payYear}) recorded in Expenses and Staff History!`,
      payment: staffPayment,
      expense,
    });
  } catch (error) {
    console.error('Staff payout error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
