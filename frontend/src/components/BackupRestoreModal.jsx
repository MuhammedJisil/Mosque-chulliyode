import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Download, Upload, Database, AlertTriangle, CheckCircle2, X, RefreshCw, FileText } from 'lucide-react';
import { api } from '../utils/api';
import { useToast } from '../context/ToastContext';

export default function BackupRestoreModal({ isOpen, onClose }) {
  const toast = useToast();
  const fileInputRef = useRef(null);

  const [downloading, setDownloading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [parsedBackup, setParsedBackup] = useState(null);
  const [parseError, setParseError] = useState('');

  if (!isOpen) return null;

  // Handle Download Backup File
  const handleDownloadBackup = async () => {
    setDownloading(true);
    try {
      const res = await api.get('/api/backup/export');
      if (res.success && res.backup) {
        const jsonStr = JSON.stringify(res.backup, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const dateStr = new Date().toISOString().split('T')[0];
        a.href = url;
        a.download = `Masjid_Al_Noor_Backup_${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast.success('Backup file successfully downloaded to your device!');
      } else {
        toast.error(res.message || 'Failed to generate backup.');
      }
    } catch (err) {
      toast.error(err.message || 'Error downloading backup');
    } finally {
      setDownloading(false);
    }
  };

  // Handle File Selection
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    setParseError('');
    setParsedBackup(null);
    setSelectedFile(null);

    if (!file) return;

    if (!file.name.endsWith('.json')) {
      setParseError('Please select a valid .json backup file.');
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result);
        if (!json || !json.data) {
          throw new Error('Unrecognized backup format. Missing data payload.');
        }
        setParsedBackup(json);
      } catch (err) {
        setParseError('Invalid backup file: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  // Handle Restore
  const handleExecuteRestore = async () => {
    if (!parsedBackup) return;
    setRestoring(true);
    try {
      const res = await api.post('/api/backup/restore', {
        backupData: parsedBackup
      });

      if (res.success) {
        toast.success('Database successfully restored from backup! Refreshing app...');
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        toast.error(res.message || 'Failed to restore backup.');
      }
    } catch (err) {
      toast.error(err.message || 'Error restoring database');
    } finally {
      setRestoring(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] overflow-y-auto bg-black/60 backdrop-blur-sm p-3 sm:p-6 flex min-h-full items-start justify-center animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-lg w-full my-6 sm:my-10 p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shrink-0 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Full Restoring Loading Overlay */}
        {restoring && (
          <div className="absolute inset-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm rounded-3xl flex flex-col items-center justify-center p-6 text-center space-y-4 animate-fade-in">
            <div className="w-14 h-14 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <div className="space-y-1">
              <h4 className="text-base font-bold text-slate-900 dark:text-white">
                Restoring Database from Backup...
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
                Importing all tables, members, payments, and accounting records. Please wait and do not close or refresh this tab.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Applying database changes...</span>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-700 flex items-center justify-center text-emerald-700 dark:text-emerald-300">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Data Backup & Restore
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Masjid al noor • Save to desktop/mobile & restore anytime
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="py-5 space-y-6">
          {/* Section 1: Export / Download Backup */}
          <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/60 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-sm font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-emerald-600" />
                  1. Backup All Mosque Data
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Download a complete backup JSON file containing all members, monthly payments, incomes, expenses, staff records, salaries, and custom categories.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDownloadBackup}
              disabled={downloading}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {downloading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating Backup File...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Download Backup File (.json)
                </>
              )}
            </button>
          </div>

          {/* Section 2: Upload / Restore Backup */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Upload className="w-4 h-4 text-emerald-600" />
                  2. Restore From Backup File
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Select a previously downloaded backup JSON file from your desktop or phone to restore data.
                </p>
              </div>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
            />

            {!selectedFile ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3 px-4 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
              >
                <FileText className="w-4 h-4 text-slate-400" />
                Select Backup File from Device
              </button>
            ) : (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-semibold truncate text-slate-800 dark:text-slate-200">
                      {selectedFile.name}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      setParsedBackup(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="text-slate-400 hover:text-rose-600 ml-2"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {parseError && (
                  <p className="text-xs text-rose-500 font-medium">{parseError}</p>
                )}

                {parsedBackup && (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-xs space-y-2">
                    <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-bold">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      Ready to Restore
                    </div>
                    <div className="text-[11px] text-amber-900/80 dark:text-amber-300/80 space-y-0.5">
                      <p>• Exported On: {parsedBackup.exportedAt ? new Date(parsedBackup.exportedAt).toLocaleString('en-GB') : 'Unknown'}</p>
                      <p>
                        • Records Found: {parsedBackup.counts?.members || parsedBackup.data?.members?.length || 0} Members, {parsedBackup.counts?.incomes || parsedBackup.data?.incomes?.length || 0} Incomes, {parsedBackup.counts?.expenses || parsedBackup.data?.expenses?.length || 0} Expenses, {parsedBackup.counts?.staff || parsedBackup.data?.staff?.length || 0} Staff.
                      </p>
                      <p className="font-bold text-rose-600 dark:text-rose-400 pt-1">
                        ⚠️ Restoring will overwrite existing database records with this backup.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleExecuteRestore}
                      disabled={restoring}
                      className="w-full py-2 px-3 mt-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {restoring ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Restoring Data...
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5" />
                          Confirm & Restore Data Now
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
