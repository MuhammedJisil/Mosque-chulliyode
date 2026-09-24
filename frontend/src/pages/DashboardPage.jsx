import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import StatCard from '../components/StatCard';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Users,
  CheckCircle2,
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  Sparkles,
  BarChart3,
  History,
  X,
} from 'lucide-react';
import { MONTH_NAMES } from '../utils/categoriesData';

export default function DashboardPage({ onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals for mobile friendliness
  const [showTrendModal, setShowTrendModal] = useState(false);
  const [showRecentModal, setShowRecentModal] = useState(false);

  const loadStats = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/dashboard/stats');
      if (res.success) {
        setData(res);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch dashboard statistics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Loading جامعة النور Dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center bg-rose-50 dark:bg-rose-950/40 rounded-2xl border border-rose-200 dark:border-rose-900/60 max-w-lg mx-auto mt-12">
        <p className="text-rose-600 dark:text-rose-400 font-medium mb-3">{error || 'Unable to load data'}</p>
        <button
          onClick={loadStats}
          className="px-4 py-2 bg-rose-600 text-white text-sm font-medium rounded-xl hover:bg-rose-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const { stats, trend, recentIncomes, recentExpenses } = data;
  const currentMonthLabel = MONTH_NAMES[stats.currentMonth - 1] || 'Current Month';

  // Format currency
  const fmt = (num) => '₹' + Number(num || 0).toLocaleString('en-IN');

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in pb-12">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white p-5 sm:p-7 shadow-xl shadow-emerald-950/20">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-emerald-100 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              Masjid Finance &amp; Membership Hub
            </div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight" dir="rtl">
              جامعة النور
            </h2>
            <p className="text-emerald-100/80 text-xs sm:text-sm max-w-xl">
              Overview for {currentMonthLabel} {stats.currentYear}. Track all collections, staff expenses, and member dues.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center flex-wrap gap-2 pt-2 md:pt-0">
            <button
              onClick={() => onNavigate('income')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white text-emerald-800 hover:bg-emerald-50 text-xs font-bold rounded-xl shadow-md transition-transform active:scale-95"
              title="Add Income"
            >
              <Plus className="w-4 h-4 text-emerald-600" />
              <span>Income</span>
            </button>
            <button
              onClick={() => onNavigate('expense')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-900/70 hover:bg-emerald-900 border border-emerald-500/40 text-white text-xs font-bold rounded-xl transition-transform active:scale-95"
              title="Add Expense"
            >
              <Plus className="w-4 h-4 text-rose-300" />
              <span>Expense</span>
            </button>
            <button
              onClick={() => onNavigate('members')}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-950/60 hover:bg-emerald-950 border border-emerald-400/30 text-amber-300 text-xs font-semibold rounded-xl transition-transform active:scale-95"
              title="Manage Members"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Members</span>
            </button>
          </div>
        </div>
      </div>

      {/* 6 Key Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
        {/* 1. Total Income */}
        <StatCard
          title="Total Income"
          value={fmt(stats.totalIncome)}
          subtitle={`This Month: ${fmt(stats.thisMonthIncome)}`}
          icon={TrendingUp}
          color="emerald"
          badgeText="All Time"
        />

        {/* 2. Total Expense */}
        <StatCard
          title="Total Expense"
          value={fmt(stats.totalExpense)}
          subtitle={`This Month: ${fmt(stats.thisMonthExpense)}`}
          icon={TrendingDown}
          color="rose"
          badgeText="All Time"
        />

        {/* 3. Net Balance */}
        <StatCard
          title="Net Fund Balance"
          value={fmt(stats.netBalance)}
          subtitle={`Income - Expenses (All Time)`}
          icon={Wallet}
          color={stats.netBalance >= 0 ? 'emerald' : 'rose'}
          badgeText="Treasury"
        />

        {/* 4. Active Members */}
        <StatCard
          title="Active Members"
          value={stats.totalActiveMembers}
          subtitle="Registered community donors"
          icon={Users}
          color="blue"
          badgeText="Active"
        />

        {/* 5. Paid Members */}
        <StatCard
          title="Paid Members"
          value={stats.paidMembersCount}
          subtitle={`Paid for ${currentMonthLabel} ${stats.currentYear}`}
          icon={CheckCircle2}
          color="emerald"
          badgeText="This Month"
        />

        {/* 6. Due Members */}
        <StatCard
          title="Due Members"
          value={stats.dueMembersCount}
          subtitle="Pending subscription this month"
          icon={AlertCircle}
          color="amber"
          badgeText="Action Needed"
        />
      </div>

      {/* Mobile Friendly Modal Trigger Buttons */}
      <div className="flex items-center gap-2 sm:hidden">
        <button
          onClick={() => setShowTrendModal(true)}
          className="flex-1 py-3 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 text-xs font-semibold flex items-center justify-center gap-2 shadow-xs"
        >
          <BarChart3 className="w-4 h-4 text-emerald-600" />
          <span>Financial Trend</span>
        </button>
        <button
          onClick={() => setShowRecentModal(true)}
          className="flex-1 py-3 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 text-xs font-semibold flex items-center justify-center gap-2 shadow-xs"
        >
          <History className="w-4 h-4 text-blue-600" />
          <span>Recent Activity</span>
        </button>
      </div>

      {/* Monthly Financial Trend Chart (Desktop Inline) */}
      <div className="hidden sm:block bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Financial Trend (Last 6 Months)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Comparison between Income Collections and Expenditures
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-emerald-500" />
              <span className="text-slate-600 dark:text-slate-400">Income</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-rose-500" />
              <span className="text-slate-600 dark:text-slate-400">Expense</span>
            </div>
          </div>
        </div>

        {/* Visual Bar Columns */}
        <div className="grid grid-cols-6 gap-2 sm:gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          {trend.map((t, idx) => {
            const maxVal = Math.max(...trend.map(x => Math.max(x.income, x.expense)), 1000);
            const incomeHeight = Math.max((t.income / maxVal) * 120, 6);
            const expenseHeight = Math.max((t.expense / maxVal) * 120, 6);

            return (
              <div key={idx} className="flex flex-col items-center space-y-2">
                <div className="h-32 w-full flex items-end justify-center gap-1 sm:gap-2">
                  <div
                    style={{ height: `${incomeHeight}px` }}
                    className="w-3 sm:w-6 bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-md transition-all duration-500 hover:opacity-85"
                    title={`Income: ${fmt(t.income)}`}
                  />
                  <div
                    style={{ height: `${expenseHeight}px` }}
                    className="w-3 sm:w-6 bg-gradient-to-t from-rose-600 to-rose-400 rounded-t-md transition-all duration-500 hover:opacity-85"
                    title={`Expense: ${fmt(t.expense)}`}
                  />
                </div>
                <div className="text-[11px] font-medium text-slate-600 dark:text-slate-400 text-center truncate w-full">
                  {t.monthName}
                </div>
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  {fmt(t.income)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Two Column: Recent Incomes & Recent Expenses (Desktop Inline) */}
      <div className="hidden sm:grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Incomes */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600">
                <ArrowDownLeft className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                Recent Incomes
              </h3>
            </div>
            <button
              onClick={() => onNavigate('income')}
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
            >
              View All
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {recentIncomes.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No recent incomes recorded.</p>
            ) : (
              recentIncomes.map((inc) => (
                <div key={inc.id} className="py-3 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {inc.donorName}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded text-[10px] font-medium">
                        {inc.category}
                      </span>
                      <span>•</span>
                      <span>{new Date(inc.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                      <span>•</span>
                      <span>{inc.paymentMode}</span>
                    </div>
                  </div>
                  <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    +{fmt(inc.amount)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Expenses */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600">
                <ArrowUpRight className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                Recent Expenses
              </h3>
            </div>
            <button
              onClick={() => onNavigate('expense')}
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
            >
              View All
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {recentExpenses.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No recent expenses recorded.</p>
            ) : (
              recentExpenses.map((exp) => (
                <div key={exp.id} className="py-3 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {exp.purpose}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="px-1.5 py-0.5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded text-[10px] font-medium">
                        {exp.category}
                      </span>
                      <span>•</span>
                      <span>Paid to: {exp.paidTo}</span>
                      <span>•</span>
                      <span>{new Date(exp.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                    </div>
                  </div>
                  <div className="text-sm font-bold text-rose-600 dark:text-rose-400">
                    -{fmt(exp.amount)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Mobile Modal: Financial Trend */}
      {showTrendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in sm:hidden">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-sm w-full p-6 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-600" />
                6-Month Trend Overview
              </h3>
              <button
                onClick={() => setShowTrendModal(false)}
                className="p-1 rounded-lg text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="py-4 space-y-3">
              {trend.map((t, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{t.monthName}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">+{fmt(t.income)}</span>
                    <span className="text-rose-600 dark:text-rose-400 font-bold">-{fmt(t.expense)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Modal: Recent Transactions */}
      {showRecentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in sm:hidden">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-sm w-full p-6 border border-slate-200 dark:border-slate-800 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <History className="w-4 h-4 text-blue-600" />
                Recent Activities
              </h3>
              <button
                onClick={() => setShowRecentModal(false)}
                className="p-1 rounded-lg text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="py-3 space-y-4">
              <div>
                <h4 className="text-xs font-bold text-emerald-600 uppercase mb-2">Latest Incomes</h4>
                <div className="space-y-2">
                  {recentIncomes.map((inc) => (
                    <div key={inc.id} className="p-2.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 text-xs flex justify-between">
                      <div>
                        <div className="font-semibold">{inc.donorName}</div>
                        <div className="text-[10px] text-slate-400">{inc.category}</div>
                      </div>
                      <div className="font-bold text-emerald-600">+{fmt(inc.amount)}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-rose-600 uppercase mb-2">Latest Expenses</h4>
                <div className="space-y-2">
                  {recentExpenses.map((exp) => (
                    <div key={exp.id} className="p-2.5 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 text-xs flex justify-between">
                      <div>
                        <div className="font-semibold">{exp.purpose}</div>
                        <div className="text-[10px] text-slate-400">{exp.paidTo}</div>
                      </div>
                      <div className="font-bold text-rose-600">-{fmt(exp.amount)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
