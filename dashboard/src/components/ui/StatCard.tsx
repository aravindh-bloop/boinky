import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
  trend?: { direction: 'up' | 'down'; label: string };
  tone?: 'default' | 'dark' | 'accent';
  onClick?: () => void;
}

const ICON_BG: Record<'default' | 'accent', string> = {
  default: 'bg-slate-100 text-slate-600',
  accent: 'bg-agri-light text-agri-primary',
};

/** The one KPI tile every page uses — replaces per-page Kpi/SummaryCard duplicates. */
export function StatCard({ icon: Icon, label, value, hint, trend, tone = 'default', onClick }: StatCardProps) {
  const dark = tone === 'dark';
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'text-left rounded-[var(--radius-card)] p-6 border transition relative overflow-hidden group',
        dark
          ? 'bg-agri-dark text-white border-transparent'
          : 'bg-white border-slate-200/70 hover:border-slate-300 hover:shadow-md',
        !onClick && 'cursor-default',
      )}
    >
      <div className="flex items-start justify-between">
        <div
          className={cn(
            'w-11 h-11 rounded-xl grid place-items-center mb-5',
            dark ? 'bg-white/10 border border-white/15' : ICON_BG[tone === 'accent' ? 'accent' : 'default'],
          )}
        >
          <Icon size={22} />
        </div>
        {onClick && (
          <ChevronRight
            size={18}
            className={cn('mt-1', dark ? 'text-white/40' : 'text-slate-300 group-hover:text-slate-400')}
          />
        )}
      </div>
      <p className={cn('text-[11px] font-semibold uppercase tracking-wider', dark ? 'text-white/70' : 'text-slate-500')}>
        {label}
      </p>
      <p className={cn('text-4xl font-bold mt-1 tabular-nums', dark ? 'text-white' : 'text-slate-800')}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {trend && (
        <p
          className={cn(
            'text-sm mt-2 flex items-center gap-1',
            trend.direction === 'up' ? 'text-emerald-500' : 'text-status-danger',
          )}
        >
          {trend.direction === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {trend.label}
        </p>
      )}
      {hint && !trend && <p className={cn('text-xs mt-2', dark ? 'text-white/60' : 'text-slate-400')}>{hint}</p>}
      {dark && <Icon size={120} className="absolute -bottom-6 -right-4 text-white/5" />}
    </button>
  );
}
