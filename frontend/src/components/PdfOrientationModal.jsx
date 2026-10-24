import React from 'react';
import { createPortal } from 'react-dom';
import { X, FileText, CheckCircle2 } from 'lucide-react';

export default function PdfOrientationModal({
  isOpen,
  onClose,
  onSelect,
  title = 'Select PDF Orientation',
  recommended = 'landscape'
}) {
  if (!isOpen) return null;

  const handleChoose = (orientation) => {
    onSelect(orientation);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">{title}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Choose page layout before downloading</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Options */}
        <div className="p-5 space-y-3">
          {/* Landscape Option */}
          <button
            type="button"
            onClick={() => handleChoose('landscape')}
            className={`w-full text-left p-4 rounded-2xl border-2 transition-all flex items-start justify-between group ${
              recommended === 'landscape'
                ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                : 'border-slate-200 dark:border-slate-700 hover:border-emerald-400 bg-slate-50/50 dark:bg-slate-800/40'
            }`}
          >
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-9 rounded-lg border-2 border-slate-400 dark:border-slate-500 bg-white dark:bg-slate-800 flex items-center justify-center shrink-0 shadow-xs group-hover:border-emerald-500 transition-colors">
                <div className="w-8 h-5 border border-dashed border-slate-400 rounded-sm" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-800 dark:text-slate-100 group-hover:text-emerald-600">
                    Landscape (Horizontal)
                  </span>
                  {recommended === 'landscape' && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                      Recommended
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Wide table layout (842 × 595 pt). Gives maximum horizontal room so multiple columns never wrap or truncate.
                </p>
              </div>
            </div>
            {recommended === 'landscape' && (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            )}
          </button>

          {/* Portrait Option */}
          <button
            type="button"
            onClick={() => handleChoose('portrait')}
            className={`w-full text-left p-4 rounded-2xl border-2 transition-all flex items-start justify-between group ${
              recommended === 'portrait'
                ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                : 'border-slate-200 dark:border-slate-700 hover:border-emerald-400 bg-slate-50/50 dark:bg-slate-800/40'
            }`}
          >
            <div className="flex items-start gap-3.5">
              <div className="w-9 h-12 rounded-lg border-2 border-slate-400 dark:border-slate-500 bg-white dark:bg-slate-800 flex items-center justify-center shrink-0 shadow-xs group-hover:border-emerald-500 transition-colors">
                <div className="w-5 h-8 border border-dashed border-slate-400 rounded-sm" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-800 dark:text-slate-100 group-hover:text-emerald-600">
                    Portrait (Vertical)
                  </span>
                  {recommended === 'portrait' && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                      Recommended
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Standard vertical page (595 × 842 pt). Best for standard A4 vertical document binders and printing.
                </p>
              </div>
            </div>
            {recommended === 'portrait' && (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            )}
          </button>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
