import React from 'react';

export default function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'emerald', // 'emerald', 'rose', 'blue', 'amber', 'purple'
  badgeText
}) {
  const colorSchemes = {
    emerald: {
      bg: 'from-emerald-500/10 to-teal-500/5',
      border: 'border-emerald-500/20 dark:border-emerald-500/30',
      iconBg: 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400',
      text: 'text-emerald-600 dark:text-emerald-400',
    },
    rose: {
      bg: 'from-rose-500/10 to-pink-500/5',
      border: 'border-rose-500/20 dark:border-rose-500/30',
      iconBg: 'bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400',
      text: 'text-rose-600 dark:text-rose-400',
    },
    blue: {
      bg: 'from-blue-500/10 to-indigo-500/5',
      border: 'border-blue-500/20 dark:border-blue-500/30',
      iconBg: 'bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400',
      text: 'text-blue-600 dark:text-blue-400',
    },
    amber: {
      bg: 'from-amber-500/10 to-yellow-500/5',
      border: 'border-amber-500/20 dark:border-amber-500/30',
      iconBg: 'bg-amber-100 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400',
      text: 'text-amber-600 dark:text-amber-400',
    },
    purple: {
      bg: 'from-purple-500/10 to-violet-500/5',
      border: 'border-purple-500/20 dark:border-purple-500/30',
      iconBg: 'bg-purple-100 dark:bg-purple-950/70 text-purple-600 dark:text-purple-400',
      text: 'text-purple-600 dark:text-purple-400',
    },
  };

  const scheme = colorSchemes[color] || colorSchemes.emerald;

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border ${scheme.border} p-5 shadow-xs hover:shadow-md transition-all duration-200`}>
      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${scheme.bg} rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none`} />

      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {title}
        </span>
        {Icon && (
          <div className={`p-2.5 rounded-xl ${scheme.iconBg}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>

      <div className="mt-4 flex items-baseline justify-between">
        <h3 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          {value}
        </h3>
        {badgeText && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${scheme.iconBg}`}>
            {badgeText}
          </span>
        )}
      </div>

      {subtitle && (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {subtitle}
        </p>
      )}
    </div>
  );
}
