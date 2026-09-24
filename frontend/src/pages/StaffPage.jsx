import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../utils/api';
import { STAFF_CATEGORIES, PAYMENT_MODES, MONTH_NAMES } from '../utils/categoriesData';
import { exportToPdf } from '../utils/exportPdf';
import { exportToExcel } from '../utils/exportExcel';
import {
  Plus,
  Search,
  UserCheck,
  Edit2,
  Trash2,
  CreditCard,
  Download,
  Calendar,
  Phone,
  Briefcase,
  X,
  Check,
  History,
  AlertCircle,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';

export default function StaffPage() {
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutStaff, setPayoutStaff] = useState(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyStaff, setHistoryStaff] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailStaff, setDetailStaff] = useState(null);

  // Form State for Add / Edit
  const initialForm = {
    name: '',
    phone: '',
    salary: '',
    category: STAFF_CATEGORIES[0],
    joiningDate: new Date().toISOString().split('T')[0],
    status: 'Active',
    description: '',
  };
  const [formData, setFormData] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);

  // Payout Form
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const [payoutForm, setPayoutForm] = useState({
    amount: '',
    paymentMode: PAYMENT_MODES[0],
    month: currentMonth,
    year: currentYear,
    notes: '',
  });

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/staff', {
        search,
        category: categoryFilter !== 'All' ? categoryFilter : undefined,
        status: statusFilter !== 'All' ? statusFilter : undefined,
      });
      if (res.success) {
        setStaffList(res.staff || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch staff members');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, [search, categoryFilter, statusFilter]);

  const handleOpenAdd = () => {
    setEditingStaff(null);
    setFormData(initialForm);
    setShowAddModal(true);
  };

  const handleOpenEdit = (s) => {
    setEditingStaff(s);
    setFormData({
      name: s.name,
      phone: s.phone,
      salary: s.salary,
      category: s.category,
      joiningDate: s.joiningDate ? new Date(s.joiningDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      status: s.status || 'Active',
      description: s.description || '',
    });
    setShowAddModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this staff record?')) return;
    try {
      await api.del(`/api/staff/${id}`);
      fetchStaff();
    } catch (err) {
      alert(err.message || 'Failed to delete staff member');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingStaff) {
        await api.put(`/api/staff/${editingStaff.id}`, formData);
      } else {
        await api.post('/api/staff', formData);
      }
      setShowAddModal(false);
      fetchStaff();
    } catch (err) {
      alert(err.message || 'Failed to save staff record');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Salary Payout modal (Auto-selects earliest pending salary month)
  const handleOpenPayout = (s) => {
    if (s.status !== 'Active') {
      alert(`${s.name} is currently ${s.status}. Salary can only be disbursed to Active personnel.`);
      return;
    }
    if (s.pendingMonthsCount === 0) {
      alert(`✅ ${s.name} is already paid up to date! All monthly salaries have been disbursed.`);
      return;
    }

    setPayoutStaff(s);
    const targetMonth = s.nextDueMonth ? s.nextDueMonth.month : currentMonth;
    const targetYear = s.nextDueMonth ? s.nextDueMonth.year : currentYear;
    const targetLabel = s.nextDueMonth ? s.nextDueMonth.label : `${MONTH_NAMES[targetMonth - 1]} ${targetYear}`;

    setPayoutForm({
      amount: s.salary,
      paymentMode: 'Cash in Hand',
      month: targetMonth,
      year: targetYear,
      notes: `Salary disbursed for ${targetLabel}`,
    });
    setShowPayoutModal(true);
  };

  const handleSelectPendingMonth = (mth) => {
    setPayoutForm(prev => ({
      ...prev,
      month: mth.month,
      year: mth.year,
      notes: `Salary disbursed for ${mth.label}`,
    }));
  };

  const handleConfirmPayout = async (e) => {
    e.preventDefault();
    if (!payoutStaff) return;
    try {
      await api.post(`/api/staff/${payoutStaff.id}/payout`, payoutForm);
      setShowPayoutModal(false);
      alert(`Salary payout of ₹${payoutForm.amount} for ${payoutStaff.name} recorded in Expenses & Staff History!`);
      fetchStaff();
    } catch (err) {
      alert(err.message || 'Failed to process salary payout');
    }
  };

  // Open History
  const handleOpenHistory = (s) => {
    setHistoryStaff(s);
    setShowHistoryModal(true);
  };

  // Open Details
  const handleOpenDetails = (s) => {
    setDetailStaff(s);
    setShowDetailModal(true);
  };

  // Export Staff to PDF
  const handleExportPdf = () => {
    const columns = ['Staff Name', 'Category / Role', 'Phone', 'Salary (₹)', 'Status', 'Pending Months', 'Pending Total (₹)'];
    const rows = staffList.map(s => [
      s.name,
      s.category,
      s.phone,
      '₹' + Number(s.salary).toLocaleString('en-IN'),
      s.status,
      s.pendingMonthsCount > 0 ? `${s.pendingMonthsCount} Mo (${s.pendingMonthsNames || ''})` : 'Clear',
      '₹' + Number(s.totalPendingSalary || 0).toLocaleString('en-IN')
    ]);

    const totalSalary = staffList
      .filter(s => s.status === 'Active')
      .reduce((acc, s) => acc + s.salary, 0);
    const totalPending = staffList.reduce((acc, s) => acc + (s.totalPendingSalary || 0), 0);

    exportToPdf({
      title: 'جامعة النور - Staff & Payroll Roster',
      subtitle: `Total Staff: ${staffList.length}`,
      dateRange: 'Active Payroll',
      columns,
      rows,
      summaryRows: [
        { label: 'Monthly Active Commitment:', value: '₹' + Number(totalSalary).toLocaleString('en-IN') },
        { label: 'Total Pending Salaries:', value: '₹' + Number(totalPending).toLocaleString('en-IN'), bold: true, highlight: true }
      ],
      fileName: 'Jamia_AnNoor_Staff_Payroll.pdf'
    });
  };

  // Export Staff to Excel
  const handleExportExcel = () => {
    const excelRows = staffList.map(s => ({
      'Staff Name': s.name,
      'Phone': s.phone,
      'Role / Category': s.category,
      'Monthly Salary (INR)': s.salary,
      'Status': s.status,
      'Joining Date': new Date(s.joiningDate).toLocaleDateString('en-GB'),
      'Pending Months Count': s.pendingMonthsCount,
      'Pending Months Detail': s.pendingMonthsNames || '',
      'Total Pending Salary (INR)': s.totalPendingSalary,
      'Current Month Paid': s.isCurrentMonthPaid ? 'Yes' : 'No',
      'Notes': s.description || '',
    }));

    exportToExcel({
      data: excelRows,
      sheetName: 'Staff & Payroll',
      fileName: 'Jamia_AnNoor_Staff_List.xlsx'
    });
  };

  const totalMonthlyCommitment = useMemo(() => {
    return staffList
      .filter(s => s.status === 'Active')
      .reduce((acc, s) => acc + s.salary, 0);
  }, [staffList]);

  const totalPendingSalariesAll = useMemo(() => {
    return staffList.reduce((acc, s) => acc + (s.totalPendingSalary || 0), 0);
  }, [staffList]);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            Staff & Payroll Administration
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-semibold">
              {staffList.length} Personnel
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Imam, Muazzin, Teachers, Cleaners. Automatically syncs salaries to Expense records.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExportPdf}
            className="p-2 sm:px-3 sm:py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 shadow-xs flex items-center gap-1.5"
            title="Download PDF Roster"
          >
            <Download className="w-4 h-4 text-rose-600" />
            <span className="hidden sm:inline">PDF</span>
          </button>
          <button
            onClick={handleExportExcel}
            className="p-2 sm:px-3 sm:py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 shadow-xs flex items-center gap-1.5"
            title="Download Excel Roster"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline">Excel</span>
          </button>
          <button
            onClick={handleOpenAdd}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-md shadow-emerald-600/25 flex items-center gap-1.5 transition-transform active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add Staff</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
          {/* Search */}
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search staff by name, phone, notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="All">All Roles / Categories</option>
              {STAFF_CATEGORIES.map((cat, i) => (
                <option key={i} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="On Leave">On Leave</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* Commitment Summary */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs flex-wrap gap-2">
          <span className="text-slate-500">
            Monthly Commitment: <strong>₹{totalMonthlyCommitment.toLocaleString('en-IN')}/mo</strong>
          </span>
          <span className="text-rose-600 dark:text-rose-400 font-bold">
            Total Pending Salaries: ₹{totalPendingSalariesAll.toLocaleString('en-IN')}
          </span>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MOBILE VIEW: Compact Cards (Zero Horizontal Sliding!)     */}
      {/* ======================================================== */}
      <div className="block md:hidden space-y-3">
        {loading ? (
          <div className="py-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading staff...
          </div>
        ) : staffList.length === 0 ? (
          <div className="py-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 text-xs">
            No staff personnel found.
          </div>
        ) : (
          staffList.map((s) => {
            const hasPending = s.pendingMonthsCount > 0 && s.status === 'Active';
            return (
              <div
                key={s.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-4 shadow-xs space-y-3"
              >
                {/* Top Row: Name, Category & Action Icons */}
                <div className="flex items-start justify-between gap-2">
                  <div className="cursor-pointer" onClick={() => handleOpenDetails(s)}>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                        {s.name}
                      </h4>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                        {s.category}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3" />
                      <span>{s.phone}</span>
                    </div>
                  </div>

                  {/* Compact Action Icons Bar */}
                  <div className="flex items-center gap-1">
                    {/* Pay Salary Button (Disabled if already paid up to date) */}
                    <button
                      type="button"
                      onClick={() => handleOpenPayout(s)}
                      disabled={!hasPending}
                      className={`p-2 rounded-xl transition-all ${
                        hasPending
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed opacity-60'
                      }`}
                      title={hasPending ? 'Pay Salary (Sync to Expense)' : 'Salary is up to date'}
                    >
                      <CreditCard className="w-4 h-4" />
                    </button>

                    {/* Salary History */}
                    <button
                      type="button"
                      onClick={() => handleOpenHistory(s)}
                      className="p-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                      title="Salary Disbursement History"
                    >
                      <History className="w-4 h-4" />
                    </button>

                    {/* Edit Staff */}
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(s)}
                      className="p-2 rounded-xl text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                      title="Edit Staff"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Salary details & Status */}
                <div className="grid grid-cols-2 gap-2 text-xs py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 block font-semibold">Monthly Salary</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">₹{Number(s.salary).toLocaleString('en-IN')}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 block font-semibold">Status</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      s.status === 'Active'
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                        : s.status === 'On Leave'
                        ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}>
                      {s.status}
                    </span>
                  </div>
                </div>

                {/* Bottom Row: Pending Salary Status */}
                <div className="flex items-center justify-between pt-1">
                  {hasPending ? (
                    <div className="space-y-0.5">
                      <div className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>{s.pendingMonthsCount} Mo Pending • ₹{Number(s.totalPendingSalary).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="text-[11px] font-semibold text-rose-700 dark:text-rose-300">
                        Pending: {s.pendingMonthsNames}
                      </div>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Salary Up to Date</span>
                    </div>
                  )}

                  <button
                    onClick={() => handleOpenDetails(s)}
                    className="p-1 text-slate-400 hover:text-slate-600"
                    title="View Full Details"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ======================================================== */}
      {/* DESKTOP VIEW: Full Structured Table                       */}
      {/* ======================================================== */}
      <div className="hidden md:block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/40 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                <th className="py-3.5 px-4">Staff Personnel</th>
                <th className="py-3.5 px-4">Role / Category</th>
                <th className="py-3.5 px-4">Monthly Salary</th>
                <th className="py-3.5 px-4">Pending Salary & Months</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-center">Disburse Salary</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading staff personnel...
                  </td>
                </tr>
              ) : staffList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No staff records found.
                  </td>
                </tr>
              ) : (
                staffList.map((s) => {
                  const hasPending = s.pendingMonthsCount > 0 && s.status === 'Active';
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {s.name}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          📞 {s.phone}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/50">
                          {s.category}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap font-bold text-slate-900 dark:text-white text-sm">
                        ₹{Number(s.salary).toLocaleString('en-IN')}
                      </td>

                      {/* Pending Salary Months */}
                      <td className="py-3.5 px-4">
                        {hasPending ? (
                          <div className="space-y-0.5">
                            <div className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>{s.pendingMonthsCount} Mo Pending (₹{Number(s.totalPendingSalary).toLocaleString('en-IN')})</span>
                            </div>
                            <div className="text-[11px] font-semibold text-rose-700 dark:text-rose-300 max-w-xs truncate">
                              Pending: {s.pendingMonthsNames}
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Up to date
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          s.status === 'Active'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                            : s.status === 'On Leave'
                            ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}>
                          {s.status}
                        </span>
                      </td>

                      {/* Disburse Salary Button */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleOpenPayout(s)}
                          disabled={!hasPending}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                            hasPending
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed opacity-60'
                          }`}
                          title={hasPending ? 'Disburse Salary (Sync to Expenses)' : 'All salaries paid up to date'}
                        >
                          {hasPending ? (
                            <>
                              <CreditCard className="w-3.5 h-3.5" />
                              <span>Pay Salary</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Paid</span>
                            </>
                          )}
                        </button>
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => handleOpenHistory(s)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors"
                            title="Salary History"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(s)}
                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors"
                            title="Edit Staff Member"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(s.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                            title="Delete Staff"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODALS                                                    */}
      {/* ======================================================== */}

      {/* Salary Payout Modal (Connected to Expense) */}
      {showPayoutModal && payoutStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Disburse Monthly Salary
                </h3>
                <p className="text-xs text-emerald-600 font-semibold">{payoutStaff.name} ({payoutStaff.category})</p>
              </div>
              <button
                onClick={() => setShowPayoutModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmPayout} className="py-4 space-y-4">
              {/* Pending Months Chips */}
              {payoutStaff.pendingMonths && payoutStaff.pendingMonths.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1.5">
                    Click to Pay Specific Pending Month:
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {payoutStaff.pendingMonths.map((mth, idx) => {
                      const isSelected = payoutForm.month === mth.month && payoutForm.year === mth.year;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectPendingMonth(mth)}
                          className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-all ${
                            isSelected
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900 hover:bg-rose-100'
                          }`}
                        >
                          {mth.label} {isSelected && '✓'}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Month & Year */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Month
                  </label>
                  <select
                    value={payoutForm.month}
                    onChange={(e) => {
                      const m = parseInt(e.target.value);
                      const mName = MONTH_NAMES[m - 1];
                      setPayoutForm({ ...payoutForm, month: m, notes: `Salary disbursed for ${mName} ${payoutForm.year}` });
                    }}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    {MONTH_NAMES.map((name, i) => (
                      <option key={i} value={i + 1}>{name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Year
                  </label>
                  <select
                    value={payoutForm.year}
                    onChange={(e) => {
                      const y = parseInt(e.target.value);
                      const mName = MONTH_NAMES[payoutForm.month - 1];
                      setPayoutForm({ ...payoutForm, year: y, notes: `Salary disbursed for ${mName} ${y}` });
                    }}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    {[currentYear + 1, currentYear, currentYear - 1].map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Salary Amount (IN ₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={payoutForm.amount}
                  onChange={(e) => setPayoutForm({ ...payoutForm, amount: e.target.value })}
                  className="w-full px-3 py-2 text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Mode
                </label>
                <select
                  value={payoutForm.paymentMode}
                  onChange={(e) => setPayoutForm({ ...payoutForm, paymentMode: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  {PAYMENT_MODES.map((mode, i) => (
                    <option key={i} value={mode}>{mode}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Disbursement Remarks (Which month paid / notes)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Salary disbursed for September 2026 via cash"
                  value={payoutForm.notes}
                  onChange={(e) => setPayoutForm({ ...payoutForm, notes: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800/40 text-[11px] text-emerald-800 dark:text-emerald-300">
                ⚡ <strong>Auto-Connected to Expenses:</strong> Confirming this payment automatically records a "Staff Salary" expense in the ledger!
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowPayoutModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md transition-all"
                >
                  <Check className="w-4 h-4" />
                  Confirm & Sync to Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Salary History Modal */}
      {showHistoryModal && historyStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-800 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Salary Disbursement History
                </h3>
                <p className="text-xs text-slate-500">{historyStaff.name} ({historyStaff.category})</p>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 divide-y divide-slate-100 dark:divide-slate-800">
              {(!historyStaff.payments || historyStaff.payments.length === 0) ? (
                <p className="text-xs text-slate-400 text-center py-6">No previous salary disbursements recorded yet.</p>
              ) : (
                historyStaff.payments.map((p) => (
                  <div key={p.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {MONTH_NAMES[p.month - 1]} {p.year}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {p.paymentMode} • {new Date(p.paymentDate).toLocaleDateString('en-GB')}
                        {p.receiptNo && ` • ${p.receiptNo}`}
                      </div>
                      {p.notes && (
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 italic mt-0.5">
                          Remarks: {p.notes}
                        </div>
                      )}
                    </div>
                    <div className="text-right font-bold text-rose-600 dark:text-rose-400 text-sm">
                      ₹{p.amount}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Staff Details Modal (for Mobile Users) */}
      {showDetailModal && detailStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-sm w-full p-6 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Staff Personnel Details
                </h3>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-1 rounded-lg text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
                <div className="font-bold text-sm text-slate-900 dark:text-white">{detailStaff.name}</div>
                <div className="text-emerald-700 dark:text-emerald-300 font-semibold">{detailStaff.category}</div>
                <div className="text-slate-500 mt-1">📞 {detailStaff.phone}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Joined: {new Date(detailStaff.joiningDate).toLocaleDateString('en-GB')}</div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] uppercase text-slate-400 block font-semibold">Monthly Salary</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">₹{detailStaff.salary}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] uppercase text-slate-400 block font-semibold">Status</span>
                  <span className="font-bold text-emerald-600">{detailStaff.status}</span>
                </div>
              </div>

              {/* Pending Salary Breakdown */}
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50">
                <div className="font-bold text-rose-700 dark:text-rose-300">
                  Pending Salary: {detailStaff.pendingMonthsCount > 0 ? `${detailStaff.pendingMonthsCount} Month(s) Pending` : 'All Paid Up to Date'}
                </div>
                {detailStaff.pendingMonthsCount > 0 && (
                  <div className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">
                    Unpaid Months: <strong>{detailStaff.pendingMonthsNames}</strong>
                  </div>
                )}
                <div className="mt-1 font-bold text-sm text-rose-700 dark:text-rose-300">
                  Total Pending: ₹{Number(detailStaff.totalPendingSalary || 0).toLocaleString('en-IN')}
                </div>
              </div>

              {detailStaff.description && (
                <div className="text-[11px] text-slate-500 italic p-2 bg-slate-50 dark:bg-slate-800/30 rounded-lg">
                  Notes: {detailStaff.description}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Staff Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-lg w-full my-8 p-6 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingStaff ? 'Edit Staff Member' : 'Register New Staff'}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="py-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Staff Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Moulana Abdul Rahman"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Phone Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9876543210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Role / Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    {STAFF_CATEGORIES.map((cat, i) => (
                      <option key={i} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Monthly Salary (IN ₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    placeholder="e.g. 25000"
                    value={formData.salary}
                    onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                    className="w-full px-3 py-2 text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Joining Date (Salary Starts From)
                  </label>
                  <input
                    type="date"
                    value={formData.joiningDate}
                    onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="Active">Active</option>
                    <option value="On Leave">On Leave</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
                  Description / Responsibilities / Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Lead Imam for 5 daily prayers, Jumma Khutbah, etc."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md disabled:opacity-50 transition-all"
                >
                  <Check className="w-4 h-4" />
                  {submitting ? 'Saving...' : editingStaff ? 'Update Staff' : 'Register Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
