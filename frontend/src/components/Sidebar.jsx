import React from 'react';
import {
  LayoutDashboard,
  ArrowDownLeft,
  ArrowUpRight,
  Users,
  UserCheck,
  X,
  HeartHandshake,
  FileSpreadsheet
} from 'lucide-react';

export default function Sidebar({ activeTab, onTabChange, isOpen, onClose }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'income', label: 'Income Management', icon: ArrowDownLeft, badge: 'Cash Flow' },
    { id: 'expense', label: 'Expense Management', icon: ArrowUpRight },
    { id: 'members', label: 'Members & Madrasa', icon: Users, badge: 'Dues' },
    { id: 'staff', label: 'Staff & Payroll', icon: UserCheck },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs md:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed md:sticky top-0 md:top-16 z-40 h-full md:h-[calc(100vh-4rem)] w-64 glass-panel border-r border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-between p-4 transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="space-y-6">
          {/* Mobile Header */}
          <div className="flex items-center justify-between md:hidden pb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <img src="/app-icon.svg" alt="جامعة النور" className="w-7 h-7 rounded-lg" />
              <span className="font-bold text-slate-800 dark:text-slate-100" dir="rtl">جامعة النور</span>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onTabChange(item.id);
                    if (onClose) onClose();
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-md shadow-emerald-600/20 font-semibold'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-emerald-600 dark:hover:text-emerald-400'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-emerald-500'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-md ${
                      isActive
                        ? 'bg-emerald-800 text-emerald-100'
                        : 'bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Mosque Info Card */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-slate-900 border border-emerald-100 dark:border-emerald-900/50">
          <div className="flex items-center gap-2 mb-1.5 text-emerald-800 dark:text-emerald-300">
            <HeartHandshake className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Baitul Maal</span>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
            "The mosques of Allah are only to be maintained by those who believe in Allah and the Last Day."
          </p>
          <div className="mt-2 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
            Surah At-Tawbah (9:18)
          </div>
        </div>
      </aside>
    </>
  );
}
