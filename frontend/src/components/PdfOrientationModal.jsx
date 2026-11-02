import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, FileText, CheckCircle2, Download, ArrowRight } from 'lucide-react';

export default function PdfOrientationModal({
  isOpen,
  onClose,
  onSelect,
  title = 'Select PDF Orientation',
  recommended = 'landscape'
}) {
  const [selected, setSelected] = useState(recommended);

  useEffect(() => {
    setSelected(recommended);
  }, [recommended, isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onSelect(selected);
    onClose();
  };

  const handleChooseDirect = (orientation) => {
    setSelected(orientation);
    onSelect(orientation);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">{title}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Choose portrait or landscape layout</p>
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
          <div
            onClick={() => setSelected('landscape')}
            onDoubleClick={() => handleChooseDirect('landscape')}
            className={`w-full text-left p-4 rounded-2xl border-2 transition-all flex items-start justify-between cursor-pointer ${
              selected === 'landscape'
                ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20'
                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-slate-50/40 dark:bg-slate-800/30'
            }`}
          >
            <div className="flex items-start gap-3.5">
              <div className={`w-12 h-9 rounded-lg border-2 flex items-center justify-center shrink-0 shadow-xs transition-colors ${
                selected === 'landscape' ? 'border-emerald-500 bg-emerald-100/60 dark:bg-emerald-900/40' : 'border-slate-400 dark:border-slate-500 bg-white dark:bg-slate-800'
              }`}>
                <div className={`w-8 h-5 border border-dashed rounded-sm ${selected === 'landscape' ? 'border-emerald-600 dark:border-emerald-400' : 'border-slate-400'}`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`font-bold text-sm ${selected === 'landscape' ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-800 dark:text-slate-100'}`}>
                    Landscape (Horizontal)
                  </span>
                  {recommended === 'landscape' && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                      Recommended
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Wide table layout (842 × 595 pt). Generates maximum horizontal room for all survey and details columns.
                </p>
              </div>
            </div>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
              selected === 'landscape' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 dark:border-slate-600'
            }`}>
              {selected === 'landscape' && <CheckCircle2 className="w-4 h-4 text-white" />}
            </div>
          </div>

          {/* Portrait Option */}
          <div
            onClick={() => setSelected('portrait')}
            onDoubleClick={() => handleChooseDirect('portrait')}
            className={`w-full text-left p-4 rounded-2xl border-2 transition-all flex items-start justify-between cursor-pointer ${
              selected === 'portrait'
                ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20'
                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-slate-50/40 dark:bg-slate-800/30'
            }`}
          >
            <div className="flex items-start gap-3.5">
              <div className={`w-9 h-12 rounded-lg border-2 flex items-center justify-center shrink-0 shadow-xs transition-colors ${
                selected === 'portrait' ? 'border-emerald-500 bg-emerald-100/60 dark:bg-emerald-900/40' : 'border-slate-400 dark:border-slate-500 bg-white dark:bg-slate-800'
              }`}>
                <div className={`w-5 h-8 border border-dashed rounded-sm ${selected === 'portrait' ? 'border-emerald-600 dark:border-emerald-400' : 'border-slate-400'}`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`font-bold text-sm ${selected === 'portrait' ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-800 dark:text-slate-100'}`}>
                    Portrait (Vertical)
                  </span>
                  {recommended === 'portrait' && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                      Recommended
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Standard vertical page (595 × 842 pt). Compact format designed for standard portrait A4 clipboards & binders.
                </p>
              </div>
            </div>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
              selected === 'portrait' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 dark:border-slate-600'
            }`}>
              {selected === 'portrait' && <CheckCircle2 className="w-4 h-4 text-white" />}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/25 transition-transform active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>Download PDF ({selected === 'portrait' ? 'Portrait' : 'Landscape'})</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
