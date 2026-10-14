import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Check, X, Settings2, Edit2, Trash2, AlertCircle } from 'lucide-react';
import { api } from '../utils/api';

export default function CategoryDropdown({
  label = 'Category',
  value,
  onChange,
  defaultCategories = [],
  customCategories = [],
  onCategoryAdded,
  onCategoryUpdated,
  onCategoryDeleted,
  type = 'INCOME', // 'INCOME' or 'EXPENSE'
  required = false
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Editing state for Manage Modal
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Standardize categories so every item is editable and deletable
  const categoryItems = useMemo(() => {
    // If database categories have loaded from the backend, use them as source of truth
    if (customCategories && customCategories.length > 0) {
      return customCategories.map(c => ({
        id: typeof c === 'object' ? c.id : null,
        name: typeof c === 'string' ? c : c.name
      })).filter(c => Boolean(c.name)).sort((a, b) => a.name.localeCompare(b.name));
    }

    // Fallback only before database categories finish loading
    return (defaultCategories || []).map(name => ({
      id: null,
      name
    })).filter(c => Boolean(c.name)).sort((a, b) => a.name.localeCompare(b.name));
  }, [customCategories, defaultCategories]);

  const allCategoryNames = categoryItems.map(c => c.name);

  const handleSelectChange = (e) => {
    const val = e.target.value;
    if (val === '__ADD_CUSTOM__') {
      setShowAddModal(true);
    } else if (val === '__MANAGE_CATEGORIES__') {
      setShowManageModal(true);
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
      setError(err.message || 'Failed to save category');
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (cat) => {
    setEditingId(cat.id || cat.name);
    setEditingName(cat.name);
  };

  const handleSaveEdit = async (cat) => {
    if (!editingName.trim() || loading) return;
    setLoading(true);
    try {
      let updatedCat = null;
      if (cat.id) {
        const res = await api.put(`/api/categories/${cat.id}`, {
          name: editingName.trim()
        });
        if (!res.success) throw new Error(res.message || 'Failed to update category');
        updatedCat = res.category;
      } else {
        // If it was a default before synced to DB, create it in DB
        const res = await api.post('/api/categories', {
          type,
          name: editingName.trim()
        });
        if (!res.success) throw new Error(res.message || 'Failed to save category');
        updatedCat = res.category;
      }

      if (onCategoryUpdated) {
        onCategoryUpdated(updatedCat, cat.name);
      }
      if (value === cat.name) {
        onChange(editingName.trim());
      }
      setEditingId(null);
      setEditingName('');
    } catch (err) {
      alert(err.message || 'Error updating category');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (cat) => {
    setLoading(true);
    try {
      if (cat.id) {
        const res = await api.delete(`/api/categories/${cat.id}`);
        if (!res.success) {
          throw new Error(res.message || 'Failed to delete category');
        }
      }
      if (onCategoryDeleted) {
        onCategoryDeleted(cat.id, cat.name);
      }
      if (value === cat.name) {
        onChange('');
      }
      setDeleteConfirmId(null);
    } catch (err) {
      alert(err.message || 'Error deleting category');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
        <button
          type="button"
          onClick={() => setShowManageModal(true)}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors"
          title="Edit or Delete Categories"
        >
          <Settings2 className="w-3.5 h-3.5" />
          <span>Manage</span>
        </button>
      </div>

      <div className="relative">
        <select
          value={value}
          onChange={handleSelectChange}
          required={required}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-shadow"
        >
          <option value="" disabled>Select {label}</option>
          {allCategoryNames.map((catName, i) => (
            <option key={i} value={catName}>
              {catName}
            </option>
          ))}
          <option value="__ADD_CUSTOM__" className="text-emerald-600 font-semibold">
            ➕ Add New Category
          </option>
          <option value="__MANAGE_CATEGORIES__" className="text-slate-600 font-semibold">
            ⚙️ Edit &amp; Delete Categories
          </option>
        </select>
      </div>

      {/* Add Category Modal */}
      {showAddModal && createPortal(
        <div
          className="fixed inset-0 z-[9999] overflow-y-auto bg-black/60 backdrop-blur-sm p-3 sm:p-6 flex min-h-full items-start justify-center animate-fade-in"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-sm w-full my-6 sm:my-10 p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h4 className="text-base font-bold text-slate-800 dark:text-slate-100">
                Add New Category
              </h4>
              <button
                type="button"
                onClick={() => { setShowAddModal(false); setNewCatName(''); setError(''); }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-300 mb-1">
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
                      handleCreateCategory(e);
                    }
                  }}
                  autoFocus
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                {error && <p className="text-xs text-rose-500 mt-1">{error}</p>}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); setNewCatName(''); setError(''); }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateCategory}
                  disabled={loading || !newCatName.trim()}
                  className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                >
                  {loading ? 'Saving...' : 'Add Category'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Manage / Edit / Delete Categories Modal */}
      {showManageModal && createPortal(
        <div
          className="fixed inset-0 z-[9999] overflow-y-auto bg-black/60 backdrop-blur-sm p-3 sm:p-6 flex min-h-full items-start justify-center animate-fade-in"
          onClick={() => { setShowManageModal(false); setEditingId(null); setDeleteConfirmId(null); }}
        >
          <div
            className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-lg w-full my-6 sm:my-10 p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shrink-0 flex flex-col max-h-[88vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-emerald-600" />
                <h4 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  Manage {type === 'INCOME' ? 'Income' : 'Expense'} Categories
                </h4>
              </div>
              <button
                type="button"
                onClick={() => { setShowManageModal(false); setEditingId(null); setDeleteConfirmId(null); }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Add at Top */}
            <div className="py-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                Add New Category:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="New category name..."
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateCategory(e);
                    }
                  }}
                  className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCreateCategory}
                  disabled={loading || !newCatName.trim()}
                  className="px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs disabled:opacity-50 flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>
            </div>

            {/* Scrollable Categories List */}
            <div className="overflow-y-auto py-3 space-y-2 flex-1">
              <div className="flex items-center justify-between mb-1">
                <h5 className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  All Categories ({categoryItems.length})
                </h5>
                <span className="text-[10px] text-slate-400">Click pencil to edit or trash to delete</span>
              </div>

              {categoryItems.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">
                  No categories found. Add one above!
                </p>
              ) : (
                <div className="space-y-1.5">
                  {categoryItems.map((cat) => {
                    const isEditing = editingId === (cat.id || cat.name);
                    const isConfirmingDelete = deleteConfirmId === (cat.id || cat.name);

                    return (
                      <div
                        key={cat.id || cat.name}
                        className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        {isEditing ? (
                          <div className="flex items-center gap-2 flex-1 mr-2">
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              className="w-full px-2.5 py-1 text-xs rounded-lg border border-emerald-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(cat)}
                              className="p-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                              title="Save"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => { setEditingId(null); setEditingName(''); }}
                              className="p-1 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : isConfirmingDelete ? (
                          <div className="flex items-center justify-between w-full">
                            <span className="text-xs text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" /> Delete "{cat.name}"?
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleDeleteCategory(cat)}
                                className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-rose-600 text-white hover:bg-rose-700 shadow-xs"
                              >
                                Yes, Delete
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(null)}
                                className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                              {cat.name}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleStartEdit(cat)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                                title="Edit Category Name"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(cat.id || cat.name)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                title="Delete Category"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => { setShowManageModal(false); setEditingId(null); setDeleteConfirmId(null); }}
                className="px-4 py-2 text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
