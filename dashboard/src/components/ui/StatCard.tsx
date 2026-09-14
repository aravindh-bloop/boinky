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
  default: 'bg-slate-100 text-slate-700',
  accent: 'bg-[#eafaf0] text-[#1d6b46]',
};

export function StatCard({ icon: Icon, label, value, hint, trend, tone = 'default', onClick }: StatCardProps) {
  const dark = tone === 'dark';
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'group relative overflow-hidden rounded-[1.5rem] border p-5 text-left transition-all duration-200',
        dark
          ? 'border-[#153c2f] bg-gradient-to-br from-[#102c22] via-[#153a2d] to-[#1d4739] text-white shadow-[0_10px_30px_rgba(15,45,34,0.18)]'
          : 'border-slate-200/80 bg-white/90 shadow-[var(--shadow-card)] hover:-translate-y-0.5 hover:border-[#d3eadb] hover:shadow-[0_18px_40px_rgba(15,45,34,0.08)]',
        !onClick && 'cursor-default',
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div
          className={cn(
            'mb-5 grid h-11 w-11 place-items-center rounded-2xl',
            dark ? 'border border-white/15 bg-white/10 text-white' : ICON_BG[tone === 'accent' ? 'accent' : 'default'],
          )}
        >
          <Icon size={22} />
        </div>
        {onClick && (
          <ChevronRight
            size={18}
            className={cn('mt-1', dark ? 'text-white/40' : 'text-slate-300 transition-colors group-hover:text-slate-500')}
          />
        )}
      </div>

      <p className={cn('text-[11px] font-semibold uppercase tracking-[0.14em]', dark ? 'text-emerald-100/80' : 'text-slate-500')}>
        {label}
      </p>
      <p className={cn('mt-2 text-3xl font-bold tracking-tight tabular-nums', dark ? 'text-white' : 'text-slate-900')}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>

      {trend && (
        <p className={cn('mt-3 flex items-center gap-1 text-sm font-medium', trend.direction === 'up' ? 'text-emerald-500' : 'text-rose-500')}>
          {trend.direction === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {trend.label}
        </p>
      )}

      {hint && !trend && <p className={cn('mt-3 text-xs', dark ? 'text-emerald-50/70' : 'text-slate-500')}>{hint}</p>}

      {dark && <Icon size={118} className="pointer-events-none absolute -bottom-7 -right-4 text-white/5" />}
    </button>
  );
}
