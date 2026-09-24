import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

export default function CustomFieldInput({ fields = [], onChange }) {
  const addField = () => {
    onChange([...fields, { name: '', value: '' }]);
  };

  const removeField = (index) => {
    const updated = fields.filter((_, i) => i !== index);
    onChange(updated);
  };

  const updateField = (index, key, val) => {
    const updated = fields.map((f, i) => (i === index ? { ...f, [key]: val } : f));
    onChange(updated);
  };

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Custom Fields (Optional)
        </label>
        <button
          type="button"
          onClick={addField}
          className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Custom Field
        </button>
      </div>

      {fields.length === 0 ? (
        <p className="text-xs text-slate-400 italic">No custom fields added. Click above to add extra fields (e.g. Cheque No, Tax ID, Remarks).</p>
      ) : (
        <div className="space-y-2">
          {fields.map((field, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Field Name (e.g. Receipt #)"
                value={field.name}
                onChange={(e) => updateField(idx, 'name', e.target.value)}
                className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              <input
                type="text"
                placeholder="Field Value"
                value={field.value}
                onChange={(e) => updateField(idx, 'value', e.target.value)}
                className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => removeField(idx)}
                className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition-colors"
                title="Remove field"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
