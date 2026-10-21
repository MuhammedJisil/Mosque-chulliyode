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

// GET /api/dashboard/statement
// Generates accounting cashbook ledger with running balance, opening balance, and filters
router.get('/statement', authMiddleware, async (req, res) => {
  try {
    const { type = 'all', month, year, startDate: qStartDate, endDate: qEndDate, tillDate } = req.query;
    const now = new Date();

    let startDate = null;
    let endDate = null;
    let periodLabel = 'All Records';

    if (type === 'month') {
      const targetYear = parseInt(year) || now.getFullYear();
      const targetMonth = parseInt(month) || (now.getMonth() + 1);
      startDate = new Date(targetYear, targetMonth - 1, 1, 0, 0, 0, 0);
      endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      periodLabel = `${monthNames[targetMonth - 1]} ${targetYear}`;
    } else if (type === 'year') {
      const targetYear = parseInt(year) || now.getFullYear();
      startDate = new Date(targetYear, 0, 1, 0, 0, 0, 0);
      endDate = new Date(targetYear, 11, 31, 23, 59, 59, 999);
      periodLabel = `Year ${targetYear}`;
    } else if (type === 'range' && qStartDate && qEndDate) {
      startDate = new Date(`${qStartDate}T00:00:00`);
      endDate = new Date(`${qEndDate}T23:59:59.999`);
      periodLabel = `${new Date(startDate).toLocaleDateString('en-GB')} to ${new Date(endDate).toLocaleDateString('en-GB')}`;
    } else if (type === 'tillDate' && tillDate) {
      endDate = new Date(`${tillDate}T23:59:59.999`);
      periodLabel = `Till Date: ${new Date(endDate).toLocaleDateString('en-GB')}`;
    } else {
      endDate = new Date();
      periodLabel = `All Records (Till ${new Date().toLocaleDateString('en-GB')})`;
    }

    // 1. Calculate Opening Balance before startDate
    let openingBalance = 0;
    if (startDate) {
      const priorIncome = await prisma.income.aggregate({
        where: { date: { lt: startDate } },
        _sum: { amount: true }
      });
      const priorExpense = await prisma.expense.aggregate({
        where: { date: { lt: startDate } },
        _sum: { amount: true }
      });
      openingBalance = (priorIncome._sum.amount || 0) - (priorExpense._sum.amount || 0);
    }

    // 2. Query Incomes and Expenses within period
    const incomeWhere = {
      date: {
        ...(startDate ? { gte: startDate } : {}),
        ...(endDate ? { lte: endDate } : {})
      }
    };
    const expenseWhere = {
      date: {
        ...(startDate ? { gte: startDate } : {}),
        ...(endDate ? { lte: endDate } : {})
      }
    };

    const incomes = await prisma.income.findMany({
      where: incomeWhere,
      orderBy: { date: 'asc' }
    });

    const expenses = await prisma.expense.findMany({
      where: expenseWhere,
      orderBy: { date: 'asc' }
    });

    // 3. Merge, tag, and sort chronologically
    const combined = [
      ...incomes.map(inc => {
        const donor = inc.donorName ? inc.donorName.trim() : '';
        const desc = inc.description ? inc.description.trim() : '';
        let title = '';
        if (donor && desc) {
          title = `${donor} - ${desc}`;
        } else {
          title = donor || desc || inc.category || 'Income';
        }

        return {
          id: `inc-${inc.id}`,
          date: inc.date,
          title,
          donorName: inc.donorName,
          description: inc.description,
          category: inc.category,
          paymentMode: inc.paymentMode,
          receiptNo: inc.receiptNo,
          type: 'INCOME',
          incomeAmount: Number(inc.amount || 0),
          expenseAmount: 0
        };
      }),
      ...expenses.map(exp => {
        const purp = exp.purpose ? exp.purpose.trim() : '';
        const paid = exp.paidTo ? exp.paidTo.trim() : '';
        const desc = exp.description ? exp.description.trim() : '';
        let title = '';
        if (purp && paid) {
          title = `${purp} (${paid})`;
        } else {
          title = purp || paid || desc || exp.category || 'Expense';
        }

        return {
          id: `exp-${exp.id}`,
          date: exp.date,
          title,
          purpose: exp.purpose,
          paidTo: exp.paidTo,
          description: exp.description,
          category: exp.category,
          paymentMode: exp.paymentMode,
          receiptNo: exp.receiptNo,
          type: 'EXPENSE',
          incomeAmount: 0,
          expenseAmount: Number(exp.amount || 0)
        };
      })
    ];

    combined.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // 4. Compute running ledger balance
    let runningBalance = openingBalance;
    let totalIncome = 0;
    let totalExpense = 0;

    const ledger = combined.map(entry => {
      if (entry.type === 'INCOME') {
        runningBalance += entry.incomeAmount;
        totalIncome += entry.incomeAmount;
      } else {
        runningBalance -= entry.expenseAmount;
        totalExpense += entry.expenseAmount;
      }
      return {
        ...entry,
        balance: runningBalance
      };
    });

    const closingBalance = openingBalance + totalIncome - totalExpense;

    res.json({
      success: true,
      periodLabel,
      summary: {
        openingBalance,
        totalIncome,
        totalExpense,
        closingBalance,
        transactionsCount: ledger.length
      },
      ledger
    });
  } catch (error) {
    console.error('Financial statement error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
