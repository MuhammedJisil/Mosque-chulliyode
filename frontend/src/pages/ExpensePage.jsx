import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../utils/api';
import CategoryDropdown from '../components/CategoryDropdown';
import CustomFieldInput from '../components/CustomFieldInput';
import CameraCaptureModal from '../components/CameraCaptureModal';
import ProofViewerModal from '../components/ProofViewerModal';
import ExportModal from '../components/ExportModal';
import { exportToPdf } from '../utils/exportPdf';
import { exportToExcel } from '../utils/exportExcel';
import Pagination from '../components/Pagination';
import { DEFAULT_EXPENSE_CATEGORIES, PAYMENT_MODES, MONTH_NAMES } from '../utils/categoriesData';
import { useToast } from '../context/ToastContext';
import {
  Plus,
  Search,
  Download,
  Trash2,
  Edit2,
  Eye,
  Camera,
  FileText,
  X,
  Check,
  Image as ImageIcon
} from 'lucide-react';

export default function ExpensePage() {
  const { toast } = useToast();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedPaymentMode, setSelectedPaymentMode] = useState('All');
  const [selectedMonth, setSelectedMonth] = useState('All');
  const [selectedYear, setSelectedYear] = useState('All');
  const [sortOrder, setSortOrder] = useState('newest');

  // Custom Categories list from API
  const [customCategories, setCustomCategories] = useState([]);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingItem, setViewingItem] = useState(null);
  const [showProofModal, setShowProofModal] = useState(false);
  const [proofModalUrl, setProofModalUrl] = useState('');
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  // Form State
  const initialFormState = {
    purpose: '',
    paidTo: '',
    category: DEFAULT_EXPENSE_CATEGORIES[0],
    amount: '',
    paymentMode: PAYMENT_MODES[0],
    description: '',
    customFields: [],
    proofImage: null,
    date: new Date().toISOString().split('T')[0],
  };
  const [formData, setFormData] = useState(initialFormState);
  const [submitting, setSubmitting] = useState(false);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const params = {
        search,
        category: selectedCategory !== 'All' ? selectedCategory : undefined,
        paymentMode: selectedPaymentMode !== 'All' ? selectedPaymentMode : undefined,
        month: selectedMonth !== 'All' ? selectedMonth : undefined,
        year: selectedYear !== 'All' ? selectedYear : undefined,
        sort: sortOrder,
      };
      const res = await api.get('/api/expense', params);
      if (res.success) {
        setExpenses(res.expenses || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch expense records');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomCategories = async () => {
    try {
      const res = await api.get('/api/categories', { type: 'EXPENSE' });
      if (res.success && res.categories) {
        setCustomCategories(res.categories);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchCustomCategories();
  }, []);

  useEffect(() => {
    fetchExpenses();
  }, [search, selectedCategory, selectedPaymentMode, selectedMonth, selectedYear, sortOrder]);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormData(initialFormState);
    setShowAddModal(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setFormData({
      purpose: item.purpose,
      paidTo: item.paidTo,
      category: item.category,
      amount: item.amount,
      paymentMode: item.paymentMode,
      description: item.description || '',
      customFields: item.customFields || [],
      proofImage: item.proofImage || null,
      date: item.date ? new Date(item.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    });
    setShowAddModal(true);
  };

  const handleOpenView = (item) => {
    setViewingItem(item);
    setShowViewModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this expense record?')) return;
    try {
      await api.del(`/api/expense/${id}`);
      toast.success('Expense record deleted successfully');
      fetchExpenses();
    } catch (err) {
      toast.error(err.message || 'Failed to delete expense record');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingItem) {
        await api.put(`/api/expense/${editingItem.id}`, formData);
        toast.success('Expense record updated successfully');
      } else {
        await api.post('/api/expense', formData);
        toast.success('Expense recorded successfully');
      }
      setShowAddModal(false);
      fetchExpenses();
    } catch (err) {
      toast.error(err.message || 'Failed to save expense record');
    } finally {
      setSubmitting(false);
    }
  };

  // Export to PDF
  const handleExportPdf = ({ scope, month, year, periodLabel }) => {
    const dataToExport = expenses.filter(exp => {
      if (scope === 'all') return true;
      const d = new Date(exp.date);
      return (d.getMonth() + 1 === month) && (d.getFullYear() === year);
    });

    const columns = ['Date', 'Purpose', 'Paid To', 'Category', 'Payment Mode', 'Amount (₹)'];
    const rows = dataToExport.map(item => [
      new Date(item.date).toLocaleDateString('en-GB'),
      item.purpose,
      item.paidTo,
      item.category,
      item.paymentMode,
      '₹' + Number(item.amount).toLocaleString('en-IN')
    ]);

    const total = dataToExport.reduce((acc, c) => acc + c.amount, 0);

    exportToPdf({
      title: 'JAMIA AN-NOOR - Expense Statement',
      subtitle: `Total Records: ${dataToExport.length}`,
      dateRange: periodLabel,
      columns,
      rows,
      summaryRows: [
        { label: 'Total Expenditures:', value: '₹' + Number(total).toLocaleString('en-IN'), bold: true, highlight: true }
      ],
      fileName: `Jamia_AnNoor_Expense_${periodLabel.replace(/\s+/g, '_')}.pdf`
    });
  };

  // Export to Excel
  const handleExportExcel = ({ scope, month, year, periodLabel }) => {
    const dataToExport = expenses.filter(exp => {
      if (scope === 'all') return true;
      const d = new Date(exp.date);
      return (d.getMonth() + 1 === month) && (d.getFullYear() === year);
    });

    const excelRows = dataToExport.map(item => ({
      'Date': new Date(item.date).toLocaleDateString('en-GB'),
      'Purpose': item.purpose,
      'Paid To': item.paidTo,
      'Category': item.category,
      'Payment Mode': item.paymentMode,
      'Amount (INR)': item.amount,
      'Description / Notes': item.description || '',
    }));

    exportToExcel({
      data: excelRows,
      sheetName: 'Expenses',
      fileName: `Jamia_AnNoor_Expense_${periodLabel.replace(/\s+/g, '_')}.xlsx`
    });
  };

  const totalExpenseSum = useMemo(() => expenses.reduce((acc, i) => acc + i.amount, 0), [expenses]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 15;

  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedCategory, selectedPaymentMode, selectedMonth, selectedYear, sortOrder]);

  const paginatedExpenses = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return expenses.slice(startIndex, startIndex + PAGE_SIZE);
  }, [expenses, currentPage]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            Expense Management
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 font-semibold">
              {expenses.length} Records
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Track utility bills, staff payroll, maintenance, sound system, and download reports
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowExportModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-xs transition-colors"
          >
            <Download className="w-4 h-4 text-rose-600" />
            Download Statement
          </button>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-md shadow-rose-600/25 transition-transform active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Add Expense
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Search */}
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search purpose, payee vendor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-rose-500 focus:outline-none"
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-rose-500 focus:outline-none"
            >
              <option value="All">All Categories</option>
              {DEFAULT_EXPENSE_CATEGORIES.map((c, i) => (
                <option key={i} value={c}>{c}</option>
              ))}
              {customCategories.map((c, i) => (
                <option key={`c-${i}`} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Payment Mode */}
          <div>
            <select
              value={selectedPaymentMode}
              onChange={(e) => setSelectedPaymentMode(e.target.value)}
              className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-rose-500 focus:outline-none"
            >
              <option value="All">All Modes</option>
              {PAYMENT_MODES.map((m, i) => (
                <option key={i} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Month */}
          <div>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-rose-500 focus:outline-none"
            >
              <option value="All">All Months</option>
              {MONTH_NAMES.map((name, idx) => (
                <option key={idx} value={idx + 1}>{name}</option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <div>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-rose-500 focus:outline-none"
            >
              <option value="newest">Sort: Newest First</option>
              <option value="oldest">Sort: Oldest First</option>
            </select>
          </div>
        </div>

        {/* Total Expense Bar */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <span className="text-slate-500">Filtered Total Expenditure:</span>
          <span className="text-base font-bold text-rose-600 dark:text-rose-400">
            ₹{totalExpenseSum.toLocaleString('en-IN')}
          </span>
        </div>
      </div>

      {/* MOBILE VIEW: Cards for Zero Horizontal Sliding */}
      <div className="block md:hidden space-y-3">
        {loading ? (
          <div className="py-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
            <div className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading expenses...
          </div>
        ) : expenses.length === 0 ? (
          <div className="py-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 text-xs">
            No expense records found.
          </div>
        ) : (
          <>
            {paginatedExpenses.map((item) => (
              <div
                key={item.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-4 shadow-xs space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-sm text-slate-900 dark:text-white">
                      {item.purpose}
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                      <span>Paid to: <strong className="text-slate-600 dark:text-slate-300">{item.paidTo}</strong></span>
                      <span>•</span>
                      <span>{new Date(item.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {item.proofImage && (
                      <button
                        type="button"
                        onClick={() => { setProofModalUrl(item.proofImage); setShowProofModal(true); }}
                        className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        title="View Proof"
                      >
                        <ImageIcon className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleOpenView(item)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleOpenEdit(item)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      title="Edit Expense"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      title="Delete Expense"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-slate-800">
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200/50 dark:border-rose-800/50">
                    {item.category}
                  </span>
                  <span className="font-extrabold text-base text-rose-600 dark:text-rose-400">
                    -₹{Number(item.amount).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            ))}
            <Pagination
              currentPage={currentPage}
              totalItems={expenses.length}
              pageSize={PAGE_SIZE}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </div>

      {/* DESKTOP VIEW: Structured Table */}
      <div className="hidden md:block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/40 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4">Purpose & Payee</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4">Payment Mode</th>
                <th className="py-3.5 px-4">Amount</th>
                <th className="py-3.5 px-4 text-center">Proof</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading expense records...
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No expense records found.
                  </td>
                </tr>
              ) : (
                paginatedExpenses.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {new Date(item.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {item.purpose}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Paid to: <span className="font-medium text-slate-600 dark:text-slate-300">{item.paidTo}</span>
                      </div>
                      {item.description && (
                        <div className="text-[10px] text-slate-400 mt-0.5 italic truncate max-w-xs">
                          "{item.description}"
                        </div>
                      )}
                      {item.customFields && item.customFields.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {item.customFields.map((cf, idx) => (
                            <span key={idx} className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded">
                              {cf.name}: {cf.value}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="px-2 py-1 rounded-md text-[11px] font-medium bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200/50 dark:border-rose-800/50">
                        {item.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-600 dark:text-slate-300">
                      {item.paymentMode}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap font-bold text-rose-600 dark:text-rose-400 text-sm">
                      -₹{Number(item.amount).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      {item.proofImage ? (
                        <button
                          type="button"
                          onClick={() => { setProofModalUrl(item.proofImage); setShowProofModal(true); }}
                          className="inline-flex items-center gap-1 text-[11px] text-rose-600 hover:text-rose-700 font-medium hover:underline"
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                          View
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-300 dark:text-slate-600">None</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenView(item)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                          title="Edit Expense"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                          title="Delete Expense"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={currentPage}
          totalItems={expenses.length}
          pageSize={PAGE_SIZE}
          onPageChange={setCurrentPage}
          className="p-4"
        />
      </div>

      {/* View Expense Details Modal */}
      {showViewModal && viewingItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm p-3 sm:p-4 flex min-h-full items-start sm:items-center justify-center animate-fade-in">
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full my-auto sm:my-8 p-5 sm:p-6 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-rose-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Expense Entry #{viewingItem.id}
                </h3>
              </div>
              <button
                onClick={() => setShowViewModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4 text-xs">
              {/* Amount and Category Header */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-50 to-orange-50 dark:from-rose-950/40 dark:to-slate-900 border border-rose-100 dark:border-rose-900/50 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-rose-800 dark:text-rose-400 tracking-wider">
                    Total Amount Spent
                  </span>
                  <div className="text-2xl font-extrabold text-rose-700 dark:text-rose-300 mt-0.5">
                    -₹{Number(viewingItem.amount).toLocaleString('en-IN')}
                  </div>
                </div>
                <div className="text-right">
                  <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-800">
                    {viewingItem.category}
                  </span>
                  <div className="text-[11px] text-slate-500 mt-1">
                    {viewingItem.paymentMode}
                  </div>
                </div>
              </div>

              {/* Expense Details Card */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 uppercase font-semibold text-[10px]">Purpose / Title</span>
                  <span className="font-bold text-sm text-slate-800 dark:text-slate-100">{viewingItem.purpose}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 uppercase font-semibold text-[10px]">Paid To</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">👤 {viewingItem.paidTo}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 uppercase font-semibold text-[10px]">Expense Date</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    📅 {new Date(viewingItem.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </span>
                </div>
              </div>

              {/* Description */}
              {viewingItem.description && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">Description / Remarks</span>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{viewingItem.description}</p>
                </div>
              )}

              {/* Custom Fields */}
              {viewingItem.customFields && viewingItem.customFields.length > 0 && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-2">Additional Information</span>
                  <div className="grid grid-cols-2 gap-2">
                    {viewingItem.customFields.map((field, idx) => (
                      <div key={idx} className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                        <span className="text-[10px] text-slate-400 block">{field.name}</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{field.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Proof Image */}
              {viewingItem.proofImage && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-2">Receipt / Voucher Proof</span>
                  <div className="flex items-center gap-3">
                    <img
                      src={viewingItem.proofImage}
                      alt="Proof"
                      className="w-16 h-16 object-cover rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer"
                      onClick={() => { setProofModalUrl(viewingItem.proofImage); setShowProofModal(true); }}
                    />
                    <button
                      type="button"
                      onClick={() => { setProofModalUrl(viewingItem.proofImage); setShowProofModal(true); }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                    >
                      <ImageIcon className="w-4 h-4" />
                      View Full Size
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setShowViewModal(false);
                  handleOpenEdit(viewingItem);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Edit Record
              </button>
              <button
                type="button"
                onClick={() => setShowViewModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Expense Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm p-3 sm:p-4 flex min-h-full items-start sm:items-center justify-center animate-fade-in">
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-xl w-full my-auto sm:my-8 p-5 sm:p-6 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingItem ? 'Edit Expense Record' : 'Record New Expense'}
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
                {/* Expense Purpose */}
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Expense Purpose / Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Electricity Bill, Maintenance"
                    value={formData.purpose}
                    onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  />
                </div>

                {/* Paid To */}
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Paid To (Vendor / Person) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Electric Board or Hardware Store"
                    value={formData.paidTo}
                    onChange={(e) => setFormData({ ...formData, paidTo: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Category Dropdown (options from Image 3) */}
                <CategoryDropdown
                  label="Category"
                  value={formData.category}
                  onChange={(cat) => setFormData({ ...formData, category: cat })}
                  defaultCategories={DEFAULT_EXPENSE_CATEGORIES}
                  customCategories={customCategories}
                  onCategoryAdded={(newCat) => setCustomCategories([...customCategories, newCat])}
                  type="EXPENSE"
                  required
                />

                {/* Amount */}
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Amount (IN ₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    required
                    placeholder="e.g. 2500"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-3 py-2 text-sm font-semibold text-rose-700 dark:text-rose-300 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Payment Mode (Image 2) */}
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Payment Mode <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.paymentMode}
                    onChange={(e) => setFormData({ ...formData, paymentMode: e.target.value })}
                    required
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  >
                    {PAYMENT_MODES.map((mode, i) => (
                      <option key={i} value={mode}>{mode}</option>
                    ))}
                  </select>
                </div>

                {/* Date */}
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Expense Date
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Description / Notes (Optional) */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
                  Description / Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Reference invoice #, warranty notes, or payment details..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              {/* Custom Fields (Name & Value Options) */}
              <CustomFieldInput
                fields={formData.customFields}
                onChange={(fields) => setFormData({ ...formData, customFields: fields })}
              />

              {/* Proof Image (Camera or Device File) */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300">
                      Bill Receipt / Voucher Proof
                    </label>
                    <p className="text-[11px] text-slate-400">Capture receipt from camera or choose file</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCameraModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-colors"
                  >
                    <Camera className="w-3.5 h-3.5 text-rose-600" />
                    {formData.proofImage ? 'Change Proof' : 'Attach Proof'}
                  </button>
                </div>

                {formData.proofImage && (
                  <div className="mt-3 flex items-center gap-3 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                    <img
                      src={formData.proofImage}
                      alt="Receipt Proof"
                      className="w-12 h-12 rounded-lg object-cover border border-slate-200"
                    />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-200">Image Attached</p>
                      <button
                        type="button"
                        onClick={() => { setProofModalUrl(formData.proofImage); setShowProofModal(true); }}
                        className="text-[11px] text-rose-600 hover:underline"
                      >
                        Preview Receipt
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, proofImage: null })}
                      className="text-xs text-rose-500 hover:underline px-2"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-md disabled:opacity-50 transition-all"
                >
                  <Check className="w-4 h-4" />
                  {submitting ? 'Saving...' : editingItem ? 'Update Expense' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Proof Lightbox */}
      <ProofViewerModal
        isOpen={showProofModal}
        onClose={() => setShowProofModal(false)}
        imageUrl={proofModalUrl}
        title="Expense Voucher / Receipt Proof"
      />

      {/* Camera / Device Upload Modal */}
      <CameraCaptureModal
        isOpen={showCameraModal}
        onClose={() => setShowCameraModal(false)}
        currentImage={formData.proofImage}
        onCapture={(imgData) => setFormData({ ...formData, proofImage: imgData })}
      />

      {/* Statement Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="Export Expense Statements"
        onExportPdf={handleExportPdf}
        onExportExcel={handleExportExcel}
      />
    </div>
  );
}
