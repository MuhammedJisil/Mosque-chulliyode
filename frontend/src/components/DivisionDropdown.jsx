import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Check, X, Settings2, Edit2, Trash2, AlertCircle, Building } from 'lucide-react';
import { api } from '../utils/api';

export default function DivisionDropdown({
  label = 'Division / Area',
  value,
  onChange,
  onDivisionListChange,
  required = false,
  className = '',
}) {
  const [divisions, setDivisions] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [newDivName, setNewDivName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Editing state for Manage Modal
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Fetch divisions from API
  const fetchDivisions = async () => {
    try {
      const res = await api.get('/api/divisions');
      if (res.success && Array.isArray(res.divisions)) {
        setDivisions(res.divisions);
        if (onDivisionListChange) {
          onDivisionListChange(res.divisions);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch divisions:', err.message);
    }
  };

  useEffect(() => {
    fetchDivisions();
  }, []);

  const divisionItems = useMemo(() => {
    return [...divisions].sort((a, b) => a.name.localeCompare(b.name));
  }, [divisions]);

  const handleSelectChange = (e) => {
    const val = e.target.value;
    if (val === '__ADD_CUSTOM__') {
      setShowAddModal(true);
    } else if (val === '__MANAGE_DIVISIONS__') {
      setShowManageModal(true);
    } else {
      onChange(val);
    }
  };

  const handleCreateDivision = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!newDivName.trim() || loading) return;

    setLoading(true);
    setError('');

    try {
      const res = await api.post('/api/divisions', {
        name: newDivName.trim(),
      });

      if (res.success && res.division) {
        setDivisions(prev => {
          const exists = prev.some(d => d.id === res.division.id || d.name.toLowerCase() === res.division.name.toLowerCase());
          if (exists) return prev;
          const next = [...prev, res.division];
          if (onDivisionListChange) onDivisionListChange(next);
          return next;
        });
        onChange(res.division.name);
        setNewDivName('');
        setShowAddModal(false);
      } else {
        setError(res.message || 'Failed to save division');
      }
    } catch (err) {
      setError(err.message || 'Failed to save division');
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (div) => {
    setEditingId(div.id || div.name);
    setEditingName(div.name);
  };

  const handleSaveEdit = async (div) => {
    if (!editingName.trim() || loading) return;
    setLoading(true);
    try {
      const res = await api.put(`/api/divisions/${div.id}`, {
        name: editingName.trim()
      });
      if (!res.success) throw new Error(res.message || 'Failed to update division');

      const updated = res.division;
      setDivisions(prev => {
        const next = prev.map(d => d.id === div.id ? updated : d);
        if (onDivisionListChange) onDivisionListChange(next);
        return next;
      });

      if (value === div.name) {
        onChange(editingName.trim());
      }
      setEditingId(null);
      setEditingName('');
    } catch (err) {
      alert(err.message || 'Error updating division');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDivision = async (div) => {
    setLoading(true);
    try {
      const res = await api.delete(`/api/divisions/${div.id}`);
      if (!res.success) {
        throw new Error(res.message || 'Failed to delete division');
      }

      setDivisions(prev => {
        const next = prev.filter(d => d.id !== div.id);
        if (onDivisionListChange) onDivisionListChange(next);
        return next;
      });

      if (value === div.name) {
        onChange('');
      }
      setDeleteConfirmId(null);
    } catch (err) {
      alert(err.message || 'Error deleting division');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
        <button
          type="button"
          onClick={() => setShowManageModal(true)}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
          title="Edit or Delete Divisions / Areas"
        >
          <Settings2 className="w-3.5 h-3.5" />
          <span>Manage</span>
        </button>
      </div>

      <div className="relative">
        <select
          value={value || ''}
          onChange={handleSelectChange}
          required={required}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-shadow"
        >
          <option value="">Select {label}</option>
          {divisionItems.map((d) => (
            <option key={d.id || d.name} value={d.name}>
              {d.name}
            </option>
          ))}
          {value && !divisionItems.some(d => d.name === value) && (
            <option value={value}>{value}</option>
          )}
          <option value="__ADD_CUSTOM__" className="text-blue-600 font-semibold">
            ➕ Add New Division
          </option>
          <option value="__MANAGE_DIVISIONS__" className="text-slate-600 font-semibold">
            ⚙️ Edit &amp; Delete Divisions
          </option>
        </select>
      </div>

      {/* Add Division Modal */}
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
              <div className="flex items-center gap-2">
                <Building className="w-5 h-5 text-blue-600" />
                <h4 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  Add New Division / Area
                </h4>
              </div>
              <button
                type="button"
                onClick={() => { setShowAddModal(false); setNewDivName(''); setError(''); }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-300 mb-1">
                  Division Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ward 4, Kozhikode Rd"
                  value={newDivName}
                  onChange={(e) => setNewDivName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateDivision(e);
                    }
                  }}
                  autoFocus
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                {error && <p className="text-xs text-rose-500 mt-1">{error}</p>}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); setNewDivName(''); setError(''); }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateDivision}
                  disabled={loading || !newDivName.trim()}
                  className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                >
                  {loading ? 'Saving...' : 'Add Division'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Manage / Edit / Delete Divisions Modal */}
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
                <Settings2 className="w-5 h-5 text-blue-600" />
                <h4 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  Manage Divisions / Areas
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
                Add New Division:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="New division name..."
                  value={newDivName}
                  onChange={(e) => setNewDivName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateDivision(e);
                    }
                  }}
                  className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCreateDivision}
                  disabled={loading || !newDivName.trim()}
                  className="px-3.5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs disabled:opacity-50 flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>
            </div>

            {/* Scrollable Divisions List */}
            <div className="overflow-y-auto py-3 space-y-2 flex-1">
              <div className="flex items-center justify-between mb-1">
                <h5 className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  All Divisions ({divisionItems.length})
                </h5>
                <span className="text-[10px] text-slate-400">Renaming updates members &amp; records</span>
              </div>

              {divisionItems.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">
                  No divisions found. Add one above!
                </p>
              ) : (
                <div className="space-y-1.5">
                  {divisionItems.map((div) => {
                    const isEditing = editingId === (div.id || div.name);
                    const isConfirmingDelete = deleteConfirmId === (div.id || div.name);

                    return (
                      <div
                        key={div.id || div.name}
                        className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        {isEditing ? (
                          <div className="flex items-center gap-2 flex-1 mr-2">
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              className="w-full px-2.5 py-1 text-xs rounded-lg border border-blue-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(div)}
                              className="p-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
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
                              <AlertCircle className="w-3.5 h-3.5" /> Delete "{div.name}"?
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleDeleteDivision(div)}
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
                              {div.name}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleStartEdit(div)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                                title="Edit Division Name"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(div.id || div.name)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                title="Delete Division"
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
