import React, { useState } from 'react';
import { X, FileText, Download, Calendar } from 'lucide-react';
import { MONTH_NAMES } from '../utils/categoriesData';

export default function ExportModal({
  isOpen,
  onClose,
  title = 'Export Statement',
  onExportPdf,
  onExportExcel,
}) {
  const currentYear = new Date().getFullYear();
  const [exportScope, setExportScope] = useState('all'); // 'all' or 'month'
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentYear);

  if (!isOpen) return null;

  const years = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2, currentYear - 3];

  const handleExport = (format) => {
    const filter = {
      scope: exportScope,
      month: exportScope === 'month' ? selectedMonth : null,
      year: exportScope === 'month' ? selectedYear : null,
      periodLabel: exportScope === 'month' ? `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}` : 'All Records',
    };

    if (format === 'pdf' && onExportPdf) {
      onExportPdf(filter);
    } else if (format === 'excel' && onExportExcel) {
      onExportExcel(filter);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <FileText className="w-5 h-5" />
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-2">
              Select Statement Range
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setExportScope('all')}
                className={`py-2.5 px-3 rounded-xl text-sm font-medium border text-center transition-all ${
                  exportScope === 'all'
                    ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-semibold'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                All Records
              </button>
              <button
                type="button"
                onClick={() => setExportScope('month')}
                className={`py-2.5 px-3 rounded-xl text-sm font-medium border text-center transition-all ${
                  exportScope === 'month'
                    ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-semibold'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                Specific Month
              </button>
            </div>
          </div>

          {exportScope === 'month' && (
            <div className="grid grid-cols-2 gap-3 pt-2 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-100 dark:border-slate-700/50">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Month
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  {MONTH_NAMES.map((name, idx) => (
                    <option key={idx} value={idx + 1}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Year
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-3">
              Choose Download Format
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleExport('pdf')}
                className="flex items-center justify-center gap-2 py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-medium text-sm shadow-md transition-all active:scale-95"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </button>

              <button
                type="button"
                onClick={() => handleExport('excel')}
                className="flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium text-sm shadow-md transition-all active:scale-95"
              >
                <Download className="w-4 h-4" />
                Download Excel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
