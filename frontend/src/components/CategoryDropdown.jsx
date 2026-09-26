import React, { useState } from 'react';
import { Plus, Check, X } from 'lucide-react';
import { api } from '../utils/api';

export default function CategoryDropdown({
  label = 'Category',
  value,
  onChange,
  defaultCategories = [],
  customCategories = [],
  onCategoryAdded,
  type = 'INCOME', // 'INCOME' or 'EXPENSE'
  required = false
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Merge default categories with custom categories, avoiding duplicates
  const allCategories = Array.from(new Set([
    ...defaultCategories,
    ...customCategories.map(c => typeof c === 'string' ? c : c.name)
  ]));

  const handleSelectChange = (e) => {
    const val = e.target.value;
    if (val === '__ADD_CUSTOM__') {
      setShowAddModal(true);
    } else {
      onChange(val);
    }
  };

  const handleCreateCategory = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!newCatName.trim() || loading) return;

    setLoading(true);
    setError('');

    try {
      const res = await api.post('/api/categories', {
        type,
        name: newCatName.trim(),
      });

      if (res.success && res.category) {
        if (onCategoryAdded) {
          onCategoryAdded(res.category);
        }
        onChange(res.category.name);
        setNewCatName('');
        setShowAddModal(false);
      } else {
        setError(res.message || 'Failed to save category');
      }
    } catch (err) {
      setError(err.message || 'Failed to save custom category');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={handleSelectChange}
          required={required}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-shadow"
        >
          <option value="" disabled>Select {label}</option>
          {allCategories.map((cat, i) => (
            <option key={i} value={cat}>
              {cat}
            </option>
          ))}
          <option value="__ADD_CUSTOM__" className="text-emerald-600 font-semibold">
            ➕ Add Custom Category
          </option>
        </select>
      </div>

      {/* Modal for adding custom category */}
      {showAddModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in"
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <div 
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-slate-200 dark:border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                Add Custom Category
              </h4>
              <button
                type="button"
                onClick={() => { setShowAddModal(false); setNewCatName(''); setError(''); }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Category Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Solar Project Fund"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      handleCreateCategory(e);
                    }
                  }}
                  autoFocus
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                {error && <p className="text-xs text-rose-500 mt-1">{error}</p>}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); setNewCatName(''); setError(''); }}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateCategory}
                  disabled={loading || !newCatName.trim()}
                  className="px-4 py-2 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                >
                  {loading ? 'Saving...' : 'Add Category'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
