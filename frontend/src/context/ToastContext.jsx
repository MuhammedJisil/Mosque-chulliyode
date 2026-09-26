import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message, type = 'success', duration = 3500) => {
    const id = Date.now() + Math.random().toString(36).substr(2, 5);
    const newToast = { id, message, type };
    setToasts((prev) => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const success = useCallback((msg, duration) => addToast(msg, 'success', duration), [addToast]);
  const error = useCallback((msg, duration) => addToast(msg, 'error', duration), [addToast]);
  const info = useCallback((msg, duration) => addToast(msg, 'info', duration), [addToast]);

  return (
    <ToastContext.Provider value={{ toast: { success, error, info } }}>
      {children}
      {/* Toast Notification Container */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-2xl shadow-xl backdrop-blur-md transition-all duration-300 animate-in slide-in-from-top-2 border ${
              t.type === 'success'
                ? 'bg-emerald-600/95 text-white border-emerald-400/30 shadow-emerald-900/25'
                : t.type === 'error'
                ? 'bg-rose-600/95 text-white border-rose-400/30 shadow-rose-900/25'
                : 'bg-slate-900/95 text-white border-slate-700/50 shadow-black/25'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {t.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-200 shrink-0" />}
              {t.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-200 shrink-0" />}
              {t.type === 'info' && <Info className="w-5 h-5 text-blue-200 shrink-0" />}
              <span className="text-xs sm:text-sm font-semibold tracking-wide leading-tight">
                {t.message}
              </span>
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    // Fallback if rendered outside provider
    return {
      toast: {
        success: (m) => console.log('Toast success:', m),
        error: (m) => console.error('Toast error:', m),
        info: (m) => console.log('Toast info:', m),
      }
    };
  }
  return context;
}
