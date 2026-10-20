import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  Plus,
  Filter,
  Download,
  Phone,
  Building,
  Briefcase,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Edit,
  Trash2,
  IndianRupee,
  Users,
  Check,
  X,
  FileSpreadsheet,
  FileText,
  MessageCircle,
  History,
  Undo2,
  GraduationCap,
  Info,
  UserCheck,
  Receipt
} from 'lucide-react';
import { api } from '../utils/api';
import { exportToPdf } from '../utils/exportPdf';
import { exportToExcel } from '../utils/exportExcel';
import { PAYMENT_MODES } from '../utils/categoriesData';
import { openWhatsAppMadrasaDueReminder } from '../utils/whatsapp';
import { useToast } from '../context/ToastContext';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function MadrasaPage() {
  const { toast } = useToast();

  const [students, setStudents] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedDivision, setSelectedDivision] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [activePayingStudent, setActivePayingStudent] = useState(null);

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyStudent, setHistoryStudent] = useState(null);

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailStudent, setDetailStudent] = useState(null);
  const [detailYear, setDetailYear] = useState(new Date().getFullYear());

  // Search inside Add/Edit modal for Mahallu Member
  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);

  // Form State: Simplified Parent/Member model
  const initialForm = {
    memberId: '',
    parentName: '',
    parentPhone: '',
    job: '',
    division: '',
    studentsCount: 1,
    feePerStudent: 200,
    monthlyFee: 200,
    openingBalance: 0,
    admissionDate: new Date().toISOString().split('T')[0],
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
    month: currentMonth,
    year: currentYear,
    feeAmount: 200,
    openingBalanceAmount: 0,
    paymentMode: PAYMENT_MODES[0],
    notes: '',
  });

  // Advance Month Adder State in Payment Modal
  const [customAdvanceMonth, setCustomAdvanceMonth] = useState(currentMonth);
  const [customAdvanceYear, setCustomAdvanceYear] = useState(currentYear);

  // Debounced search handling
  const timerRef = useRef(null);
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearch(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedSearch(val);
    }, 280);
  };

  useEffect(() => {
    fetchStudents();
  }, [debouncedSearch, selectedDivision]);

  useEffect(() => {
    fetchMembersList();
  }, []);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (selectedDivision !== 'All') params.append('division', selectedDivision);

      const res = await api.get(`/api/madrasa?${params.toString()}`);
      if (res.success) {
        setStudents(res.students || []);
      }
    } catch (err) {
      toast.error('Failed to load madrasa records');
    } finally {
      setLoading(false);
    }
  };

  const fetchMembersList = async () => {
    try {
      const res = await api.get('/api/members');
      if (res.success) {
        setMembers(res.members || []);
      }
    } catch (err) {
      console.error('Failed to load members for madrasa selector', err);
    }
  };

  // Distinct divisions list
  const divisions = useMemo(() => {
    const set = new Set();
    students.forEach((s) => {
      const div = s.division || s.member?.division;
      if (div && div.trim()) set.add(div.trim());
    });
    members.forEach((m) => {
      if (m.division && m.division.trim()) set.add(m.division.trim());
    });
    return Array.from(set).sort();
  }, [students, members]);

  // Filtered by status
  const displayedStudents = useMemo(() => {
    return students.filter(s => {
      if (statusFilter === 'Active') return s.status === 'Active';
      if (statusFilter === 'Inactive') return s.status === 'Inactive';
      if (statusFilter === 'Has Dues') return s.dueMonthsCount > 0 || (s.netOpeningBalanceDue || 0) > 0;
      return true;
    });
  }, [students, statusFilter]);

  // Overall Statistics
  const stats = useMemo(() => {
    const totalParents = students.length;
    const activeParents = students.filter(s => s.status === 'Active').length;
    const totalKids = students
      .filter(s => s.status === 'Active')
      .reduce((acc, s) => acc + (s.studentsCount || 1), 0);
    const totalMonthlyFeePotential = students
      .filter(s => s.status === 'Active')
      .reduce((acc, s) => acc + (s.monthlyFee || 0), 0);
    const totalDuesAmount = students.reduce((acc, s) => acc + (s.totalDueAmount || 0), 0);
    const parentsWithDues = students.filter(s => (s.dueMonthsCount > 0 || (s.netOpeningBalanceDue || 0) > 0)).length;

    return {
      totalParents,
      activeParents,
      totalKids,
      totalMonthlyFeePotential,
      totalDuesAmount,
      parentsWithDues,
    };
  }, [students]);

  // Members search list for parent selector
  const filteredParentMembers = useMemo(() => {
    if (!memberSearchTerm.trim()) return members.slice(0, 15);
    const q = memberSearchTerm.toLowerCase().trim();
    return members.filter(m =>
      m.name?.toLowerCase().includes(q) ||
      m.phone?.includes(q) ||
      m.division?.toLowerCase().includes(q) ||
      m.job?.toLowerCase().includes(q) ||
      String(m.idNumber || '').includes(q)
    ).slice(0, 20);
  }, [members, memberSearchTerm]);

  // Select a member as parent -> Auto-prefill name, phone, job, division, joining date
  const handleSelectParentMember = (m) => {
    const count = formData.studentsCount || 1;
    const perStudent = formData.feePerStudent || 200;
    const autoFee = count * perStudent;

    const joiningDateStr = m.joiningDate
      ? new Date(m.joiningDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    setFormData(prev => ({
      ...prev,
      memberId: m.id,
      parentName: m.name || '',
      parentPhone: m.phone || '',
      job: m.job || '',
      division: m.division || '',
      admissionDate: joiningDateStr,
      monthlyFee: autoFee,
    }));
    setMemberSearchTerm(`${m.name}${m.phone ? ` (${m.phone})` : ''}`);
    setShowMemberDropdown(false);
  };

  // When number of students changes, automatically recalculate monthly fee
  const handleStudentsCountChange = (countVal) => {
    const count = Math.max(1, parseInt(countVal) || 1);
    const rate = parseFloat(formData.feePerStudent) || 200;
    setFormData(prev => ({
      ...prev,
      studentsCount: count,
      monthlyFee: count * rate,
    }));
  };

  // When fee per student changes, auto recalculate monthly fee
  const handleFeePerStudentChange = (rateVal) => {
    const rate = parseFloat(rateVal) || 0;
    const count = parseInt(formData.studentsCount) || 1;
    setFormData(prev => ({
      ...prev,
      feePerStudent: rateVal,
      monthlyFee: count * rate,
    }));
  };

  const handleOpenAddModal = () => {
    setEditingStudent(null);
    setFormData(initialForm);
    setMemberSearchTerm('');
    setShowMemberDropdown(false);
    setShowAddModal(true);
  };

  const handleOpenEdit = (s) => {
    setEditingStudent(s);
    setFormData({
      memberId: s.memberId || '',
      parentName: s.parentName || s.member?.name || '',
      parentPhone: s.parentPhone || s.member?.phone || '',
      job: s.job || s.member?.job || '',
      division: s.division || s.member?.division || '',
      studentsCount: s.studentsCount || 1,
      feePerStudent: s.feePerStudent || (s.studentsCount ? Math.round(s.monthlyFee / s.studentsCount) : 200),
      monthlyFee: s.monthlyFee !== undefined ? s.monthlyFee : 200,
      openingBalance: s.openingBalance || 0,
      admissionDate: s.admissionDate ? new Date(s.admissionDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      status: s.status || 'Active',
      notes: s.notes || '',
    });
    setMemberSearchTerm(s.member ? `${s.member.name} (${s.member.phone || 'No phone'})` : (s.parentName || ''));
    setShowMemberDropdown(false);
    setShowAddModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to remove this madrasa record? All linked monthly fee and income entries will be deleted.')) return;
    try {
      await api.del(`/api/madrasa/${id}`);
      toast.success('Madrasa record removed successfully');
      fetchStudents();
    } catch (err) {
      toast.error(err.message || 'Failed to delete record');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.parentName.trim()) {
      toast.error('Parent / Member name is required');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        memberId: formData.memberId ? parseInt(formData.memberId) : null,
        studentsCount: parseInt(formData.studentsCount) || 1,
        feePerStudent: parseFloat(formData.feePerStudent) || 200,
        monthlyFee: parseFloat(formData.monthlyFee) || 0,
        openingBalance: parseFloat(formData.openingBalance) || 0,
      };

      if (editingStudent) {
        await api.put(`/api/madrasa/${editingStudent.id}`, payload);
        toast.success('Madrasa record updated successfully');
      } else {
        await api.post('/api/madrasa', payload);
        toast.success('New madrasa record added successfully');
      }
      setShowAddModal(false);
      fetchStudents();
    } catch (err) {
      toast.error(err.message || 'Failed to save record');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Payment Modal
  const handleOpenPayment = (s) => {
    setActivePayingStudent(s);
    let initialDue = [];
    if (s.dueMonths && s.dueMonths.length > 0) {
      initialDue = [s.dueMonths[0]];
    } else {
      initialDue = [{
        month: currentMonth,
        year: currentYear,
        label: `${MONTH_NAMES[currentMonth - 1]} ${currentYear}`
      }];
    }

    setSelectedPaymentMonths(initialDue);
    const initialMonthsCount = initialDue.length;
    const initialFee = initialMonthsCount * (s.monthlyFee || 200);

    setPaymentForm({
      month: initialDue[0] ? initialDue[0].month : currentMonth,
      year: initialDue[0] ? initialDue[0].year : currentYear,
      feeAmount: initialFee,
      openingBalanceAmount: 0,
      paymentMode: 'Cash in Hand',
      notes: initialDue[0] ? `Madrasa fee paid for ${initialDue[0].label}` : `Opening balance fee payment`,
    });
    setCustomAdvanceMonth(initialDue[0] ? initialDue[0].month : currentMonth);
    setCustomAdvanceYear(initialDue[0] ? initialDue[0].year : currentYear);
    setShowPaymentModal(true);
  };

  // Add advance month
  const handleAddCustomAdvanceMonth = () => {
    if (!activePayingStudent) return;
    const mNum = parseInt(customAdvanceMonth);
    const yNum = parseInt(customAdvanceYear);
    const isAlreadySelected = selectedPaymentMonths.some(d => d.month === mNum && d.year === yNum);
    if (isAlreadySelected) {
      toast.info(`${MONTH_NAMES[mNum - 1]} ${yNum} is already selected.`);
      return;
    }
    const alreadyPaid = (activePayingStudent.payments || []).some(p => p.month === mNum && p.year === yNum);
    if (alreadyPaid) {
      toast.error(`Already paid for ${MONTH_NAMES[mNum - 1]} ${yNum}.`);
      return;
    }

    const newMonthItem = {
      month: mNum,
      year: yNum,
      label: `${MONTH_NAMES[mNum - 1]} ${yNum} (Advance)`
    };

    const nextSelected = [...selectedPaymentMonths, newMonthItem];
    setSelectedPaymentMonths(nextSelected);

    const count = nextSelected.length;
    const rate = activePayingStudent.monthlyFee || 200;
    const newFee = count * rate;
    const labels = nextSelected.map(d => d.label).join(', ');

    setPaymentForm(prev => ({
      ...prev,
      feeAmount: newFee,
      notes: `Madrasa fee paid for ${labels}`,
    }));

    toast.success(`Added ${MONTH_NAMES[mNum - 1]} ${yNum} to payment!`);
  };

  // Toggle selection of pending due months
  const handleToggleDueMonth = (due) => {
    if (!activePayingStudent) return;
    const isSelected = selectedPaymentMonths.some(d => d.month === due.month && d.year === due.year);
    let nextSelected;
    if (isSelected) {
      nextSelected = selectedPaymentMonths.filter(d => !(d.month === due.month && d.year === due.year));
    } else {
      nextSelected = [...selectedPaymentMonths, due];
    }
    setSelectedPaymentMonths(nextSelected);

    const count = nextSelected.length;
    const rate = activePayingStudent.monthlyFee || 200;
    const newFee = count * rate;

    const labels = nextSelected.map(d => d.label).join(', ');
    setPaymentForm(prev => ({
      ...prev,
      feeAmount: newFee,
      month: nextSelected[0] ? nextSelected[0].month : prev.month,
      year: nextSelected[0] ? nextSelected[0].year : prev.year,
      notes: count > 0 ? `Madrasa fee paid for ${labels}` : prev.notes,
    }));
  };

  const handleFeeAmountChange = (val) => {
    const amount = parseFloat(val) || 0;
    if (!activePayingStudent) {
      setPaymentForm(prev => ({ ...prev, feeAmount: val }));
      return;
    }

    const rate = activePayingStudent.monthlyFee || 200;
    const calculatedCount = Math.floor(amount / rate);

    if (activePayingStudent.dueMonths && activePayingStudent.dueMonths.length > 0 && calculatedCount > 0) {
      const selected = activePayingStudent.dueMonths.slice(0, calculatedCount);
      setSelectedPaymentMonths(selected);
      const labels = selected.map(d => d.label).join(', ');

      setPaymentForm(prev => ({
        ...prev,
        feeAmount: val,
        month: selected[0] ? selected[0].month : prev.month,
        year: selected[0] ? selected[0].year : prev.year,
        notes: `Madrasa fee paid for ${labels}`,
      }));
    } else {
      setPaymentForm(prev => ({ ...prev, feeAmount: val }));
    }
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!activePayingStudent || submittingPayment) return;
    setSubmittingPayment(true);
    try {
      const payload = {
        ...paymentForm,
        months: selectedPaymentMonths.map(d => ({ month: d.month, year: d.year }))
      };
      await api.post(`/api/madrasa/${activePayingStudent.id}/pay`, payload);
      setShowPaymentModal(false);
      const name = activePayingStudent.parentName || activePayingStudent.member?.name || 'Member';
      toast.success(`Payment recorded for ${name} and synced to Income!`);
      fetchStudents();
    } catch (err) {
      toast.error(err.message || 'Failed to record payment');
    } finally {
      setSubmittingPayment(false);
    }
  };

  // Open Payment History Modal
  const handleOpenHistory = async (s) => {
    try {
      const res = await api.get(`/api/madrasa/${s.id}`);
      if (res.success && res.student) {
        setHistoryStudent(res.student);
        setShowHistoryModal(true);
      }
    } catch (err) {
      toast.error('Failed to load payment history');
    }
  };

  // Grouped history items
  const historyGroups = useMemo(() => {
    if (!historyStudent || !historyStudent.payments) return [];
    const groups = new Map();

    for (const p of historyStudent.payments) {
      const key = p.receiptNo || `single-${p.id}`;
      if (!groups.has(key)) {
        groups.set(key, {
          id: p.id,
          receiptNo: p.receiptNo,
          paymentDate: p.paymentDate,
          paymentMode: p.paymentMode,
          notes: p.notes,
          totalAmount: 0,
          feeAmount: 0,
          openingBalanceAmount: 0,
          items: [],
        });
      }
      const group = groups.get(key);
      group.totalAmount += Number(p.totalAmount || 0);
      group.feeAmount += Number(p.feeAmount || 0);
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
        label = `Opening Balance / Fee Arrears`;
      }
      return {
        ...g,
        label,
      };
    });
  }, [historyStudent]);

  // Revert / Delete Madrasa Payment
  const handleRevertPayment = async (paymentId, amount, label) => {
    if (!historyStudent) return;
    const confirmMsg = `Are you sure you want to REVERT this payment?\n\n• Receipt / Period: ${label}\n• Total Amount: ₹${amount}\n\nThis will re-mark the months as unpaid and delete the linked income record from Treasury.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await api.del(`/api/madrasa/${historyStudent.id}/payments/${paymentId}`);
      toast.success('Payment reverted successfully and income record removed');

      const res = await api.get(`/api/madrasa/${historyStudent.id}`);
      if (res.success && res.student) {
        setHistoryStudent(res.student);
        if (detailStudent && detailStudent.id === res.student.id) {
          setDetailStudent(res.student);
        }
      }
      fetchStudents();
    } catch (err) {
      toast.error(err.message || 'Failed to revert payment');
    }
  };

  // Open Details Modal
  const handleOpenDetails = (s) => {
    setDetailStudent(s);
    setShowDetailModal(true);
  };

  // Export PDF
  const handleExportPdf = () => {
    const columns = ['Parent / Member', 'Phone', 'Area / Division', 'Job', 'Students Count', 'Monthly Fee', 'Opening Balance', 'Due Months', 'Total Due (₹)'];
    const rows = displayedStudents.map(s => {
      const parentName = s.parentName || s.member?.name || '-';
      const phone = s.parentPhone || s.member?.phone || '-';
      const division = s.division || s.member?.division || '-';
      const job = s.job || s.member?.job || '-';
      const count = `${s.studentsCount || 1} student(s)`;
      const monthly = '₹' + (s.monthlyFee || 0);
      const openBal = `₹${s.openingBalance || 0}${s.netOpeningBalanceDue > 0 ? ` (Due: ₹${s.netOpeningBalanceDue})` : ' (Clear)'}`;
      const dueMonths = s.dueMonthsCount > 0 ? `${s.dueMonthsCount} Mo (${s.dueMonthsNames || ''})` : 'Clear';
      const totalDue = '₹' + Number(s.totalDueAmount || 0).toLocaleString('en-IN');

      return [parentName, phone, division, job, count, monthly, openBal, dueMonths, totalDue];
    });

    const totalDues = displayedStudents.reduce((acc, s) => acc + (s.totalDueAmount || 0), 0);
    const totalOpeningBalDue = displayedStudents.reduce((acc, s) => acc + (s.netOpeningBalanceDue || 0), 0);

    exportToPdf({
      title: 'Madrasa Sirajul Huda - Monthly Fee Due Report',
      subtitle: `Masjid al noor, Chulliyode • Total Families / Records: ${displayedStudents.length}`,
      dateRange: 'Current Status',
      columns,
      rows,
      summaryRows: [
        { label: 'Total Opening Balance Due:', value: '₹' + Number(totalOpeningBalDue).toLocaleString('en-IN') },
        { label: 'Total Outstanding Madrasa Fees:', value: '₹' + Number(totalDues).toLocaleString('en-IN'), bold: true, highlight: true }
      ],
      fileName: 'Madrasa_Monthly_Fees_Due_Report.pdf'
    });
  };

  // Export Excel
  const handleExportExcel = () => {
    const excelRows = displayedStudents.map(s => ({
      'Parent / Member': s.parentName || s.member?.name || '',
      'Phone': s.parentPhone || s.member?.phone || '',
      'Area / Division': s.division || s.member?.division || '',
      'Job / Occupation': s.job || s.member?.job || '',
      'Mahallu Member': s.member ? `${s.member.name} (#${s.member.idNumber || s.member.id})` : 'No',
      'Students Enrolled': s.studentsCount || 1,
      'Monthly Fee (INR)': s.monthlyFee,
      'Opening Balance (INR)': s.openingBalance || 0,
      'Opening Balance Due (INR)': s.netOpeningBalanceDue || 0,
      'Status': s.status,
      'Due Months Count': s.dueMonthsCount,
      'Which Months Due': s.dueMonthsNames || (s.dueMonths || []).map(x => x.label).join(', '),
      'Total Due Amount (INR)': s.totalDueAmount,
      'Current Month Paid': s.isCurrentMonthPaid ? 'Yes' : 'No',
    }));

    exportToExcel({
      data: excelRows,
      sheetName: 'Madrasa Fees',
      fileName: 'Madrasa_Fees_List.xlsx'
    });
  };

  const getStudentHasDues = (s) => s.dueMonthsCount > 0 || (s.netOpeningBalanceDue || 0) > 0;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <GraduationCap className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
            Madrasa Subscriptions & Fees
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-semibold">
              {displayedStudents.length} {displayedStudents.length === 1 ? 'Parent Record' : 'Parent Records'}
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Select Mahallu member, specify student count, auto-calculated monthly fees, 1-click WhatsApp alerts & automatic Income sync
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
            <span className="hidden sm:inline">PDF Report</span>
          </button>
          <button
            onClick={handleExportExcel}
            className="p-2 sm:px-3 sm:py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 shadow-xs flex items-center gap-1.5"
            title="Export Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline">Excel</span>
          </button>
          <button
            onClick={handleOpenAddModal}
            className="p-2 sm:px-3.5 sm:py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Madrasa Entry</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Registered Parents</span>
            <Users className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {stats.totalParents}
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-1">
            {stats.totalKids} Total Student(s) Enrolled
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Monthly Potential</span>
            <IndianRupee className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            ₹{stats.totalMonthlyFeePotential.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Expected total monthly fees
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Pending Dues</span>
            <AlertCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
            ₹{stats.totalDuesAmount.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-rose-600/80 font-medium mt-1">
            Across {stats.parentsWithDues} family(ies)
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Fees Cleared</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {stats.totalParents - stats.parentsWithDues}
          </div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">
            Parents up to date
          </div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search parent name, phone, division, job, Mahallu ID..."
            value={search}
            onChange={handleSearchChange}
            className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
          {search && (
            <button
              onClick={() => {
                setSearch('');
                setDebouncedSearch('');
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {/* Division Filter */}
          <select
            value={selectedDivision}
            onChange={(e) => setSelectedDivision(e.target.value)}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none"
          >
            <option value="All">All Divisions</option>
            {divisions.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none"
          >
            <option value="All">All Status</option>
            <option value="Active">Active Only</option>
            <option value="Has Dues">Has Dues Only</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* MOBILE VIEW: Cards */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="py-12 text-center text-slate-400">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading madrasa records...
          </div>
        ) : displayedStudents.length === 0 ? (
          <div className="py-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
            No madrasa records found. Click &quot;Add Madrasa Entry&quot; to register a family.
          </div>
        ) : (
          displayedStudents.map((s) => {
            const hasDues = getStudentHasDues(s);
            const parentName = s.parentName || s.member?.name || 'Parent';
            const phone = s.parentPhone || s.member?.phone;
            const division = s.division || s.member?.division;
            const job = s.job || s.member?.job;

            return (
              <div
                key={s.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-4 space-y-3 shadow-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 dark:text-white text-sm">
                        {parentName}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
                        {s.studentsCount || 1} Student(s)
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                      {phone && <span>📞 {phone}</span>}
                      {division && (
                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                          <Building className="w-2.5 h-2.5" />
                          {division}
                        </span>
                      )}
                      {job && (
                        <span className="inline-flex items-center gap-1 text-slate-500">
                          <Briefcase className="w-2.5 h-2.5" />
                          {job}
                        </span>
                      )}
                    </div>

                    {s.member && (
                      <div className="mt-1">
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 px-1.5 py-0.5 rounded">
                          <UserCheck className="w-2.5 h-2.5" />
                          Mahallu Member #{s.member.idNumber || s.member.id}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenDetails(s)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                      title="View Details"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleOpenEdit(s)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="p-1.5 text-rose-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 block font-semibold">Monthly Madrasa Fee</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      ₹{s.monthlyFee}
                      <span className="text-[10px] text-slate-400 font-normal ml-1">
                        ({s.studentsCount || 1} kid{s.studentsCount > 1 ? 's' : ''})
                      </span>
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 block font-semibold">Area / Division</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {division || '-'}
                    </span>
                  </div>
                  {(s.openingBalance || 0) > 0 && (
                    <div className="col-span-2">
                      <span className="text-[10px] uppercase text-slate-400 block font-semibold">Opening Balance Arrears</span>
                      <span className="font-bold text-orange-600 dark:text-orange-400">
                        ₹{s.openingBalance} total
                        {(s.netOpeningBalanceDue || 0) > 0
                          ? <span className="text-[10px] text-rose-600 font-normal ml-1">(Due: ₹{s.netOpeningBalanceDue})</span>
                          : <span className="text-[10px] text-emerald-600 font-normal ml-1">(Cleared)</span>
                        }
                      </span>
                    </div>
                  )}
                </div>

                {/* Dues & Payment Action */}
                <div className="flex items-center justify-between pt-1">
                  {hasDues ? (
                    <div className="space-y-0.5">
                      <div className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>{s.dueMonthsCount} Mo Due</span>
                      </div>
                      <div className="text-[11px] font-bold text-rose-600">
                        Total Due: ₹{Number(s.totalDueAmount || 0).toLocaleString('en-IN')}
                      </div>
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Fees Cleared
                    </span>
                  )}

                  <div className="flex items-center gap-1.5">
                    {phone && hasDues && (
                      <button
                        onClick={() => openWhatsAppMadrasaDueReminder(s)}
                        className="p-2 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 rounded-xl transition-colors"
                        title="Send WhatsApp Reminder"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleOpenPayment(s)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                    >
                      Pay Fee
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* DESKTOP VIEW: Table */}
      <div className="hidden md:block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/40 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                <th className="py-3.5 px-4">Parent / Member</th>
                <th className="py-3.5 px-4">Area & Job</th>
                <th className="py-3.5 px-4 text-center">Students Count</th>
                <th className="py-3.5 px-4">Monthly Fee</th>
                <th className="py-3.5 px-4">Due Status & Months</th>
                <th className="py-3.5 px-4 text-center">WhatsApp</th>
                <th className="py-3.5 px-4 text-center">Record Fee</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading madrasa records...
                  </td>
                </tr>
              ) : displayedStudents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No madrasa records found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                displayedStudents.map((s) => {
                  const hasDues = getStudentHasDues(s);
                  const parentName = s.parentName || s.member?.name || '-';
                  const phone = s.parentPhone || s.member?.phone;
                  const division = s.division || s.member?.division;
                  const job = s.job || s.member?.job;

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                      {/* Parent / Member Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {parentName}
                          </span>
                          {s.member && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60">
                              Member #{s.member.idNumber || s.member.id}
                            </span>
                          )}
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                            s.status === 'Active'
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                          }`}>
                            {s.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                          {phone && <span>📞 {phone}</span>}
                          {s.admissionDate && (
                            <span>• Joined: {new Date(s.admissionDate).toLocaleDateString('en-GB')}</span>
                          )}
                        </div>
                      </td>

                      {/* Area & Job */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="space-y-1">
                          {division ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md font-medium text-xs">
                              <Building className="w-3 h-3" />
                              {division}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">-</span>
                          )}
                          {job && (
                            <div className="text-[11px] text-slate-500 flex items-center gap-1">
                              <Briefcase className="w-2.5 h-2.5" />
                              {job}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Students Count */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          <GraduationCap className="w-3.5 h-3.5" />
                          {s.studentsCount || 1} Student{(s.studentsCount || 1) > 1 ? 's' : ''}
                        </span>
                      </td>

                      {/* Monthly Fee */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          ₹{s.monthlyFee}
                        </span>
                        <span className="text-[10px] text-slate-400"> / mo</span>
                      </td>

                      {/* Due Status & Pending Months */}
                      <td className="py-3.5 px-4">
                        {s.dueMonthsCount > 0 ? (
                          <div className="space-y-0.5">
                            <div className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>{s.dueMonthsCount} Month(s) Due</span>
                            </div>
                            <div className="text-[11px] font-semibold text-rose-700 dark:text-rose-300 max-w-xs truncate">
                              Due: {s.dueMonthsNames || (s.dueMonths || []).map(x => x.label).join(', ')}
                            </div>
                            <div className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
                              Total Due: ₹{Number(s.totalDueAmount || 0).toLocaleString('en-IN')}
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Up to date
                          </span>
                        )}
                        {(s.netOpeningBalanceDue || 0) > 0 && (
                          <div className="text-[10px] text-orange-600 font-medium mt-0.5">
                            Arrears: ₹{s.netOpeningBalanceDue}
                          </div>
                        )}
                      </td>

                      {/* WhatsApp Button */}
                      <td className="py-3.5 px-4 text-center">
                        {phone && hasDues ? (
                          <button
                            onClick={() => openWhatsAppMadrasaDueReminder(s)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800 rounded-lg transition-colors"
                            title="Send WhatsApp Due Reminder"
                          >
                            <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                            <span>WhatsApp</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400">-</span>
                        )}
                      </td>

                      {/* Record Payment */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleOpenPayment(s)}
                          className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
                        >
                          Pay Fee
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenDetails(s)}
                            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="View Full Profile & Status"
                          >
                            <Info className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenHistory(s)}
                            className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Payment History & Revert"
                          >
                            <History className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(s)}
                            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(s.id)}
                            className="p-1.5 text-rose-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
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
      {/* MODAL 1: ADD / EDIT MADRASA RECORD (SIMPLE)              */}
      {/* ======================================================== */}
      {showAddModal && createPortal(
        <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/60 backdrop-blur-sm p-3 sm:p-6 flex items-start sm:items-center justify-center animate-fade-in">
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-800 overflow-hidden my-auto shrink-0">
            {/* Pinned Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white dark:bg-slate-900 z-10">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-emerald-600" />
                {editingStudent ? 'Edit Madrasa Record' : 'Register Madrasa Entry'}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form with scrollable body and pinned footer */}
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 overscroll-contain">
                {/* Select Mahallu Member Parent (Dropdown / Search) */}
                <div className="p-3.5 bg-emerald-50/70 dark:bg-emerald-950/20 rounded-xl border border-emerald-200/80 dark:border-emerald-800/60 space-y-2">
                  <label className="block text-xs font-bold text-emerald-900 dark:text-emerald-300">
                    Select Mahallu Member (Parent / Guardian) *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Type member name, phone or ward to select..."
                      value={memberSearchTerm}
                      onChange={(e) => {
                        setMemberSearchTerm(e.target.value);
                        setShowMemberDropdown(true);
                      }}
                      onFocus={() => setShowMemberDropdown(true)}
                      className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                    {formData.memberId && (
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            memberId: '',
                            parentName: '',
                            parentPhone: '',
                            job: '',
                            division: '',
                          });
                          setMemberSearchTerm('');
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-rose-500 hover:text-rose-700 font-bold"
                      >
                        Clear
                      </button>
                    )}

                    {showMemberDropdown && (
                      <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                        {filteredParentMembers.length === 0 ? (
                          <div className="p-2.5 text-xs text-slate-400 text-center">
                            No matching Mahallu members found.
                          </div>
                        ) : (
                          filteredParentMembers.map(m => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => handleSelectParentMember(m)}
                              className="w-full text-left p-2.5 hover:bg-emerald-50 dark:hover:bg-slate-700/60 transition-colors flex items-center justify-between text-xs"
                            >
                              <div>
                                <div className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                  <span>{m.name}</span>
                                  {m.idNumber && (
                                    <span className="text-[10px] text-blue-600">#{m.idNumber}</span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
                                  {m.phone && <span>📞 {m.phone}</span>}
                                  {m.division && <span>📍 {m.division}</span>}
                                  {m.job && <span>💼 {m.job}</span>}
                                </div>
                              </div>
                              {formData.memberId === m.id && (
                                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                    Selecting a member automatically prefills parent name, phone, job, division and joining date.
                  </div>
                </div>

                {/* Parent Name (Editable or Manual entry if non-member) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Parent / Guardian Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Muhammed Jisil"
                    value={formData.parentName}
                    onChange={(e) => setFormData({ ...formData, parentName: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Prefilled: Phone & Job */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Phone (Auto-prefilled)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 9876543210"
                      value={formData.parentPhone}
                      onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Job / Occupation (Auto-prefilled)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Business, Teacher"
                      value={formData.job}
                      onChange={(e) => setFormData({ ...formData, job: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Prefilled: Area / Division & Admission Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Area / Division (Auto-prefilled)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Chulliyode, Area 1"
                      value={formData.division}
                      onChange={(e) => setFormData({ ...formData, division: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Admission / Joining Date
                    </label>
                    <input
                      type="date"
                      value={formData.admissionDate}
                      onChange={(e) => setFormData({ ...formData, admissionDate: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Number of Students & Auto-Calculating Monthly Fee */}
                <div className="p-3.5 bg-blue-50/70 dark:bg-blue-950/20 rounded-xl border border-blue-200/80 dark:border-blue-900/40 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-blue-900 dark:text-blue-300 mb-1">
                        Number of Students *
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={formData.studentsCount}
                        onChange={(e) => handleStudentsCountChange(e.target.value)}
                        className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-blue-900 dark:text-blue-300 mb-1">
                        Fee per Student (₹)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">₹</span>
                        <input
                          type="number"
                          min="0"
                          value={formData.feePerStudent}
                          onChange={(e) => handleFeePerStudentChange(e.target.value)}
                          className="w-full pl-7 pr-3 py-2 text-sm font-semibold rounded-xl border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Auto Calculated Monthly Fee */}
                  <div className="p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-blue-200 dark:border-blue-800 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                        Total Monthly Fee:
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Auto-calculated ({formData.studentsCount || 1} student(s) × ₹{formData.feePerStudent || 200})
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-400 font-bold">₹</span>
                      <input
                        type="number"
                        min="0"
                        value={formData.monthlyFee}
                        onChange={(e) => setFormData({ ...formData, monthlyFee: parseFloat(e.target.value) || 0 })}
                        className="w-24 px-2 py-1 text-sm font-bold text-emerald-600 dark:text-emerald-400 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-right focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Opening Balance (Fee Arrears) & Status */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Opening Balance Arrears (₹)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-orange-500 font-bold">₹</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={formData.openingBalance}
                        onChange={(e) => setFormData({ ...formData, openingBalance: parseFloat(e.target.value) || 0 })}
                        className="w-full pl-7 pr-3 py-2 text-sm font-semibold rounded-xl border border-orange-200 dark:border-orange-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-orange-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
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

                {/* Notes */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Remarks / Student Names (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Optional notes, names of kids, etc..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Pinned Footer */}
              <div className="p-3.5 sm:p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2 shrink-0 bg-slate-50 dark:bg-slate-900/90">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs disabled:opacity-50 transition-colors"
                >
                  {submitting ? 'Saving...' : editingStudent ? 'Update Record' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ======================================================== */}
      {/* MODAL 2: RECORD MULTI-MONTH FEE PAYMENT                 */}
      {/* ======================================================== */}
      {showPaymentModal && activePayingStudent && createPortal(
        <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/60 backdrop-blur-sm p-3 sm:p-6 flex items-start sm:items-center justify-center animate-fade-in">
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-800 overflow-hidden my-auto shrink-0">
            {/* Pinned Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white dark:bg-slate-900 z-10">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-emerald-600" />
                  Record Madrasa Fee Payment
                </h3>
                <div className="text-xs text-slate-500 mt-0.5">
                  Parent: <span className="font-bold text-slate-800 dark:text-slate-200">{activePayingStudent.parentName || activePayingStudent.member?.name}</span>
                  <span className="ml-1 text-emerald-600 font-semibold">({activePayingStudent.studentsCount || 1} student(s))</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form with scrollable body and pinned footer */}
            <form onSubmit={handleRecordPayment} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 overscroll-contain">
                {/* Select Due Months */}
                {activePayingStudent.dueMonths && activePayingStudent.dueMonths.length > 0 && (
                  <div className="p-3 bg-rose-50/70 dark:bg-rose-950/20 rounded-xl border border-rose-200 dark:border-rose-900/40">
                    <span className="text-xs font-bold text-rose-800 dark:text-rose-300 block mb-2">
                      Pending Due Months (Click to Select / Deselect):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {activePayingStudent.dueMonths.map((d, idx) => {
                        const isSelected = selectedPaymentMonths.some(item => item.month === d.month && item.year === d.year);
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleToggleDueMonth(d)}
                            className={`px-2.5 py-1 text-xs font-bold rounded-lg border flex items-center gap-1.5 transition-all ${
                              isSelected
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-emerald-500'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3" />}
                            <span>{d.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Add Custom / Advance Month */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Advance / Future Month Payment:
                  </span>
                  <div className="flex items-center gap-2">
                    <select
                      value={customAdvanceMonth}
                      onChange={(e) => setCustomAdvanceMonth(parseInt(e.target.value))}
                      className="flex-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none"
                    >
                      {MONTH_NAMES.map((m, i) => (
                        <option key={i + 1} value={i + 1}>{m}</option>
                      ))}
                    </select>
                    <select
                      value={customAdvanceYear}
                      onChange={(e) => setCustomAdvanceYear(parseInt(e.target.value))}
                      className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none"
                    >
                      {[currentYear, currentYear + 1, currentYear + 2].map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleAddCustomAdvanceMonth}
                      className="px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors whitespace-nowrap"
                    >
                      + Add Month
                    </button>
                  </div>
                </div>

                {/* Fee Amount */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Madrasa Monthly Fee Amount (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={paymentForm.feeAmount}
                    onChange={(e) => handleFeeAmountChange(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  {selectedPaymentMonths.length > 0 && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 block font-medium">
                      Paying for {selectedPaymentMonths.length} month(s) ({selectedPaymentMonths.map(d => d.label).join(', ')})
                    </span>
                  )}
                </div>

                {/* Opening Balance Payment */}
                {(activePayingStudent.netOpeningBalanceDue || 0) > 0 && (
                  <div className="p-3 bg-orange-50 dark:bg-orange-950/30 rounded-xl border border-orange-200 dark:border-orange-800/60">
                    <div className="text-xs font-bold text-orange-800 dark:text-orange-300 mb-1.5">
                      Opening Balance Arrears: ₹{Number(activePayingStudent.netOpeningBalanceDue).toLocaleString('en-IN')}
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-600 dark:text-slate-400 font-medium whitespace-nowrap">Pay Arrears (₹):</label>
                      <input
                        type="number"
                        min="0"
                        max={activePayingStudent.netOpeningBalanceDue}
                        value={paymentForm.openingBalanceAmount}
                        onChange={(e) => setPaymentForm({ ...paymentForm, openingBalanceAmount: parseFloat(e.target.value) || 0 })}
                        placeholder={`Max ₹${activePayingStudent.netOpeningBalanceDue}`}
                        className="w-full px-3 py-2 text-sm font-semibold rounded-xl border border-orange-200 dark:border-orange-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* Total Collection Amount */}
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between">
                  <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300">Total Madrasa Collection:</span>
                  <span className="text-base font-bold text-emerald-700 dark:text-emerald-300">
                    ₹{(parseFloat(paymentForm.feeAmount || 0) + parseFloat(paymentForm.openingBalanceAmount || 0)).toLocaleString('en-IN')}
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

                {/* Remarks */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Payment Remarks
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Paid for October 2026, UPI ref #..."
                    value={paymentForm.notes}
                    onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Pinned Footer */}
              <div className="p-3.5 sm:p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2 shrink-0 bg-slate-50 dark:bg-slate-900/90">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs disabled:opacity-50 transition-colors"
                >
                  {submittingPayment ? 'Recording...' : 'Record Payment & Log Income'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ======================================================== */}
      {/* MODAL 3: PAYMENT HISTORY & REVERT                       */}
      {/* ======================================================== */}
      {showHistoryModal && historyStudent && createPortal(
        <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/60 backdrop-blur-sm p-3 sm:p-6 flex items-start sm:items-center justify-center animate-fade-in">
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-800 overflow-hidden my-auto shrink-0">
            {/* Pinned Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white dark:bg-slate-900 z-10">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <History className="w-5 h-5 text-emerald-600" />
                  Fee Payment History & Revert
                </h3>
                <div className="text-xs text-slate-500 mt-0.5">
                  Parent: <span className="font-bold text-slate-800 dark:text-slate-200">{historyStudent.parentName || historyStudent.member?.name}</span>
                  <span className="ml-1 text-emerald-600 font-semibold">({historyStudent.studentsCount || 1} student(s))</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable History List */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3 overscroll-contain">
              {historyGroups.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  No payment records found for this parent.
                </div>
              ) : (
                historyGroups.map((g, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white text-sm">
                          {g.label}
                        </span>
                        {g.items.length > 1 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 whitespace-nowrap">
                            {g.items.length} Months Batch
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        {g.paymentMode} • {new Date(g.paymentDate).toLocaleDateString('en-GB')}
                        {g.receiptNo && <span className="ml-1.5 font-mono text-[10px] text-slate-400">({g.receiptNo})</span>}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {g.feeAmount > 0 && `Madrasa Fee: ₹${g.feeAmount} `}
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
                        title="Revert Payment & Delete Income Record"
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                        <span>Revert</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pinned Footer */}
            <div className="p-3.5 sm:p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end shrink-0 bg-slate-50 dark:bg-slate-900/90">
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ======================================================== */}
      {/* MODAL 4: FULL DETAILS & 12-MONTH CALENDAR GRID          */}
      {/* ======================================================== */}
      {showDetailModal && detailStudent && createPortal(
        <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/60 backdrop-blur-sm p-3 sm:p-6 flex items-start sm:items-center justify-center animate-fade-in">
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-800 overflow-hidden my-auto shrink-0">
            {/* Pinned Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white dark:bg-slate-900 z-10">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-emerald-600" />
                  {detailStudent.parentName || detailStudent.member?.name}
                </h3>
                <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                  <span className="font-semibold text-emerald-600">{detailStudent.studentsCount || 1} Student(s)</span>
                  <span>• Admitted / Joined: {new Date(detailStudent.admissionDate).toLocaleDateString('en-GB')}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Details Body */}
            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 overscroll-contain">
              {/* Parent & Mahallu Link */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Parent / Member Profile Details
                </span>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {detailStudent.parentName || detailStudent.member?.name || 'Not recorded'}
                    </span>
                    {(detailStudent.parentPhone || detailStudent.member?.phone) && (
                      <span className="ml-2 text-slate-500">
                        📞 {detailStudent.parentPhone || detailStudent.member?.phone}
                      </span>
                    )}
                  </div>
                  {detailStudent.member && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md">
                      <UserCheck className="w-3 h-3" />
                      Mahallu Member #{detailStudent.member.idNumber || detailStudent.member.id}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap items-center gap-3">
                  {(detailStudent.division || detailStudent.member?.division) && (
                    <span>📍 Area: {detailStudent.division || detailStudent.member?.division}</span>
                  )}
                  {(detailStudent.job || detailStudent.member?.job) && (
                    <span>💼 Job: {detailStudent.job || detailStudent.member?.job}</span>
                  )}
                </div>
              </div>

              {/* Remarks */}
              {detailStudent.notes && (
                <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/50">
                  <span className="text-[10px] uppercase font-bold text-amber-800 dark:text-amber-400 block mb-0.5">
                    Registration Remarks
                  </span>
                  <p className="text-xs text-slate-700 dark:text-slate-300 font-medium whitespace-pre-wrap">
                    {detailStudent.notes}
                  </p>
                </div>
              )}

              {/* 4 Financial Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80">
                  <span className="text-[10px] uppercase text-slate-400 block font-semibold">Monthly Madrasa Fee</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">₹{detailStudent.monthlyFee}</span>
                  <span className="text-[10px] text-slate-400 block">for {detailStudent.studentsCount || 1} kid(s)</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80">
                  <span className="text-[10px] uppercase text-slate-400 block font-semibold">Area / Division</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                    {detailStudent.division || detailStudent.member?.division || '-'}
                  </span>
                  <span className="text-[10px] text-slate-400 block">{detailStudent.status}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80">
                  <span className="text-[10px] uppercase text-slate-400 block font-semibold">Opening Balance</span>
                  <span className="font-bold text-orange-600 dark:text-orange-400 text-sm">
                    ₹{detailStudent.netOpeningBalanceDue || 0}
                  </span>
                  <span className="text-[10px] text-slate-400 block">of ₹{detailStudent.openingBalance || 0}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80">
                  <span className="text-[10px] uppercase text-slate-400 block font-semibold">Total Outstanding</span>
                  <span className={`font-extrabold text-sm ${detailStudent.totalDueAmount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600'}`}>
                    ₹{Number(detailStudent.totalDueAmount || 0).toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    {detailStudent.dueMonthsCount > 0 ? `${detailStudent.dueMonthsCount} month(s) due` : 'Up to date'}
                  </span>
                </div>
              </div>

              {/* 12-Month Calendar Grid */}
              <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
                      Madrasa Monthly Fee Status ({detailYear})
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

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {MONTH_NAMES.map((name, i) => {
                    const mNum = i + 1;
                    const payment = (detailStudent.payments || []).find(p => p.year === detailYear && p.month === mNum);
                    const isDue = (detailStudent.dueMonths || []).some(d => d.year === detailYear && d.month === mNum);
                    const isFuture = (detailYear > currentYear) || (detailYear === currentYear && mNum > currentMonth);
                    const joinDate = new Date(detailStudent.admissionDate);
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
                      statusLabel = `Unpaid (₹${detailStudent.monthlyFee})`;
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

            {/* Pinned Footer */}
            <div className="p-3.5 sm:p-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0 bg-slate-50 dark:bg-slate-900/90">
              <button
                type="button"
                onClick={() => {
                  setShowDetailModal(false);
                  handleOpenHistory(detailStudent);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800 rounded-xl transition-colors shadow-xs"
              >
                <History className="w-4 h-4" />
                <span>Fee History & Revert</span>
              </button>

              <div className="flex items-center gap-2">
                {(detailStudent.parentPhone || detailStudent.member?.phone) && (detailStudent.dueMonthsCount > 0 || (detailStudent.netOpeningBalanceDue || 0) > 0) && (
                  <button
                    type="button"
                    onClick={() => openWhatsAppMadrasaDueReminder(detailStudent)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800 rounded-xl transition-colors shadow-xs"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>WhatsApp Due Alert</span>
                  </button>
                )}

                {(detailStudent.dueMonthsCount > 0 || (detailStudent.netOpeningBalanceDue || 0) > 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowDetailModal(false);
                      handleOpenPayment(detailStudent);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-xs"
                  >
                    <Receipt className="w-4 h-4" />
                    <span>Pay Madrasa Fee</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
