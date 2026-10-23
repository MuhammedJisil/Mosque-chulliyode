import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../utils/api';
import { openWhatsAppDueReminder } from '../utils/whatsapp';
import { exportToPdf, exportFamilySurveyPdf } from '../utils/exportPdf';
import { exportToExcel } from '../utils/exportExcel';
import { formatDateDDMMYYYY } from '../utils/dateUtils';
import Pagination from '../components/Pagination';
import DivisionDropdown from '../components/DivisionDropdown';
import { PAYMENT_MODES, MONTH_NAMES } from '../utils/categoriesData';
import { useToast } from '../context/ToastContext';
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
  ShieldCheck,
  Eye,
  RotateCcw,
  Briefcase,
  Building,
  Hash,
  FileText,
  RotateCw
} from 'lucide-react';

export default function MembersPage() {
  const { toast } = useToast();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters & Debounced Search
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All'); // 'All', 'Active', 'Inactive', 'DueOnly'
  const [divisionFilter, setDivisionFilter] = useState('All');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [activePayingMember, setActivePayingMember] = useState(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyMember, setHistoryMember] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailMember, setDetailMember] = useState(null);
  const [detailYear, setDetailYear] = useState(new Date().getFullYear());

  // Form State for Add / Edit Member
  const initialForm = {
    name: '',
    phone: '',
    address: '',
    job: '',
    division: '',
    idNumber: '',
    hasFamily: false,
    adultsCount: 0,
    childrenCount: 0,
    familyDetails: '',
    joiningDate: new Date().toISOString().split('T')[0],
    endDate: '',
    monthlyDonation: 100,
    openingBalance: 0,
    status: 'Active',
    notes: '',
  };
  const [formData, setFormData] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Payment Form State
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const [selectedPaymentMonths, setSelectedPaymentMonths] = useState([]);
  const [paymentForm, setPaymentForm] = useState({
    paymentDate: new Date().toISOString().split('T')[0],
    month: currentMonth,
    year: currentYear,
    membershipAmount: 100,
    openingBalanceAmount: 0,
    paymentMode: PAYMENT_MODES[0],
    notes: '',
  });

  // Debounce search input: waits 350ms after user pauses continuous typing
  useEffect(() => {
    if (searchInput.trim() !== debouncedSearch) {
      setIsSearching(true);
    }
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setIsSearching(false);
    }, 350);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchMembers = async (query = debouncedSearch) => {
    try {
      setLoading(true);
      const res = await api.get('/api/members', {
        search: query ? query.trim() : undefined,
        status: statusFilter !== 'All' && statusFilter !== 'DueOnly' ? statusFilter : undefined,
        division: divisionFilter !== 'All' ? divisionFilter : undefined,
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
      setIsSearching(false);
    }
  };

  useEffect(() => {
    fetchMembers(debouncedSearch);
  }, [debouncedSearch, statusFilter, divisionFilter]);

  // Smart real-time search & prefix ranking
  const displayedMembers = useMemo(() => {
    const q = searchInput.trim().toLowerCase();
    if (!q) return members;

    return [...members]
      .filter(m => {
        const name = (m.name || '').toLowerCase();
        const phone = (m.phone || '').toLowerCase();
        const division = (m.division || '').toLowerCase();
        const idNumber = (m.idNumber || '').toLowerCase();
        const job = (m.job || '').toLowerCase();
        const address = (m.address || '').toLowerCase();
        return name.includes(q) || phone.includes(q) || division.includes(q) || idNumber.includes(q) || job.includes(q) || address.includes(q);
      })
      .sort((a, b) => {
        const aName = (a.name || '').toLowerCase();
        const bName = (b.name || '').toLowerCase();

        // 1. Full name starts with query (e.g. "Jisil..." when typing "j" or "ji")
        const aStarts = aName.startsWith(q);
        const bStarts = bName.startsWith(q);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;

        // 2. Any word in the name starts with query (e.g. "Muhammed Jisil" when typing "ji")
        const aWordStarts = aName.split(/\s+/).some(w => w.startsWith(q));
        const bWordStarts = bName.split(/\s+/).some(w => w.startsWith(q));
        if (aWordStarts && !bWordStarts) return -1;
        if (!aWordStarts && bWordStarts) return 1;

        // 3. Name contains query
        const aContains = aName.includes(q);
        const bContains = bName.includes(q);
        if (aContains && !bContains) return -1;
        if (!aContains && bContains) return 1;

        return aName.localeCompare(bName);
      });
  }, [members, searchInput]);

  // Unique divisions for filter dropdown
  const uniqueDivisions = useMemo(() => {
    const set = new Set();
    members.forEach(m => {
      if (m.division && m.division.trim()) set.add(m.division.trim());
    });
    return Array.from(set).sort();
  }, [members]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 15;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchInput, statusFilter, divisionFilter]);

  const paginatedMembers = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return displayedMembers.slice(startIndex, startIndex + PAGE_SIZE);
  }, [displayedMembers, currentPage]);

  const handleOpenAdd = () => {
    setEditingMember(null);
    setFormData(initialForm);
    setShowAddModal(true);
  };

  const handleOpenEdit = (m) => {
    setEditingMember(m);
    setFormData({
      name: m.name || '',
      phone: m.phone || '',
      address: m.address || '',
      job: m.job || '',
      division: m.division || '',
      idNumber: m.idNumber || '',
      hasFamily: Boolean(m.hasFamily),
      adultsCount: m.adultsCount !== undefined ? m.adultsCount : 0,
      childrenCount: m.childrenCount !== undefined ? m.childrenCount : 0,
      familyDetails: m.familyDetails || '',
      joiningDate: m.joiningDate ? new Date(m.joiningDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      endDate: m.endDate ? new Date(m.endDate).toISOString().split('T')[0] : '',
      monthlyDonation: m.monthlyDonation || 100,
      openingBalance: m.openingBalance || 0,
      status: m.status || 'Active',
      notes: m.notes || '',
    });
    setShowAddModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to remove this member and their payment records?')) return;
    try {
      await api.del(`/api/members/${id}`);
      toast.success('Member removed successfully');
      fetchMembers();
    } catch (err) {
      toast.error(err.message || 'Failed to delete member');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const isFamily = Boolean(formData.hasFamily);
      const isEndDateOver = formData.endDate && new Date(formData.endDate) <= new Date();
      const finalStatus = isEndDateOver ? 'Inactive' : formData.status;
      const payload = {
        ...formData,
        status: finalStatus,
        endDate: formData.endDate ? formData.endDate : null,
        hasFamily: isFamily,
        adultsCount: isFamily ? (parseInt(formData.adultsCount) || 0) : 0,
        childrenCount: isFamily ? (parseInt(formData.childrenCount) || 0) : 0,
        familyDetails: isFamily ? (formData.familyDetails || '') : '',
      };
      if (editingMember) {
        await api.put(`/api/members/${editingMember.id}`, payload);
        toast.success('Member details updated successfully');
      } else {
        await api.post('/api/members', payload);
        toast.success('New member registered successfully');
      }
      setShowAddModal(false);
      fetchMembers();
    } catch (err) {
      toast.error(err.message || 'Failed to save member details');
    } finally {
      setSubmitting(false);
    }
  };

  // Helper: Computes the covered months for a given payment amount
  // 1. First takes pending due months up to calculatedCount
  // 2. If entered amount is more than due months (or member has 0 dues), automatically adds consecutive future/advance months!
  const computeCoveredMonths = (member, amount) => {
    if (!member) return [];
    const rate = member.monthlyDonation || 100;
    if (rate <= 0) return [];
    const calculatedCount = Math.floor(amount / rate);
    if (calculatedCount <= 0) return [];

    const dueMonths = member.dueMonths || [];
    const selected = [];

    // 1. Take past due months first
    const duesToTake = Math.min(calculatedCount, dueMonths.length);
    for (let i = 0; i < duesToTake; i++) {
      selected.push(dueMonths[i]);
    }

    // 2. Add extra future months consecutively
    const extraCount = calculatedCount - duesToTake;
    if (extraCount > 0) {
      let lastM, lastY;
      if (selected.length > 0) {
        lastM = selected[selected.length - 1].month;
        lastY = selected[selected.length - 1].year;
      } else {
        // Find after latest payment or current month
        const sortedPayments = member.payments && member.payments.length > 0
          ? [...member.payments].filter(p => p.month > 0).sort((a, b) => (b.year - a.year) || (b.month - a.month))
          : [];
        if (sortedPayments.length > 0) {
          lastM = sortedPayments[0].month;
          lastY = sortedPayments[0].year;
        } else {
          lastM = currentMonth - 1;
          lastY = currentYear;
          if (lastM === 0) {
            lastM = 12;
            lastY -= 1;
          }
        }
      }

      for (let i = 0; i < extraCount; i++) {
        lastM += 1;
        if (lastM > 12) {
          lastM = 1;
          lastY += 1;
        }
        selected.push({
          month: lastM,
          year: lastY,
          label: `${MONTH_NAMES[lastM - 1]} ${lastY} (Advance)`
        });
      }
    }

    return selected;
  };

  // Open Payment Modal (Supports both past dues & automatic future/advance payments)
  const handleOpenPayment = (m) => {
    setActivePayingMember(m);
    const rate = m.monthlyDonation || 100;
    let initialDue = [];

    if (m.dueMonths && m.dueMonths.length > 0) {
      initialDue = [...m.dueMonths];
    } else {
      initialDue = computeCoveredMonths(m, rate);
    }

    setSelectedPaymentMonths(initialDue);
    const initialMonthsCount = initialDue.length;
    const initialMembership = initialMonthsCount * rate;
    const labels = initialDue.map(d => d.label).join(', ');

    setPaymentForm({
      paymentDate: new Date().toISOString().split('T')[0],
      month: initialDue[0] ? initialDue[0].month : currentMonth,
      year: initialDue[0] ? initialDue[0].year : currentYear,
      membershipAmount: initialMembership,
      openingBalanceAmount: 0,
      paymentMode: 'Cash in Hand',
      notes: initialDue.length > 0 ? `Subscription paid for ${labels}` : `Opening balance payment`,
    });
    setShowPaymentModal(true);
  };

  // Toggle selection of pending due months
  const handleToggleDueMonth = (due) => {
    if (!activePayingMember) return;
    const isSelected = selectedPaymentMonths.some(d => d.month === due.month && d.year === due.year);
    let nextSelected;
    if (isSelected) {
      nextSelected = selectedPaymentMonths.filter(d => !(d.month === due.month && d.year === due.year));
    } else {
      nextSelected = [...selectedPaymentMonths, due];
    }
    setSelectedPaymentMonths(nextSelected);

    // Automatically recalculate amounts!
    const count = nextSelected.length;
    const rate = activePayingMember.monthlyDonation || 100;
    const newMembership = count * rate;

    const labels = nextSelected.map(d => d.label).join(', ');
    setPaymentForm(prev => ({
      ...prev,
      membershipAmount: newMembership,
      month: nextSelected[0] ? nextSelected[0].month : prev.month,
      year: nextSelected[0] ? nextSelected[0].year : prev.year,
      notes: count > 0 ? `Subscription paid for ${labels}` : prev.notes,
    }));
  };

  // Bidirectional: When user edits membership amount (e.g. types 200, 300, 400 - auto-advances future months)
  const handleMembershipAmountChange = (val) => {
    const amount = parseFloat(val) || 0;
    if (!activePayingMember) {
      setPaymentForm(prev => ({ ...prev, membershipAmount: val }));
      return;
    }

    const selected = computeCoveredMonths(activePayingMember, amount);
    setSelectedPaymentMonths(selected);
    const labels = selected.map(d => d.label).join(', ');

    setPaymentForm(prev => ({
      ...prev,
      membershipAmount: val,
      month: selected[0] ? selected[0].month : prev.month,
      year: selected[0] ? selected[0].year : prev.year,
      notes: selected.length > 0 ? `Subscription paid for ${labels}` : prev.notes,
    }));
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!activePayingMember || submittingPayment) return;
    setSubmittingPayment(true);
    try {
      const payload = {
        ...paymentForm,
        months: selectedPaymentMonths.map(d => ({ month: d.month, year: d.year }))
      };
      await api.post(`/api/members/${activePayingMember.id}/payments`, payload);
      setShowPaymentModal(false);
      toast.success(`Payment recorded for ${activePayingMember.name} and logged in Income!`);
      fetchMembers();
    } catch (err) {
      toast.error(err.message || 'Failed to record payment');
    } finally {
      setSubmittingPayment(false);
    }
  };

  // Group historyMember.payments by receiptNo (for multi-month batches) or single ID
  const groupedHistoryPayments = useMemo(() => {
    if (!historyMember || !historyMember.payments || historyMember.payments.length === 0) return [];

    const groups = new Map();
    // Sort descending by paymentDate or id
    const sorted = [...historyMember.payments].sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate) || b.id - a.id);

    for (const p of sorted) {
      const key = p.receiptNo ? `rcp_${p.receiptNo}` : `single_${p.id}`;
      if (!groups.has(key)) {
        groups.set(key, {
          id: p.id,
          receiptNo: p.receiptNo,
          paymentDate: p.paymentDate,
          paymentMode: p.paymentMode,
          notes: p.notes,
          totalAmount: 0,
          membershipAmount: 0,
          madrasaAmount: 0,
          openingBalanceAmount: 0,
          items: [],
        });
      }
      const group = groups.get(key);
      group.totalAmount += Number(p.totalAmount || 0);
      group.membershipAmount += Number(p.membershipAmount || 0);
      group.madrasaAmount += Number(p.madrasaAmount || 0);
      group.openingBalanceAmount += Number(p.openingBalanceAmount || 0);
      group.items.push(p);
    }

    return Array.from(groups.values()).map(g => {
      const monthItems = g.items.filter(item => item.month > 0).sort((a, b) => (a.year - b.year) || (a.month - b.month));
      let label = '';
      if (monthItems.length > 1) {
        const monthNames = monthItems.map(m => `${MONTH_NAMES[m.month - 1]} ${m.year}`);
        label = `${monthItems.length} Months (${monthNames.join(', ')})`;
      } else if (monthItems.length === 1) {
        label = `${MONTH_NAMES[monthItems[0].month - 1]} ${monthItems[0].year}`;
      } else {
        label = `Opening Balance / Fee Payment`;
      }
      return {
        ...g,
        label,
      };
    });
  }, [historyMember]);

  // Revert / Delete Member Payment (supports single or multi-month batch)
  const handleRevertPayment = async (paymentId, amount, label) => {
    if (!historyMember) return;
    if (!window.confirm(`Are you sure you want to revert payment of ₹${amount} for ${label}? This will also delete the corresponding Income entry.`)) {
      return;
    }
    try {
      const res = await api.delete(`/api/members/${historyMember.id}/payments/${paymentId}`);
      if (res.success) {
        toast.success(res.message || 'Payment reverted and removed from Income!');
        setShowHistoryModal(false);
        fetchMembers();
      } else {
        toast.error(res.message || 'Failed to revert payment');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to revert payment');
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
    const columns = ['Name', 'Phone', 'Area / Division', 'Monthly Fee', 'Opening Balance', 'Due Months', 'Total Due (₹)'];
    const rows = displayedMembers.map(m => [
      m.name,
      m.phone || '-',
      m.division || '-',
      '₹' + m.monthlyDonation,
      `₹${m.openingBalance || 0}${m.netOpeningBalanceDue > 0 ? ` (Due: ₹${m.netOpeningBalanceDue})` : ' (Clear)'}`,
      m.dueMonthsCount > 0 ? `${m.dueMonthsCount} Mo (${m.dueMonthsNames || ''})` : 'Clear',
      '₹' + Number(m.totalDueAmount || 0).toLocaleString('en-IN'),
    ]);

    const totalDues = displayedMembers.reduce((acc, m) => acc + (m.totalDueAmount || 0), 0);
    const totalOpeningBalDue = displayedMembers.reduce((acc, m) => acc + (m.netOpeningBalanceDue || 0), 0);

    exportToPdf({
      title: 'Masjid al noor - Member Subscriptions & Due Report',
      subtitle: `sirajul huda sangam chulliyode • Total Members: ${displayedMembers.length}`,
      dateRange: 'Current Status',
      columns,
      rows,
      summaryRows: [
        { label: 'Total Opening Balance Due:', value: '₹' + Number(totalOpeningBalDue).toLocaleString('en-IN') },
        { label: 'Total Outstanding Dues:', value: '₹' + Number(totalDues).toLocaleString('en-IN'), bold: true, highlight: true }
      ],
      fileName: 'Masjid_Al_Noor_Members_Due_Report.pdf'
    });
  };

  // Export Members to Excel
  const handleExportExcel = () => {
    const excelRows = displayedMembers.map(m => ({
      'Name': m.name,
      'Phone': m.phone,
      'Area / Division': m.division || '',
      'Address': m.address || '',
      'Joining Date': formatDateDDMMYYYY(m.joiningDate),
      'Monthly Donation (INR)': m.monthlyDonation,
      'Opening Balance (INR)': m.openingBalance || 0,
      'Opening Balance Due (INR)': m.netOpeningBalanceDue || 0,
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

  // Dedicated Mahallu Family Census & Survey PDF Export
  const handleExportSurveyPdf = () => {
    exportFamilySurveyPdf({
      members: displayedMembers,
      division: divisionFilter !== 'All' ? divisionFilter : 'All Divisions / Areas',
      fileName: `Mahallu_Family_Survey_${divisionFilter !== 'All' ? divisionFilter.replace(/\s+/g, '_') : 'All'}.pdf`
    });
  };

  const totalDuesAll = useMemo(() => displayedMembers.reduce((acc, m) => acc + (m.totalDueAmount || 0), 0), [displayedMembers]);

  // hasDues also accounts for opening balance arrears
  const getMemberHasDues = (m) => m.dueMonthsCount > 0 || (m.netOpeningBalanceDue || 0) > 0;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            Mahallu Members
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-semibold">
              {displayedMembers.length} {displayedMembers.length === 1 ? 'Member' : 'Members'}
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Monthly membership subscriptions (₹100 default), pending dues, family census & 1-click WhatsApp alerts
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExportSurveyPdf}
            className="p-2 sm:px-3 sm:py-2 rounded-xl border border-blue-200 dark:border-blue-800/60 bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/40 shadow-xs flex items-center gap-1.5 transition-all"
            title="Download Family Survey & Census PDF Report"
          >
            <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="hidden sm:inline">Family Survey PDF</span>
          </button>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
          {/* Search with Real-Time Debounced Indicator & Clear Button */}
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search member by name, phone, division, ID, job..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  setDebouncedSearch(searchInput.trim());
                }
              }}
              className="w-full pl-9 pr-9 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  setDebouncedSearch('');
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            {isSearching && (
              <span className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none">
                <RotateCw className="w-3.5 h-3.5 text-emerald-500 animate-spin" />
              </span>
            )}
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active Only</option>
              <option value="Inactive">Inactive Only</option>
              <option value="DueOnly">⚠️ Members with Pending Dues</option>
            </select>
          </div>

          {/* Division / Area Filter */}
          <div>
            <select
              value={divisionFilter}
              onChange={(e) => setDivisionFilter(e.target.value)}
              className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="All">All Divisions / Areas</option>
              {uniqueDivisions.map((div, i) => (
                <option key={i} value={div}>{div}</option>
              ))}
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
        ) : displayedMembers.length === 0 ? (
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
                {/* Top Row: Name, Status, Badges & Action Icons */}
                <div className="flex items-start justify-between gap-2">
                  <div className="cursor-pointer flex-1" onClick={() => handleOpenDetails(m)}>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {m.idNumber && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800/80">
                          #{m.idNumber}
                        </span>
                      )}
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
                      {m.endDate && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                          Left: {formatDateDDMMYYYY(m.endDate)}
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2 mt-1">
                      {m.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {m.phone}
                        </span>
                      )}
                      {m.division && (
                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded text-[10px] font-medium">
                          <Building className="w-2.5 h-2.5" />
                          {m.division}
                        </span>
                      )}
                      {m.job && (
                        <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px]">
                          <Briefcase className="w-2.5 h-2.5 text-slate-400" />
                          {m.job}
                        </span>
                      )}
                      {(m.hasFamily || ((m.adultsCount || 0) + (m.childrenCount || 0) > 0)) && (
                        <span className="inline-flex items-center gap-1 text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                          <Users className="w-2.5 h-2.5" />
                          Family: {(m.adultsCount || 0) + (m.childrenCount || 0)} ({m.adultsCount || 0} Adults, {m.childrenCount || 0} Kids)
                        </span>
                      )}
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

                    {/* Pay Button (Always clickable for dues or advance payments) */}
                    <button
                      type="button"
                      onClick={() => handleOpenPayment(m)}
                      className={`p-2 rounded-xl transition-all ${
                        hasDues
                          ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-xs'
                          : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100'
                      }`}
                      title={hasDues ? 'Record Payment' : 'Pay in advance'}
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

                    {/* View Member Details & Monthly Dues Tracker */}
                    <button
                      type="button"
                      onClick={() => handleOpenDetails(m)}
                      className="p-2 rounded-xl text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                      title="View Details & Monthly Tracker"
                    >
                      <Eye className="w-4 h-4" />
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

                    {/* Delete button on mobile */}
                    <button
                      type="button"
                      onClick={() => handleDelete(m.id)}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      title="Delete Member"
                    >
                      <Trash2 className="w-4 h-4" />
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
                    <span className="text-[10px] uppercase text-slate-400 block font-semibold">Area / Division</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {m.division || '-'}
                    </span>
                  </div>
                  {(m.openingBalance || 0) > 0 && (
                    <div className="col-span-2">
                      <span className="text-[10px] uppercase text-slate-400 block font-semibold">Opening Balance</span>
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
                    <button
                      type="button"
                      onClick={() => handleOpenHistory(m)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
                      title="All subscriptions paid - Click to view history or revert payment"
                    >
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>All Paid <span className="underline font-normal text-[11px]">(History / Revert)</span></span>
                    </button>
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
            totalItems={displayedMembers.length}
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
                <th className="py-3.5 px-4">Area / Division</th>
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
              ) : displayedMembers.length === 0 ? (
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
                        <div className="flex items-center gap-2 flex-wrap">
                          {m.idNumber && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800/80">
                              #{m.idNumber}
                            </span>
                          )}
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
                          {m.endDate && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              Left: {formatDateDDMMYYYY(m.endDate)}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-2 mt-1">
                          {m.phone && <span>📞 {m.phone}</span>}
                          {m.job && (
                            <span className="inline-flex items-center gap-1 text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                              <Briefcase className="w-2.5 h-2.5" />
                              {m.job}
                            </span>
                          )}
                          {(m.hasFamily || ((m.adultsCount || 0) + (m.childrenCount || 0) > 0)) && (
                            <span className="inline-flex items-center gap-1 text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 px-1.5 py-0.5 rounded font-semibold text-[10px]">
                              <Users className="w-2.5 h-2.5" />
                              Family: {(m.adultsCount || 0) + (m.childrenCount || 0)} ({m.adultsCount || 0} Adults, {m.childrenCount || 0} Kids)
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          ₹{m.monthlyDonation}
                        </span>
                        <span className="text-[10px] text-slate-400"> / mo</span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {m.division ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md font-medium text-xs">
                            <Building className="w-3 h-3" />
                            {m.division}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">-</span>
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
                            + Opening Balance due: ₹{Number(m.netOpeningBalanceDue).toLocaleString('en-IN')}
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

                      {/* Record Payment Button (or Advance Payment + History / Revert) */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenPayment(m)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                              hasDues
                                ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 hover:bg-amber-100'
                                : 'border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
                            }`}
                            title={hasDues ? 'Record Payment' : 'Pay upcoming months in advance'}
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>{hasDues ? 'Pay' : 'Advance'}</span>
                          </button>
                          {!hasDues && (
                            <button
                              type="button"
                              onClick={() => handleOpenHistory(m)}
                              className="px-2 py-1.5 rounded-xl text-[11px] text-emerald-600 hover:text-emerald-700 underline font-normal"
                              title="View History / Revert"
                            >
                              History
                            </button>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => handleOpenDetails(m)}
                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors"
                            title="View Member Details & Monthly Tracker"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenHistory(m)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors"
                            title="View Payment History & Revert"
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
          totalItems={displayedMembers.length}
          pageSize={PAGE_SIZE}
          onPageChange={setCurrentPage}
          className="p-4"
        />
      </div>

      {/* ======================================================== */}
      {/* MODALS                                                    */}
      {/* ======================================================== */}

      {/* Record Monthly Payment Modal */}
      {showPaymentModal && activePayingMember && createPortal(
        <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/60 backdrop-blur-sm p-3 sm:p-6 flex min-h-full items-start justify-center animate-fade-in">
          <div className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full my-6 sm:my-10 p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shrink-0 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Record Monthly Payment
                </h3>
                <p className="text-xs text-emerald-600 font-semibold">{activePayingMember.name} • ₹{activePayingMember.monthlyDonation || 100}/mo</p>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="py-4 space-y-4">
              {/* Multi-Month Due Selector (Past / Overdue) */}
              {activePayingMember.dueMonths && activePayingMember.dueMonths.length > 0 ? (
                <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/40">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold uppercase text-emerald-800 dark:text-emerald-300">
                      Pending Dues to Pay:
                    </label>
                    <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                      {selectedPaymentMonths.length} month(s) selected
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1">
                    {activePayingMember.dueMonths.map((due, idx) => {
                      const isSelected = selectedPaymentMonths.some(d => d.month === due.month && d.year === due.year);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleToggleDueMonth(due)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
                          }`}
                        >
                          <input
                            type="checkbox"
                            readOnly
                            checked={isSelected}
                            className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-0 pointer-events-none"
                          />
                          {due.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>All past subscription dues are cleared! You can add advance payments for upcoming months or future years below.</span>
                </div>
              )}

              {/* Automatically Allocated Months Breakdown */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Allocated Months ({selectedPaymentMonths.length})</span>
                  </span>
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    Automatically calculated
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Entering an amount greater than dues automatically adds future months consecutively.
                </p>

                {selectedPaymentMonths.length > 0 ? (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                    {selectedPaymentMonths.map((mItem, idx) => {
                      const isAdvance = mItem.label && mItem.label.includes('Advance');
                      return (
                        <span
                          key={idx}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
                            isAdvance
                              ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800'
                              : 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
                          }`}
                        >
                          <span>{mItem.label || `${MONTH_NAMES[mItem.month - 1]} ${mItem.year}`}</span>
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-[11px] text-amber-600 dark:text-amber-400 italic">
                    Enter membership amount above or select dues to allocate payment.
                  </div>
                )}
              </div>

              {/* Amounts */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Membership Amount (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={paymentForm.membershipAmount}
                  onChange={(e) => handleMembershipAmountChange(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                {selectedPaymentMonths.length > 0 && (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                    Paying for {selectedPaymentMonths.length} month(s)
                  </span>
                )}
              </div>

              {/* Opening Balance Payment */}
              {(activePayingMember.netOpeningBalanceDue || 0) > 0 && (
                <div className="p-3 bg-orange-50 dark:bg-orange-950/30 rounded-xl border border-orange-200 dark:border-orange-800/60">
                  <div className="text-xs font-bold text-orange-800 dark:text-orange-300 mb-1.5">
                    Opening Balance Due: ₹{Number(activePayingMember.netOpeningBalanceDue).toLocaleString('en-IN')}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-600 dark:text-slate-400 font-medium whitespace-nowrap">Pay Opening Balance (₹):</label>
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
                  ₹{(parseFloat(paymentForm.membershipAmount || 0) + parseFloat(paymentForm.openingBalanceAmount || 0)).toLocaleString('en-IN')}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Payment Date <span className="text-emerald-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={paymentForm.paymentDate || new Date().toISOString().split('T')[0]}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                    Change if recording past payment
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
                  disabled={submittingPayment}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl shadow-md transition-all"
                >
                  <Check className="w-4 h-4" />
                  {submittingPayment ? 'Recording...' : 'Confirm & Sync to Income'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Member Details & Monthly Subscription Tracker Modal */}
      {showDetailModal && detailMember && createPortal(
        <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/60 backdrop-blur-sm p-3 sm:p-6 flex min-h-full items-start justify-center animate-fade-in">
          <div className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-xl w-full p-5 sm:p-6 border border-slate-200 dark:border-slate-800 my-6 sm:my-10 shrink-0 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    Member Details & Monthly Status
                  </h3>
                  <span className="text-xs text-slate-400">ID #{detailMember.id} • {detailMember.name}</span>
                </div>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4 text-xs">
              {/* Member Profile Summary */}
              <div className="p-3.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-base text-slate-900 dark:text-white">{detailMember.name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      detailMember.status === 'Active'
                        ? 'bg-emerald-100 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-200'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}>
                      {detailMember.status}
                    </span>
                  </div>
                  <div className="text-slate-600 dark:text-slate-300 mt-1 flex flex-wrap items-center gap-3">
                    <span>📞 {detailMember.phone || 'No phone recorded'}</span>
                    {detailMember.address && <span>📍 {detailMember.address}</span>}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                    <span>Joined: {formatDateDDMMYYYY(detailMember.joiningDate)}</span>
                    {detailMember.endDate && (
                      <span className="text-amber-600 dark:text-amber-400 font-semibold">
                        • Left Mahallu: {formatDateDDMMYYYY(detailMember.endDate)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {detailMember.phone && (
                    <button
                      type="button"
                      onClick={() => openWhatsAppDueReminder(detailMember)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-700 shadow-sm"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      WhatsApp
                    </button>
                  )}
                </div>
              </div>

              {/* Family Census & Mahallu Survey Details */}
              <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/50 space-y-2">
                <span className="text-[10px] uppercase font-bold text-blue-900 dark:text-blue-300 block">
                  Family Census & Mahallu Survey Details
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-700 dark:text-slate-300">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">ID / House No:</span>
                    <span className="font-bold">{detailMember.idNumber || 'None'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Division / Area:</span>
                    <span className="font-bold">{detailMember.division || 'Not specified'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Job / Profession:</span>
                    <span className="font-bold">{detailMember.job || 'Not specified'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Family Members:</span>
                    <span className="font-bold">
                      {detailMember.hasFamily
                        ? `${detailMember.adultsCount || 0} Adults, ${detailMember.childrenCount || 0} Kids`
                        : 'Single / None'}
                    </span>
                  </div>
                </div>
                {detailMember.hasFamily && detailMember.familyDetails && (
                  <div className="pt-1 border-t border-blue-100 dark:border-blue-900/40 text-[11px]">
                    <span className="font-semibold text-slate-500 dark:text-slate-400">Members & Ages: </span>
                    <span className="text-slate-800 dark:text-slate-200">{detailMember.familyDetails}</span>
                  </div>
                )}
              </div>

              {/* Remarks / Notes added when creating member */}
              <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/50">
                <span className="text-[10px] uppercase font-bold text-amber-800 dark:text-amber-400 block mb-1">
                  Registration Remarks / Notes
                </span>
                <p className="text-xs text-slate-700 dark:text-slate-300 font-medium whitespace-pre-wrap">
                  {detailMember.notes?.trim() ? detailMember.notes : 'No remarks recorded during registration.'}
                </p>
              </div>

              {/* Financial Quick Breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80">
                  <span className="text-[10px] uppercase text-slate-400 block font-semibold">Monthly Donation</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">₹{detailMember.monthlyDonation}</span>
                  <span className="text-[10px] text-slate-400"> / mo</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80">
                  <span className="text-[10px] uppercase text-slate-400 block font-semibold">Area / Division</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                    {detailMember.division || '-'}
                  </span>
                  <span className="text-[10px] text-slate-400 block">{detailMember.status || 'Active'}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80">
                  <span className="text-[10px] uppercase text-slate-400 block font-semibold">Opening Balance</span>
                  <span className="font-bold text-orange-600 dark:text-orange-400 text-sm">
                    ₹{detailMember.netOpeningBalanceDue || 0}
                  </span>
                  <span className="text-[10px] text-slate-400 block">of ₹{detailMember.openingBalance || 0}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80">
                  <span className="text-[10px] uppercase text-slate-400 block font-semibold">Total Outstanding</span>
                  <span className={`font-extrabold text-sm ${detailMember.totalDueAmount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600'}`}>
                    ₹{Number(detailMember.totalDueAmount || 0).toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    {detailMember.dueMonthsCount > 0 ? `${detailMember.dueMonthsCount} month(s) due` : 'Up to date'}
                  </span>
                </div>
              </div>

              {/* Monthly Subscription Status: Paid vs Unpaid Grid */}
              <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
                      Monthly Payment Status ({detailYear})
                    </h4>
                  </div>
                  <select
                    value={detailYear}
                    onChange={(e) => setDetailYear(parseInt(e.target.value))}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none"
                  >
                    {[currentYear + 1, currentYear, currentYear - 1, currentYear - 2].map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>

                {/* 12-Month Grid: Shows Paid vs Unpaid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {MONTH_NAMES.map((name, i) => {
                    const mNum = i + 1;
                    const payment = (detailMember.payments || []).find(p => p.year === detailYear && p.month === mNum);
                    const isDue = (detailMember.dueMonths || []).some(d => d.year === detailYear && d.month === mNum);
                    const isFuture = (detailYear > currentYear) || (detailYear === currentYear && mNum > currentMonth);
                    const joinDate = new Date(detailMember.joiningDate);
                    const isPrior = detailYear < joinDate.getFullYear() || (detailYear === joinDate.getFullYear() && mNum < (joinDate.getMonth() + 1));

                    let badgeClass = '';
                    let statusLabel = '';
                    let IconComp = CheckCircle2;

                    if (payment) {
                      badgeClass = 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-300';
                      statusLabel = `Paid (₹${payment.totalAmount})`;
                      IconComp = CheckCircle2;
                    } else if (isDue) {
                      badgeClass = 'bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-800/80 text-rose-700 dark:text-rose-300';
                      statusLabel = `Unpaid (₹${detailMember.monthlyDonation})`;
                      IconComp = AlertCircle;
                    } else if (isFuture) {
                      badgeClass = 'bg-slate-100/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400';
                      statusLabel = 'Upcoming';
                      IconComp = Calendar;
                    } else if (isPrior) {
                      badgeClass = 'bg-slate-100/50 dark:bg-slate-800/20 border-slate-200/50 dark:border-slate-800/50 text-slate-400';
                      statusLabel = 'Before Joining';
                      IconComp = Info;
                    } else {
                      badgeClass = 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300';
                      statusLabel = 'Cleared';
                      IconComp = CheckCircle2;
                    }

                    return (
                      <div
                        key={mNum}
                        className={`p-2 rounded-xl border flex flex-col justify-between min-h-[58px] transition-all ${badgeClass}`}
                      >
                        <div className="flex items-center justify-between font-bold text-xs">
                          <span>{name}</span>
                          <IconComp className="w-3.5 h-3.5 shrink-0" />
                        </div>
                        <div className="text-[10px] font-semibold truncate mt-1">
                          {statusLabel}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowDetailModal(false);
                  handleOpenHistory(detailMember);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800 rounded-xl transition-colors shadow-xs"
              >
                <History className="w-4 h-4" />
                <span>Payment History & Revert</span>
              </button>

              <div className="flex items-center gap-2">
                {(detailMember.dueMonthsCount > 0 || (detailMember.netOpeningBalanceDue || 0) > 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowDetailModal(false);
                      handleOpenPayment(detailMember);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    Record Payment
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Payment History & Revert Modal */}
      {showHistoryModal && historyMember && createPortal(
        <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/60 backdrop-blur-sm p-3 sm:p-6 flex min-h-full items-start justify-center animate-fade-in">
          <div className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-lg w-full p-5 sm:p-6 border border-slate-200 dark:border-slate-800 my-6 sm:my-10 shrink-0 max-h-[88vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Payment History & Revert
                </h3>
                <p className="text-xs text-slate-500">{historyMember.name} • {historyMember.phone || 'No phone'}</p>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 overflow-y-auto flex-1 space-y-2.5">
              {groupedHistoryPayments.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">No previous payments recorded for this member.</p>
              ) : (
                groupedHistoryPayments.map((g) => (
                  <div key={g.id} className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 text-xs transition-all hover:border-slate-300 dark:hover:border-slate-700">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-800 dark:text-slate-100 flex flex-wrap items-center gap-1.5">
                        <span className="truncate">{g.label}</span>
                        {g.items.length > 1 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 whitespace-nowrap">
                            {g.items.length} Months Batch
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        {g.paymentMode} • {formatDateDDMMYYYY(g.paymentDate)}
                        {g.receiptNo && <span className="ml-1.5 font-mono text-[10px] text-slate-400">({g.receiptNo})</span>}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {g.membershipAmount > 0 && `Membership: ₹${g.membershipAmount} `}
                        {g.openingBalanceAmount > 0 && `• Opening Bal: ₹${g.openingBalanceAmount}`}
                      </div>
                      {g.notes && (
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 italic mt-0.5 truncate">
                          Remarks: {g.notes}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                          ₹{g.totalAmount.toLocaleString('en-IN')}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRevertPayment(g.id, g.totalAmount, g.label)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-rose-600 hover:text-white hover:bg-rose-600 dark:text-rose-400 dark:hover:text-white dark:hover:bg-rose-600 rounded-xl transition-all border border-rose-200 dark:border-rose-900/40 text-xs font-bold shadow-xs active:scale-95"
                        title="Revert Payment (removes linked Income)"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Revert</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Add / Edit Member Modal */}
      {showAddModal && createPortal(
        <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/60 backdrop-blur-sm p-3 sm:p-6 flex min-h-full items-start justify-center animate-fade-in">
          <div className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-lg w-full my-6 sm:my-10 p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shrink-0 max-h-[90vh] overflow-y-auto">
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
                    Phone (WhatsApp) <span className="text-[10px] font-normal lowercase text-slate-400">(optional)</span>
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. 9845012345"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* ID Number, Division / Area, and Job Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
                    ID / House No. <span className="text-[10px] text-slate-400 font-normal lowercase">(optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. M-104 or H-12"
                    value={formData.idNumber}
                    onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <DivisionDropdown
                    label="Division / Area"
                    value={formData.division}
                    onChange={(val) => setFormData({ ...formData, division: val })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Job / Profession
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Teacher, Business"
                    value={formData.job}
                    onChange={(e) => setFormData({ ...formData, job: e.target.value })}
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

              {/* Leaving / Relocation End Date */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300">
                    Leaving / Relocation Date <span className="text-[10px] font-normal normal-case text-slate-400">(Optional)</span>
                  </label>
                  {formData.endDate && (
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, endDate: '', status: 'Active' }))}
                      className="text-[11px] text-rose-500 hover:underline font-medium"
                    >
                      Clear Date
                    </button>
                  )}
                </div>
                <input
                  type="date"
                  value={formData.endDate || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    const isOver = val && new Date(val) <= new Date();
                    setFormData(prev => ({
                      ...prev,
                      endDate: val,
                      status: isOver ? 'Inactive' : prev.status
                    }));
                  }}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  If member stopped or moved to another mahallu, enter their end date. Dues calculation will stop at this month and no further monthly dues will accrue.
                </p>
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

              {/* Opening Balance */}
              <div className="p-3.5 rounded-xl bg-orange-50/60 dark:bg-orange-950/20 border border-orange-200/70 dark:border-orange-900/50">
                <label className="block text-xs font-bold uppercase text-orange-800 dark:text-orange-300 mb-1">
                  Opening Balance (₹) <span className="text-[10px] font-normal normal-case text-slate-500">(Optional)</span>
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                  Enter any initial unpaid balance this member had before starting with this software. This is tracked in their opening balance dues.
                </p>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="e.g. 1200"
                    value={formData.openingBalance}
                    onChange={(e) => setFormData({ ...formData, openingBalance: parseFloat(e.target.value) || 0 })}
                    className="w-full pl-8 pr-3 py-2 text-sm font-semibold rounded-xl border border-orange-200 dark:border-orange-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-orange-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Family Members & Survey Section (Census) */}
              <div className="p-4 rounded-xl border border-blue-200/70 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.hasFamily}
                    onChange={(e) => setFormData({ ...formData, hasFamily: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Add Family Members & Census Survey Details
                  </span>
                </label>

                {formData.hasFamily && (
                  <div className="space-y-3 pt-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                          Adults Count (incl. Member)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={formData.adultsCount}
                          onChange={(e) => setFormData({ ...formData, adultsCount: parseInt(e.target.value) || 0 })}
                          className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                          Children Count
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={formData.childrenCount}
                          onChange={(e) => setFormData({ ...formData, childrenCount: parseInt(e.target.value) || 0 })}
                          className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Family Members Details & Ages
                      </label>
                      <textarea
                        rows={2}
                        placeholder="e.g. Wife: Amina (38), Son: Rashid (14), Daughter: Fatima (9)..."
                        value={formData.familyDetails}
                        onChange={(e) => setFormData({ ...formData, familyDetails: e.target.value })}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
                  placeholder="Optional remarks, notes or family background..."
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
        </div>,
        document.body
      )}
    </div>
  );
}
