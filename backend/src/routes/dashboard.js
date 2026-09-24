const express = require('express');
const router = express.Router();
const prisma = require('../config/db');
const authMiddleware = require('../middleware/auth');

router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentYear = now.getFullYear();

    // 1. Total Income and Total Expense (All time)
    const incomeAggregate = await prisma.income.aggregate({
      _sum: { amount: true },
      _count: { id: true }
    });
    const totalIncome = incomeAggregate._sum.amount || 0;

    const expenseAggregate = await prisma.expense.aggregate({
      _sum: { amount: true },
      _count: { id: true }
    });
    const totalExpense = expenseAggregate._sum.amount || 0;

    // Net Treasury Balance = Total Income - Total Expense
    const netBalance = totalIncome - totalExpense;

    // 2. Members stats
    const totalActiveMembers = await prisma.member.count({
      where: { status: 'Active' }
    });

    // Members who paid for the current month and year
    const currentMonthPayments = await prisma.memberPayment.findMany({
      where: {
        month: currentMonth,
        year: currentYear,
      },
      select: { memberId: true }
    });
    const paidMemberIds = new Set(currentMonthPayments.map(p => p.memberId));
    const paidMembersCount = paidMemberIds.size;
    const dueMembersCount = Math.max(0, totalActiveMembers - paidMembersCount);

    // 3. This Month Income & Expense
    const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
    const endOfMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);

    const thisMonthIncomeAgg = await prisma.income.aggregate({
      where: { date: { gte: startOfMonth, lte: endOfMonth } },
      _sum: { amount: true }
    });
    const thisMonthIncome = thisMonthIncomeAgg._sum.amount || 0;

    const thisMonthExpenseAgg = await prisma.expense.aggregate({
      where: { date: { gte: startOfMonth, lte: endOfMonth } },
      _sum: { amount: true }
    });
    const thisMonthExpense = thisMonthExpenseAgg._sum.amount || 0;

    // 4. Monthly Trend for Last 6 Months
    const trend = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();
      const monthStart = new Date(y, m - 1, 1);
      const monthEnd = new Date(y, m, 0, 23, 59, 59, 999);

      const mIncome = await prisma.income.aggregate({
        where: { date: { gte: monthStart, lte: monthEnd } },
        _sum: { amount: true }
      });
      const mExpense = await prisma.expense.aggregate({
        where: { date: { gte: monthStart, lte: monthEnd } },
        _sum: { amount: true }
      });

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      trend.push({
        monthName: `${monthNames[m - 1]} ${y}`,
        month: m,
        year: y,
        income: mIncome._sum.amount || 0,
        expense: mExpense._sum.amount || 0
      });
    }

    // 5. Recent Transactions
    const recentIncomes = await prisma.income.findMany({
      take: 5,
      orderBy: { date: 'desc' }
    });
    const recentExpenses = await prisma.expense.findMany({
      take: 5,
      orderBy: { date: 'desc' }
    });

    res.json({
      success: true,
      stats: {
        totalIncome,
        totalExpense,
        netBalance,
        thisMonthIncome,
        thisMonthExpense,
        totalActiveMembers,
        paidMembersCount,
        dueMembersCount,
        currentMonth,
        currentYear,
      },
      trend,
      recentIncomes,
      recentExpenses,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
