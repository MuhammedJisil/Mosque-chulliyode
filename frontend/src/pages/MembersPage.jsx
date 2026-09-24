import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../utils/api';
import { openWhatsAppDueReminder } from '../utils/whatsapp';
import { exportToPdf } from '../utils/exportPdf';
import { exportToExcel } from '../utils/exportExcel';
import Pagination from '../components/Pagination';
import { PAYMENT_MODES, MONTH_NAMES } from '../utils/categoriesData';
import {
  Plus,
  Search,
  Users,
  MessageCircle,
  CreditCard,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Download,
  Calendar,
  Phone,
  MapPin,
  GraduationCap,
  X,
  Check,
  History,
  Info,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';

export default function MembersPage() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All'); // 'All', 'Active', 'Inactive', 'DueOnly'

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [activePayingMember, setActivePayingMember] = useState(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyMember, setHistoryMember] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailMember, setDetailMember] = useState(null);

  // Form State for Add / Edit Member
  const initialForm = {
    name: '',
    phone: '',
    address: '',
    joiningDate: new Date().toISOString().split('T')[0],
    monthlyDonation: 100,
    openingBalance: 0,
    status: 'Active',
    hasMadrasa: false,
    madrasaChildrenCount: 1,
    madrasaMonthlyFee: 200,
    notes: '',
  };
  const [formData, setFormData] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);

  // Payment Form State
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const [paymentForm, setPaymentForm] = useState({
    month: currentMonth,
    year: currentYear,
    membershipAmount: 100,
    madrasaAmount: 0,
    openingBalanceAmount: 0,
    paymentMode: PAYMENT_MODES[0],
    notes: '',
  });

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/members', {
        search,
        status: statusFilter !== 'All' && statusFilter !== 'DueOnly' ? statusFilter : undefined,
      });
      if (res.success) {
        let list = res.members || [];
        if (statusFilter === 'DueOnly') {
          list = list.filter(m => m.dueMonthsCount > 0);
        }
        setMembers(list);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch members');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [search, statusFilter]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 15;

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  const paginatedMembers = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return members.slice(startIndex, startIndex + PAGE_SIZE);
  }, [members, currentPage]);

  const handleOpenAdd = () => {
    setEditingMember(null);
    setFormData(initialForm);
    setShowAddModal(true);
  };

  const handleOpenEdit = (m) => {
    setEditingMember(m);
    setFormData({
      name: m.name,
      phone: m.phone,
      address: m.address || '',
      joiningDate: m.joiningDate ? new Date(m.joiningDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      monthlyDonation: m.monthlyDonation || 100,
      openingBalance: m.openingBalance || 0,
      status: m.status || 'Active',
      hasMadrasa: Boolean(m.hasMadrasa),
      madrasaChildrenCount: m.madrasaChildrenCount || 1,
      madrasaMonthlyFee: m.madrasaMonthlyFee || 0,
      notes: m.notes || '',
    });
    setShowAddModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to remove this member and their payment records?')) return;
    try {
      await api.del(`/api/members/${id}`);
      fetchMembers();
    } catch (err) {
      alert(err.message || 'Failed to delete member');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingMember) {
        await api.put(`/api/members/${editingMember.id}`, formData);
      } else {
        await api.post('/api/members', formData);
      }
      setShowAddModal(false);
      fetchMembers();
    } catch (err) {
      alert(err.message || 'Failed to save member details');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Payment Modal (Auto-selects earliest unpaid month!)
  const handleOpenPayment = (m) => {
    const hasDues = m.dueMonthsCount > 0 || (m.netOpeningBalanceDue || 0) > 0;
    if (!hasDues) {
      alert(`✅ ${m.name} is already completely up to date! All monthly dues and past arrears are cleared.`);
      return;
    }

    setActivePayingMember(m);
    const targetMonth = m.nextDueMonth ? m.nextDueMonth.month : currentMonth;
    const targetYear = m.nextDueMonth ? m.nextDueMonth.year : currentYear;
    const targetLabel = m.nextDueMonth ? m.nextDueMonth.label : `${MONTH_NAMES[targetMonth - 1]} ${targetYear}`;

    setPaymentForm({
      month: targetMonth,
      year: targetYear,
      membershipAmount: m.nextDueMonth ? (m.monthlyDonation || 100) : 0,
      madrasaAmount: m.nextDueMonth && m.hasMadrasa ? (m.madrasaMonthlyFee || 0) : 0,
      openingBalanceAmount: 0,
      paymentMode: 'Cash in Hand',
      notes: m.nextDueMonth ? `Subscription paid for ${targetLabel}` : `Past arrears/opening balance payment`,
    });
    setShowPaymentModal(true);
  };

  const handleSelectPendingMonth = (due) => {
    setPaymentForm(prev => ({
      ...prev,
      month: due.month,
      year: due.year,
      notes: `Subscription paid for ${due.label}`,
    }));
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!activePayingMember) return;
    try {
      await api.post(`/api/members/${activePayingMember.id}/payments`, paymentForm);
      setShowPaymentModal(false);
      alert(`Payment recorded successfully and added to Income!`);
      fetchMembers();
    } catch (err) {
      alert(err.message || 'Failed to record payment');
    }
  };

  // Open Payment History Modal
  const handleOpenHistory = (m) => {
    setHistoryMember(m);
    setShowHistoryModal(true);
  };

  // Open Member Details Modal (for mobile zero-horizontal-scrolling)
  const handleOpenDetails = (m) => {
    setDetailMember(m);
    setShowDetailModal(true);
  };

  // Export Members List to PDF
  const handleExportPdf = () => {
    const columns = ['Name', 'Phone', 'Monthly Fee', 'Madrasa Fee', 'Status', 'Due Months', 'Total Due (₹)'];
    const rows = members.map(m => [
      m.name,
      m.phone,
      '₹' + m.monthlyDonation,
      m.hasMadrasa ? `₹${m.madrasaMonthlyFee} (${m.madrasaChildrenCount} kid)` : '-',
      m.status,
      m.dueMonthsCount > 0 ? `${m.dueMonthsCount} Mo (${m.dueMonthsNames || ''})` : 'Clear',
      '₹' + Number(m.totalDueAmount || 0).toLocaleString('en-IN'),
    ]);

    const totalDues = members.reduce((acc, m) => acc + (m.totalDueAmount || 0), 0);

    exportToPdf({
      title: 'جامعة النور - Member Subscriptions & Due Report',
      subtitle: `Total Members: ${members.length}`,
      dateRange: 'Current Status',
      columns,
      rows,
      summaryRows: [
        { label: 'Total Outstanding Dues:', value: '₹' + Number(totalDues).toLocaleString('en-IN'), bold: true, highlight: true }
      ],
      fileName: 'Jamia_AnNoor_Members_Due_Report.pdf'
    });
  };

  // Export Members to Excel
  const handleExportExcel = () => {
    const excelRows = members.map(m => ({
      'Name': m.name,
      'Phone': m.phone,
      'Address': m.address || '',
      'Joining Date': new Date(m.joiningDate).toLocaleDateString('en-GB'),
      'Monthly Donation (INR)': m.monthlyDonation,
      'Has Madrasa Kids': m.hasMadrasa ? 'Yes' : 'No',
      'Madrasa Children Count': m.hasMadrasa ? m.madrasaChildrenCount : 0,
      'Madrasa Monthly Fee (INR)': m.hasMadrasa ? m.madrasaMonthlyFee : 0,
      'Status': m.status,
      'Due Months Count': m.dueMonthsCount,
      'Which Months Due': m.dueMonthsNames || (m.dueMonths || []).map(x => x.label).join(', '),
      'Total Due Amount (INR)': m.totalDueAmount,
      'Current Month Paid': m.isCurrentMonthPaid ? 'Yes' : 'No',
    }));

    exportToExcel({
      data: excelRows,
      sheetName: 'Members',
      fileName: 'Masjid_Members_List.xlsx'
    });
  };

  const totalDuesAll = useMemo(() => members.reduce((acc, m) => acc + (m.totalDueAmount || 0), 0), [members]);

  // hasDues also accounts for opening balance arrears
  const getMemberHasDues = (m) => m.dueMonthsCount > 0 || (m.netOpeningBalanceDue || 0) > 0;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            Members & Madrasa Subscriptions
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-semibold">
              {members.length} Members
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Monthly donation (₹100 default), madrasa fees, precise pending months due, and 1-click WhatsApp alerts
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExportPdf}
            className="p-2 sm:px-3 sm:py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 shadow-xs flex items-center gap-1.5"
            title="Download PDF Report"
          >
            <Download className="w-4 h-4 text-rose-600" />
            <span className="hidden sm:inline">PDF</span>
          </button>
          <button
            onClick={handleExportExcel}
            className="p-2 sm:px-3 sm:py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 shadow-xs flex items-center gap-1.5"
            title="Download Excel Report"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline">Excel</span>
          </button>
          <button
            onClick={handleOpenAdd}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-md shadow-emerald-600/25 flex items-center gap-1.5 transition-transform active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add Member</span>
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
              placeholder="Search member by name, phone, address..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="All">All Members</option>
              <option value="Active">Active Only</option>
              <option value="Inactive">Inactive Only</option>
              <option value="DueOnly">⚠️ Members with Pending Dues</option>
            </select>
          </div>

          <div className="flex items-center sm:justify-end text-xs font-semibold">
            <span className="text-slate-500 mr-2">Total Dues:</span>
            <span className="text-rose-600 dark:text-rose-400 text-sm font-extrabold">
              ₹{totalDuesAll.toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MOBILE VIEW: Compact Cards (No Horizontal Sliding!)      */}
      {/* ======================================================== */}
      <div className="block md:hidden space-y-3">
        {loading ? (
          <div className="py-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading members...
          </div>
        ) : members.length === 0 ? (
          <div className="py-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 text-xs">
            No members found matching your search.
          </div>
        ) : (
          <>
            {paginatedMembers.map((m) => {
              const hasDues = getMemberHasDues(m);
              return (
              <div
                key={m.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-4 shadow-xs space-y-3"
              >
                {/* Top Row: Name, Status & Action Icons */}
                <div className="flex items-start justify-between gap-2">
                  <div className="cursor-pointer" onClick={() => handleOpenDetails(m)}>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                        {m.name}
                      </h4>
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                        m.status === 'Active'
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      }`}>
                        {m.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3" />
                      <span>{m.phone}</span>
                    </div>
                  </div>

                  {/* Compact Action Icons Bar */}
                  <div className="flex items-center gap-1">
                    {/* WhatsApp button */}
                    <button
                      type="button"
                      onClick={() => openWhatsAppDueReminder(m)}
                      className={`p-2 rounded-xl transition-all ${
                        hasDues
                          ? 'bg-emerald-600 text-white shadow-xs hover:bg-emerald-700'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-emerald-600'
                      }`}
                      title="Send WhatsApp Reminder"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </button>

                    {/* Pay Button (Disabled if already up to date!) */}
                    <button
                      type="button"
                      onClick={() => handleOpenPayment(m)}
                      disabled={!hasDues}
                      className={`p-2 rounded-xl transition-all ${
                        hasDues
                          ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed opacity-60'
                      }`}
                      title={hasDues ? 'Record Payment' : 'Member is up to date'}
                    >
                      <CreditCard className="w-4 h-4" />
                    </button>

                    {/* History button */}
                    <button
                      type="button"
                      onClick={() => handleOpenHistory(m)}
                      className="p-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                      title="Payment History"
                    >
                      <History className="w-4 h-4" />
                    </button>

                    {/* Edit button */}
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(m)}
                      className="p-2 rounded-xl text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                      title="Edit Member"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Contribution details */}
                <div className="grid grid-cols-2 gap-2 text-xs py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 block font-semibold">Monthly Donation</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">₹{m.monthlyDonation}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 block font-semibold">Madrasa Fee</span>
                    {m.hasMadrasa ? (
                      <span className="font-bold text-amber-600 dark:text-amber-400">
                        ₹{m.madrasaMonthlyFee} <span className="text-[10px] text-slate-400 font-normal">({m.madrasaChildrenCount} kid)</span>
                      </span>
                    ) : (
                      <span className="text-slate-400">None</span>
                    )}
                  </div>
                  {(m.openingBalance || 0) > 0 && (
                    <div className="col-span-2">
                      <span className="text-[10px] uppercase text-slate-400 block font-semibold">Past Arrears (Opening Balance)</span>
                      <span className="font-bold text-orange-600 dark:text-orange-400">
                        ₹{m.openingBalance} total
                        {(m.netOpeningBalanceDue || 0) > 0
                          ? <span className="text-[10px] text-rose-600 font-normal ml-1">(Still due: ₹{m.netOpeningBalanceDue})</span>
                          : <span className="text-[10px] text-emerald-600 font-normal ml-1">(Cleared)</span>
                        }
                      </span>
                    </div>
                  )}
                </div>

                {/* Bottom Row: Exact Pending Months Due */}
                <div className="flex items-center justify-between pt-1">
                  {hasDues ? (
                    <div className="space-y-0.5">
                      <div className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>{m.dueMonthsCount} Month(s) Due • ₹{Number(m.totalDueAmount).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="text-[11px] font-semibold text-rose-700 dark:text-rose-300">
                        Pending: {m.dueMonthsNames || (m.dueMonths || []).map(x => x.label).join(', ')}
                      </div>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>All Subscriptions Paid (Up to date)</span>
                    </div>
                  )}

                  <button
                    onClick={() => handleOpenDetails(m)}
                    className="p-1 text-slate-400 hover:text-slate-600"
                    title="View Full Details"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            );
          })}
          <Pagination
            currentPage={currentPage}
            totalItems={members.length}
            pageSize={PAGE_SIZE}
            onPageChange={setCurrentPage}
          />
        </>
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
                <th className="py-3.5 px-4">Member Info</th>
                <th className="py-3.5 px-4">Monthly Fee</th>
                <th className="py-3.5 px-4">Madrasa Fee</th>
                <th className="py-3.5 px-4">Due Status & Pending Months</th>
                <th className="py-3.5 px-4 text-center">WhatsApp</th>
                <th className="py-3.5 px-4 text-center">Record Payment</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading member records...
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No members found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedMembers.map((m) => {
                  const hasDues = getMemberHasDues(m);
                  return (
                    <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {m.name}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                            m.status === 'Active'
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                          }`}>
                            {m.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                          <span>📞 {m.phone}</span>
                          {m.address && <span>• 📍 {m.address}</span>}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          ₹{m.monthlyDonation}
                        </span>
                        <span className="text-[10px] text-slate-400"> / mo</span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {m.hasMadrasa ? (
                          <div className="flex items-center gap-1.5">
                            <GraduationCap className="w-3.5 h-3.5 text-amber-500" />
                            <div>
                              <span className="font-semibold text-amber-700 dark:text-amber-400">
                                ₹{m.madrasaMonthlyFee}
                              </span>
                              <span className="text-[10px] text-slate-400 block">
                                {m.madrasaChildrenCount} child(ren)
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">None</span>
                        )}
                      </td>

                      {/* Due Status with Exact Pending Months list */}
                      <td className="py-3.5 px-4">
                        {m.dueMonthsCount > 0 ? (
                          <div className="space-y-0.5">
                            <div className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>{m.dueMonthsCount} Month(s) Due</span>
                            </div>
                            <div className="text-[11px] font-semibold text-rose-700 dark:text-rose-300 max-w-xs truncate">
                              Due: {m.dueMonthsNames || (m.dueMonths || []).map(x => x.label).join(', ')}
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Up to date
                          </span>
                        )}
                        {(m.netOpeningBalanceDue || 0) > 0 && (
                          <div className="mt-1 text-[11px] font-semibold text-orange-600 dark:text-orange-400">
                            + Arrears due: ₹{Number(m.netOpeningBalanceDue).toLocaleString('en-IN')}
                          </div>
                        )}
                        {hasDues && (
                          <div className="text-[11px] font-bold text-rose-800 dark:text-rose-300 mt-0.5">
                            Total: ₹{Number(m.totalDueAmount || 0).toLocaleString('en-IN')}
                          </div>
                        )}
                      </td>

                      {/* WhatsApp Reminder Button */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openWhatsAppDueReminder(m)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-xs transition-all active:scale-95 ${
                            hasDues
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-emerald-600'
                          }`}
                          title="Send Due Notification via WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>Notify</span>
                        </button>
                      </td>

                      {/* Record Payment Button (Disabled if already up to date) */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleOpenPayment(m)}
                          disabled={!hasDues}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                            hasDues
                              ? 'border border-emerald-300 dark:border-emerald-700/80 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed opacity-60'
                          }`}
                          title={hasDues ? 'Record Payment' : 'Member is already up to date'}
                        >
                          {hasDues ? (
                            <>
                              <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Pay</span>
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
                            onClick={() => handleOpenHistory(m)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors"
                            title="View Payment History"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(m)}
                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors"
                            title="Edit Member"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(m.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                            title="Delete Member"
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
        <Pagination
          currentPage={currentPage}
          totalItems={members.length}
          pageSize={PAGE_SIZE}
          onPageChange={setCurrentPage}
          className="p-4"
        />
      </div>

      {/* ======================================================== */}
      {/* MODALS                                                    */}
      {/* ======================================================== */}

      {/* Record Monthly Payment Modal */}
      {showPaymentModal && activePayingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Record Monthly Payment
                </h3>
                <p className="text-xs text-emerald-600 font-semibold">{activePayingMember.name}</p>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="py-4 space-y-4">
              {/* Pending Months Chips Selector */}
              {activePayingMember.dueMonths && activePayingMember.dueMonths.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1.5">
                    Click to Pay Specific Due Month:
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {activePayingMember.dueMonths.map((due, idx) => {
                      const isSelected = paymentForm.month === due.month && paymentForm.year === due.year;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectPendingMonth(due)}
                          className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-all ${
                            isSelected
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900 hover:bg-rose-100'
                          }`}
                        >
                          {due.label} {isSelected && '✓'}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Month & Year Selectors */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Month
                  </label>
                  <select
                    value={paymentForm.month}
                    onChange={(e) => {
                      const m = parseInt(e.target.value);
                      const mName = MONTH_NAMES[m - 1];
                      setPaymentForm({
                        ...paymentForm,
                        month: m,
                        notes: `Subscription paid for ${mName} ${paymentForm.year}`
                      });
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
                    value={paymentForm.year}
                    onChange={(e) => {
                      const y = parseInt(e.target.value);
                      const mName = MONTH_NAMES[paymentForm.month - 1];
                      setPaymentForm({
                        ...paymentForm,
                        year: y,
                        notes: `Subscription paid for ${mName} ${y}`
                      });
                    }}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    {[currentYear + 1, currentYear, currentYear - 1, currentYear - 2].map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Amounts */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Membership Amount (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={paymentForm.membershipAmount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, membershipAmount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Madrasa Fee (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={paymentForm.madrasaAmount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, madrasaAmount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Opening Balance Arrears Payment */}
              {(activePayingMember.netOpeningBalanceDue || 0) > 0 && (
                <div className="p-3 bg-orange-50 dark:bg-orange-950/30 rounded-xl border border-orange-200 dark:border-orange-800/60">
                  <div className="text-xs font-bold text-orange-800 dark:text-orange-300 mb-1.5">
                    Past Arrears / Opening Balance Due: ₹{Number(activePayingMember.netOpeningBalanceDue).toLocaleString('en-IN')}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-600 dark:text-slate-400 font-medium whitespace-nowrap">Pay Arrears (\u20b9):</label>
                    <input
                      type="number"
                      min="0"
                      max={activePayingMember.netOpeningBalanceDue}
                      value={paymentForm.openingBalanceAmount}
                      onChange={(e) => setPaymentForm({ ...paymentForm, openingBalanceAmount: parseFloat(e.target.value) || 0 })}
                      placeholder={`Max ₹${activePayingMember.netOpeningBalanceDue}`}
                      className="w-full px-3 py-2 text-sm font-semibold rounded-xl border border-orange-200 dark:border-orange-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Total Collection Amount */}
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between">
                <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300">Total Collection:</span>
                <span className="text-base font-bold text-emerald-700 dark:text-emerald-300">
                  ₹{parseFloat(paymentForm.membershipAmount || 0) + parseFloat(paymentForm.madrasaAmount || 0)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Mode
                </label>
                <select
                  value={paymentForm.paymentMode}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentMode: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  {PAYMENT_MODES.map((mode, i) => (
                    <option key={i} value={mode}>{mode}</option>
                  ))}
                </select>
              </div>

              {/* Remarks / Notes Field */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Remarks (Specify which months are paid)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Paid for July 2026, or GPay reference #..."
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md transition-all"
                >
                  <Check className="w-4 h-4" />
                  Confirm & Sync to Income
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Member Details Modal (for Mobile Users) */}
      {showDetailModal && detailMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-sm w-full p-6 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Member Profile
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
                <div className="font-bold text-sm text-slate-900 dark:text-white">{detailMember.name}</div>
                <div className="text-slate-500 mt-1">📞 {detailMember.phone}</div>
                {detailMember.address && <div className="text-slate-500 mt-0.5">📍 {detailMember.address}</div>}
                <div className="text-[10px] text-slate-400 mt-1">Joined: {new Date(detailMember.joiningDate).toLocaleDateString('en-GB')}</div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] uppercase text-slate-400 block font-semibold">Monthly Donation</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">₹{detailMember.monthlyDonation}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] uppercase text-slate-400 block font-semibold">Madrasa Fee</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">
                    {detailMember.hasMadrasa ? `₹${detailMember.madrasaMonthlyFee} (${detailMember.madrasaChildrenCount} kid)` : 'None'}
                  </span>
                </div>
              </div>

              {/* Dues */}
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50">
                <div className="font-bold text-rose-700 dark:text-rose-300">
                  Due Status: {detailMember.dueMonthsCount > 0 ? `${detailMember.dueMonthsCount} Month(s) Pending` : 'Monthly Dues Clear'}
                </div>
                {detailMember.dueMonthsCount > 0 && (
                  <div className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">
                    Unpaid Months: <strong>{detailMember.dueMonthsNames || (detailMember.dueMonths || []).map(x => x.label).join(', ')}</strong>
                  </div>
                )}
                {(detailMember.netOpeningBalanceDue || 0) > 0 && (
                  <div className="mt-1 text-[11px] text-orange-600 dark:text-orange-400 font-semibold">
                    Past Arrears Due: ₹{Number(detailMember.netOpeningBalanceDue).toLocaleString('en-IN')} (of ₹{Number(detailMember.openingBalance).toLocaleString('en-IN')} total)
                  </div>
                )}
                <div className="mt-1 font-bold text-sm text-rose-700 dark:text-rose-300">
                  Total Due: ₹{Number(detailMember.totalDueAmount || 0).toLocaleString('en-IN')}
                </div>
              </div>

              {detailMember.notes && (
                <div className="text-[11px] text-slate-500 italic p-2 bg-slate-50 dark:bg-slate-800/30 rounded-lg">
                  Notes: {detailMember.notes}
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

      {/* Payment History Modal */}
      {showHistoryModal && historyMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-800 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Payment History
                </h3>
                <p className="text-xs text-slate-500">{historyMember.name} • {historyMember.phone}</p>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 divide-y divide-slate-100 dark:divide-slate-800">
              {(!historyMember.payments || historyMember.payments.length === 0) ? (
                <p className="text-xs text-slate-400 text-center py-6">No previous payments recorded for this member.</p>
              ) : (
                historyMember.payments.map((p) => (
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
                    <div className="text-right">
                      <div className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                        ₹{p.totalAmount}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {p.month > 0 && p.membershipAmount > 0 && `Sub: ₹${p.membershipAmount} `}
                        {p.madrasaAmount > 0 && `Madrasa: ₹${p.madrasaAmount} `}
                        {p.openingBalanceAmount > 0 && `Arrears: ₹${p.openingBalanceAmount}`}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-lg w-full my-8 p-6 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingMember ? 'Edit Member Details' : 'Register New Member'}
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
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Farooq Abdullah"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Phone (WhatsApp) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9845012345"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
                  Residential Address
                </label>
                <input
                  type="text"
                  placeholder="e.g. House #42, Main Road, Near Market"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Joining Date (Dues Start From)
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
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Monthly Donation */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1.5">
                  Monthly Donation (Usually ₹100) <span className="text-rose-500">*</span>
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {[100, 200, 500, 1000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setFormData({ ...formData, monthlyDonation: preset })}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                        formData.monthlyDonation === preset
                          ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      ₹{preset}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">₹</span>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="Custom amount"
                    value={formData.monthlyDonation}
                    onChange={(e) => setFormData({ ...formData, monthlyDonation: parseFloat(e.target.value) || 0 })}
                    className="w-full pl-8 pr-3 py-2 text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Opening Balance / Past Arrears */}
              <div className="p-3.5 rounded-xl bg-orange-50/60 dark:bg-orange-950/20 border border-orange-200/70 dark:border-orange-900/50">
                <label className="block text-xs font-bold uppercase text-orange-800 dark:text-orange-300 mb-1">
                  Opening Balance — Past Arrears (₹) <span className="text-[10px] font-normal normal-case text-slate-500">(Optional)</span>
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                  Enter any amount this member owed from before this software was used (from manual registers). This will be added to their total dues.
                </p>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="e.g. 1200 (12 months x 100)"
                    value={formData.openingBalance}
                    onChange={(e) => setFormData({ ...formData, openingBalance: parseFloat(e.target.value) || 0 })}
                    className="w-full pl-8 pr-3 py-2 text-sm font-semibold rounded-xl border border-orange-200 dark:border-orange-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-orange-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Madrasa Section */}
              <div className="p-4 rounded-xl border border-amber-200/70 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.hasMadrasa}
                    onChange={(e) => setFormData({ ...formData, hasMadrasa: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Member has Children enrolled in Madrasa
                  </span>
                </label>

                {formData.hasMadrasa && (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Number of Children
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={formData.madrasaChildrenCount}
                        onChange={(e) => setFormData({ ...formData, madrasaChildrenCount: parseInt(e.target.value) || 1 })}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Monthly Madrasa Fee (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.madrasaMonthlyFee}
                        onChange={(e) => setFormData({ ...formData, madrasaMonthlyFee: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
                  Notes / Student Names
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional remarks, names of students in madrasa, etc..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
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
                  {submitting ? 'Saving...' : editingMember ? 'Update Member' : 'Register Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
