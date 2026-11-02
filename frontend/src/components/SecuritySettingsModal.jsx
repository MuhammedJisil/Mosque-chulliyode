import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  X,
  Shield,
  KeyRound,
  UserCheck,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Lock,
  User,
  ShieldCheck,
  Fingerprint
} from 'lucide-react';

export default function SecuritySettingsModal({ isOpen, onClose }) {
  const { toast } = useToast();
  const { admin, updateAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('adminProfile'); // 'adminProfile' | 'viewer'

  // Admin ID & Password state
  const [adminUsername, setAdminUsername] = useState('');
  const [adminName, setAdminName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [updatingAdmin, setUpdatingAdmin] = useState(false);

  // Viewer User Management state
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerUsername, setViewerUsername] = useState('viewer');
  const [viewerName, setViewerName] = useState('Read-Only Viewer');
  const [viewerNewPassword, setViewerNewPassword] = useState('');
  const [showViewerPassword, setShowViewerPassword] = useState(false);
  const [updatingViewer, setUpdatingViewer] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAdminUsername(admin?.username || '');
      setAdminName(admin?.name || '');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setViewerNewPassword('');
      fetchViewerInfo();
    }
  }, [isOpen, admin]);

  const fetchViewerInfo = async () => {
    try {
      setViewerLoading(true);
      const res = await api.get('/api/auth/viewer');
      if (res.success && res.viewer) {
        setViewerUsername(res.viewer.username || 'viewer');
        setViewerName(res.viewer.name || 'Read-Only Viewer');
      }
    } catch (err) {
      console.warn('Could not fetch viewer info:', err);
    } finally {
      setViewerLoading(false);
    }
  };

  if (!isOpen) return null;

  // Password Strength calculation
  const getPasswordStrength = (pass) => {
    if (!pass) return { score: 0, label: '', color: '' };
    let score = 0;
    if (pass.length >= 8) score++;
    if (pass.length >= 12) score++;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score++;
    if (/\d/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;

    if (score <= 2) return { score: 1, label: 'Weak', color: 'bg-rose-500 text-rose-500' };
    if (score <= 3) return { score: 2, label: 'Moderate', color: 'bg-amber-500 text-amber-500' };
    return { score: 3, label: 'Strong & Hacker-Resistant', color: 'bg-emerald-500 text-emerald-500' };
  };

  const strength = getPasswordStrength(newPassword);

  const handleUpdateAdminCredentials = async (e) => {
    e.preventDefault();

    if (!currentPassword) {
      toast.error('Current administrator password is required to verify your identity.');
      return;
    }

    if (!adminUsername || adminUsername.trim().length < 3) {
      toast.error('Admin ID must be at least 3 characters long.');
      return;
    }

    if (newPassword) {
      if (newPassword.length < 8) {
        toast.error('New password must be at least 8 characters long for adequate security.');
        return;
      }

      if (newPassword !== confirmPassword) {
        toast.error('New passwords do not match. Please re-type accurately.');
        return;
      }
    }

    try {
      setUpdatingAdmin(true);
      const res = await api.put('/api/auth/admin-credentials', {
        currentPassword,
        newUsername: adminUsername.trim(),
        newName: adminName.trim(),
        newPassword: newPassword ? newPassword : undefined
      });

      if (res.success) {
        toast.success(res.message || 'Admin ID & credentials updated successfully!');
        if (updateAdmin) {
          updateAdmin(res.admin, res.token);
        }
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        onClose();
      } else {
        toast.error(res.message || 'Failed to update credentials.');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to update credentials.');
    } finally {
      setUpdatingAdmin(false);
    }
  };

  const handleUpdateViewer = async (e) => {
    e.preventDefault();

    if (!viewerUsername.trim()) {
      toast.error('Viewer username is required.');
      return;
    }

    if (viewerNewPassword && viewerNewPassword.length < 6) {
      toast.error('Viewer password must be at least 6 characters long.');
      return;
    }

    try {
      setUpdatingViewer(true);
      const res = await api.put('/api/auth/viewer', {
        username: viewerUsername,
        name: viewerName,
        password: viewerNewPassword || undefined
      });

      if (res.success) {
        toast.success(res.message || 'Viewer user credentials updated successfully!');
        setViewerNewPassword('');
        onClose();
      } else {
        toast.error(res.message || 'Failed to update viewer user.');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to update viewer user.');
    } finally {
      setUpdatingViewer(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/60 backdrop-blur-sm p-3 sm:p-6 flex min-h-full items-center justify-center animate-fade-in">
      <div className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-lg w-full border border-slate-200 dark:border-slate-800 overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                Security &amp; User Credentials
              </h3>
              <p className="text-xs text-slate-400">
                Change Admin ID, Password &amp; Manage Viewer Account
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selectors */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 px-5 pt-3 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('adminProfile')}
            className={`pb-3 px-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'adminProfile'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Fingerprint className="w-3.5 h-3.5" />
            <span>Admin ID &amp; Password</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('viewer')}
            className={`pb-3 px-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'viewer'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Manage Viewer Account</span>
          </button>
        </div>

        {/* Tab 1: Update Admin ID & Password */}
        {activeTab === 'adminProfile' && (
          <form onSubmit={handleUpdateAdminCredentials} className="p-5 space-y-4">
            <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/50 flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-emerald-800 dark:text-emerald-300 font-bold block mb-0.5">
                  Anti-Hacker Hardened Protection:
                </strong>
                You can change your <strong>Admin ID (Username)</strong>, Display Name, and/or Password. All changes require verification of your current password.
              </div>
            </div>

            {/* Admin ID (Username) */}
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
                Admin ID (Login Username) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="e.g. admin1 or your_username"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value.toLowerCase().trim())}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                This is the ID / username you use to log into the ERP. Currently: <strong className="text-emerald-600 font-semibold">{admin?.username || 'admin1'}</strong>
              </p>
            </div>

            {/* Administrator Display Name */}
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
                Administrator Display Name
              </label>
              <input
                type="text"
                placeholder="e.g. Chief Administrator / Secretary"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            {/* New Password (Optional) */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
                New Password <span className="text-slate-400 font-normal lowercase">(leave blank to keep current)</span>
              </label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  placeholder="Leave blank to keep current password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Strength Meter */}
              {newPassword && (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Password Strength:</span>
                    <span className={`font-bold ${strength.color.split(' ')[1]}`}>
                      {strength.label}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex gap-1">
                    <div className={`h-full flex-1 rounded-full ${strength.score >= 1 ? strength.color.split(' ')[0] : 'bg-transparent'}`} />
                    <div className={`h-full flex-1 rounded-full ${strength.score >= 2 ? strength.color.split(' ')[0] : 'bg-transparent'}`} />
                    <div className={`h-full flex-1 rounded-full ${strength.score >= 3 ? strength.color.split(' ')[0] : 'bg-transparent'}`} />
                  </div>
                </div>
              )}
            </div>

            {/* Confirm New Password (if newPassword entered) */}
            {newPassword && (
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
                  Confirm New Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    required
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-[11px] text-rose-500 mt-1">Passwords do not match yet.</p>
                )}
              </div>
            )}

            {/* Current Password (Required to verify authorization) */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
                Current Password (Identity Verification) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  required
                  placeholder="Enter current password to authorize changes"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-amber-300 dark:border-amber-700/80 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Required for security verification before saving any changes to Admin ID or password.
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updatingAdmin}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md disabled:opacity-50 transition-all active:scale-95"
              >
                <Lock className="w-3.5 h-3.5" />
                {updatingAdmin ? 'Saving Changes...' : 'Save Admin ID & Security Settings'}
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Manage Viewer Account */}
        {activeTab === 'viewer' && (
          <form onSubmit={handleUpdateViewer} className="p-5 space-y-4">
            <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/50 flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-amber-800 dark:text-amber-300 font-bold block mb-0.5">
                  View-Only Access Role:
                </strong>
                This user can log in, view and search all records, reports and statements, but <strong>CANNOT</strong> add, edit, delete, or disburse payments.
              </div>
            </div>

            {viewerLoading ? (
              <div className="py-6 text-center text-slate-400 text-xs">
                Loading viewer credentials...
              </div>
            ) : (
              <>
                {/* Username */}
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Viewer Username <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. viewer"
                    value={viewerUsername}
                    onChange={(e) => setViewerUsername(e.target.value.toLowerCase().trim())}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Used to sign in to the viewer account (lowercase, letters and numbers only).
                  </p>
                </div>

                {/* Display Name */}
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Viewer Account Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Guest Observer / Mahallu Viewer"
                    value={viewerName}
                    onChange={(e) => setViewerName(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Set / Reset Password */}
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Set / Reset Viewer Password
                  </label>
                  <div className="relative">
                    <input
                      type={showViewerPassword ? 'text' : 'password'}
                      placeholder="Leave blank to keep current, or enter new password"
                      value={viewerNewPassword}
                      onChange={(e) => setViewerNewPassword(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowViewerPassword(!showViewerPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showViewerPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Default is <code className="text-emerald-600 font-semibold">viewer123</code>. You can change it freely whenever needed.
                  </p>
                </div>
              </>
            )}

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updatingViewer}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md disabled:opacity-50 transition-all"
              >
                <UserCheck className="w-3.5 h-3.5" />
                {updatingViewer ? 'Saving Viewer Credentials...' : 'Save Viewer Credentials'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

