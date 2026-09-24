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
import { DEFAULT_INCOME_CATEGORIES, PAYMENT_MODES, MONTH_NAMES } from '../utils/categoriesData';
import {
  Plus,
  Search,
  Filter,
  Download,
  Trash2,
  Edit2,
  Eye,
  Camera,
  ArrowUpDown,
  FileText,
  Calendar,
  X,
  Check,
  Image as ImageIcon
} from 'lucide-react';

export default function IncomePage() {
  const [incomes, setIncomes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedPaymentMode, setSelectedPaymentMode] = useState('All');
  const [selectedMonth, setSelectedMonth] = useState('All');
  const [selectedYear, setSelectedYear] = useState('All');
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest' or 'oldest'

  // Custom Categories list from API
  const [customCategories, setCustomCategories] = useState([]);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showProofModal, setShowProofModal] = useState(false);
  const [proofModalUrl, setProofModalUrl] = useState('');
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  // Form State
  const initialFormState = {
    donorName: '',
    donorPhone: '',
    donorAddress: '',
    category: DEFAULT_INCOME_CATEGORIES[0],
    amount: '',
    paymentMode: PAYMENT_MODES[0],
    description: '',
    customFields: [],
    proofImage: null,
    date: new Date().toISOString().split('T')[0],
  };
  const [formData, setFormData] = useState(initialFormState);
  const [submitting, setSubmitting] = useState(false);

  // Load Incomes
  const fetchIncomes = async () => {
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
      const res = await api.get('/api/income', params);
      if (res.success) {
        setIncomes(res.incomes || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch income records');
    } finally {
      setLoading(false);
    }
  };

  // Load custom categories
  const fetchCustomCategories = async () => {
    try {
      const res = await api.get('/api/categories', { type: 'INCOME' });
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
    fetchIncomes();
  }, [search, selectedCategory, selectedPaymentMode, selectedMonth, selectedYear, sortOrder]);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormData(initialFormState);
    setShowAddModal(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setFormData({
      donorName: item.donorName,
      donorPhone: item.donorPhone || '',
      donorAddress: item.donorAddress || '',
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

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this income entry?')) return;
    try {
      await api.del(`/api/income/${id}`);
      fetchIncomes();
    } catch (err) {
      alert(err.message || 'Failed to delete income record');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingItem) {
        await api.put(`/api/income/${editingItem.id}`, formData);
      } else {
        await api.post('/api/income', formData);
      }
      setShowAddModal(false);
      fetchIncomes();
    } catch (err) {
      alert(err.message || 'Failed to save income record');
    } finally {
      setSubmitting(false);
    }
  };

  // Export to PDF
  const handleExportPdf = ({ scope, month, year, periodLabel }) => {
    const dataToExport = incomes.filter(inc => {
      if (scope === 'all') return true;
      const d = new Date(inc.date);
      return (d.getMonth() + 1 === month) && (d.getFullYear() === year);
    });

    const columns = ['Date', 'Donor Name', 'Category', 'Payment Mode', 'Phone', 'Amount (₹)'];
    const rows = dataToExport.map(item => [
      new Date(item.date).toLocaleDateString('en-GB'),
      item.donorName,
      item.category,
      item.paymentMode,
      item.donorPhone || '-',
      '₹' + Number(item.amount).toLocaleString('en-IN')
    ]);

    const total = dataToExport.reduce((acc, c) => acc + c.amount, 0);

    exportToPdf({
      title: 'جامعة النور - Income Statement',
      subtitle: `Total Records: ${dataToExport.length}`,
      dateRange: periodLabel,
      columns,
      rows,
      summaryRows: [
        { label: 'Total Collections:', value: '₹' + Number(total).toLocaleString('en-IN'), bold: true, highlight: true }
      ],
      fileName: `Jamia_AnNoor_Income_${periodLabel.replace(/\s+/g, '_')}.pdf`
    });
  };

  // Export to Excel
  const handleExportExcel = ({ scope, month, year, periodLabel }) => {
    const dataToExport = incomes.filter(inc => {
      if (scope === 'all') return true;
      const d = new Date(inc.date);
      return (d.getMonth() + 1 === month) && (d.getFullYear() === year);
    });

    const excelRows = dataToExport.map(item => ({
      'Date': new Date(item.date).toLocaleDateString('en-GB'),
      'Donor Name': item.donorName,
      'Donor Phone': item.donorPhone || '',
      'Address': item.donorAddress || '',
      'Category': item.category,
      'Payment Mode': item.paymentMode,
      'Amount (INR)': item.amount,
      'Description / Notes': item.description || '',
    }));

    exportToExcel({
      data: excelRows,
      sheetName: 'Income Collections',
      fileName: `Jamia_AnNoor_Income_${periodLabel.replace(/\s+/g, '_')}.xlsx`
    });
  };

  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2];
  const totalAmountSum = useMemo(() => incomes.reduce((acc, i) => acc + i.amount, 0), [incomes]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 15;

  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedCategory, selectedPaymentMode, selectedMonth, selectedYear, sortOrder]);

  const paginatedIncomes = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return incomes.slice(startIndex, startIndex + PAGE_SIZE);
  }, [incomes, currentPage]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header & Export Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            Income Management
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-semibold">
              {incomes.length} Records
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Record, track donations, Jumma collections, zakat, and download statements
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowExportModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-xs transition-colors"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            Download Statement
          </button>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-md shadow-emerald-600/25 transition-transform active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Add Income
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
              placeholder="Search donor, phone, address..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="All">All Categories</option>
              {DEFAULT_INCOME_CATEGORIES.map((c, i) => (
                <option key={i} value={c}>{c}</option>
              ))}
              {customCategories.map((c, i) => (
                <option key={`c-${i}`} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Payment Mode Filter */}
          <div>
            <select
              value={selectedPaymentMode}
              onChange={(e) => setSelectedPaymentMode(e.target.value)}
              className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="All">All Modes</option>
              {PAYMENT_MODES.map((m, i) => (
                <option key={i} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Month Filter */}
          <div>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="All">All Months</option>
              {MONTH_NAMES.map((name, idx) => (
                <option key={idx} value={idx + 1}>{name}</option>
              ))}
            </select>
          </div>

          {/* Sort Order */}
          <div>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="newest">Sort: Newest First</option>
              <option value="oldest">Sort: Oldest First</option>
            </select>
          </div>
        </div>

        {/* Total Sum Bar */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <span className="text-slate-500">Filtered Total Collection:</span>
          <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
            ₹{totalAmountSum.toLocaleString('en-IN')}
          </span>
        </div>
      </div>

      {/* MOBILE VIEW: Cards for Zero Horizontal Sliding */}
      <div className="block md:hidden space-y-3">
        {loading ? (
          <div className="py-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading incomes...
          </div>
        ) : incomes.length === 0 ? (
          <div className="py-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 text-xs">
            No income records found for the selected criteria.
          </div>
        ) : (
          <>
            {paginatedIncomes.map((item) => (
              <div
                key={item.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-4 shadow-xs space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-sm text-slate-900 dark:text-white">
                      {item.donorName}
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                      <span>{new Date(item.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                      <span>•</span>
                      <span>{item.paymentMode}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {item.proofImage && (
                      <button
                        type="button"
                        onClick={() => { setProofModalUrl(item.proofImage); setShowProofModal(true); }}
                        className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                        title="View Proof"
                      >
                        <ImageIcon className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleOpenEdit(item)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                      title="Edit Income"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      title="Delete Income"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-slate-800">
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/50">
                    {item.category}
                  </span>
                  <span className="font-extrabold text-base text-emerald-600 dark:text-emerald-400">
                    +₹{Number(item.amount).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            ))}
            <Pagination
              currentPage={currentPage}
              totalItems={incomes.length}
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
                <th className="py-3.5 px-4">Donor Details</th>
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
                    <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading income records...
                  </td>
                </tr>
              ) : incomes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No income records found for the selected criteria.
                  </td>
                </tr>
              ) : (
                paginatedIncomes.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {new Date(item.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {item.donorName}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {item.donorPhone && <span>📞 {item.donorPhone}</span>}
                        {item.donorAddress && <span className="ml-2">📍 {item.donorAddress}</span>}
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
                      <span className="px-2 py-1 rounded-md text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/50">
                        {item.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-600 dark:text-slate-300">
                      {item.paymentMode}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                      +₹{Number(item.amount).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      {item.proofImage ? (
                        <button
                          type="button"
                          onClick={() => { setProofModalUrl(item.proofImage); setShowProofModal(true); }}
                          className="inline-flex items-center gap-1 text-[11px] text-emerald-600 hover:text-emerald-700 font-medium hover:underline"
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
                          onClick={() => handleOpenEdit(item)}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors"
                          title="Edit Income"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                          title="Delete Income"
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
          totalItems={incomes.length}
          pageSize={PAGE_SIZE}
          onPageChange={setCurrentPage}
          className="p-4"
        />
      </div>

      {/* Add / Edit Income Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-xl w-full my-8 p-6 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingItem ? 'Edit Income Record' : 'Record New Income'}
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
                {/* Donor Name */}
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Donor Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Haji Farooq or Jumma Collection"
                    value={formData.donorName}
                    onChange={(e) => setFormData({ ...formData, donorName: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Donor Phone */}
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. 9845012345"
                    value={formData.donorPhone}
                    onChange={(e) => setFormData({ ...formData, donorPhone: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
                  Donor Address / Location
                </label>
                <input
                  type="text"
                  placeholder="e.g. House #14, Bilal Street"
                  value={formData.donorAddress}
                  onChange={(e) => setFormData({ ...formData, donorAddress: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Category Dropdown (with custom category addition) */}
                <CategoryDropdown
                  label="Category"
                  value={formData.category}
                  onChange={(cat) => setFormData({ ...formData, category: cat })}
                  defaultCategories={DEFAULT_INCOME_CATEGORIES}
                  customCategories={customCategories}
                  onCategoryAdded={(newCat) => setCustomCategories([...customCategories, newCat])}
                  type="INCOME"
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
                    placeholder="e.g. 5000"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-3 py-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
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
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    {PAYMENT_MODES.map((mode, i) => (
                      <option key={i} value={mode}>{mode}</option>
                    ))}
                  </select>
                </div>

                {/* Date */}
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Receipt Date
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Description (Optional) */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
                  Description / Remarks (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Additional notes, receipt reference, or purpose..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
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
                      Receipt / Proof Image
                    </label>
                    <p className="text-[11px] text-slate-400">Capture with camera or choose from device</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCameraModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-colors"
                  >
                    <Camera className="w-3.5 h-3.5 text-emerald-600" />
                    {formData.proofImage ? 'Change Proof' : 'Attach Proof'}
                  </button>
                </div>

                {formData.proofImage && (
                  <div className="mt-3 flex items-center gap-3 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                    <img
                      src={formData.proofImage}
                      alt="Proof"
                      className="w-12 h-12 rounded-lg object-cover border border-slate-200"
                    />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-200">Image Attached</p>
                      <button
                        type="button"
                        onClick={() => { setProofModalUrl(formData.proofImage); setShowProofModal(true); }}
                        className="text-[11px] text-emerald-600 hover:underline"
                      >
                        Preview Image
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

              {/* Form Actions */}
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
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md disabled:opacity-50 transition-all"
                >
                  <Check className="w-4 h-4" />
                  {submitting ? 'Saving...' : editingItem ? 'Update Income' : 'Save Income'}
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
        title="Income Proof / Voucher"
      />

      {/* Camera / Device Upload Modal */}
      <CameraCaptureModal
        isOpen={showCameraModal}
        onClose={() => setShowCameraModal(false)}
        currentImage={formData.proofImage}
        onCapture={(imgData) => setFormData({ ...formData, proofImage: imgData })}
      />

      {/* Statement Export Modal (PDF / Excel) */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="Export Income Statements"
        onExportPdf={handleExportPdf}
        onExportExcel={handleExportExcel}
      />
    </div>
  );
}
