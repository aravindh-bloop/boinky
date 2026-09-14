import { cn } from '../../lib/utils';

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const TONE: Record<Tone, string> = {
  success: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100',
  warning: 'bg-amber-50 text-amber-700 ring-1 ring-amber-100',
  danger: 'bg-rose-50 text-rose-700 ring-1 ring-rose-100',
  info: 'bg-sky-50 text-sky-700 ring-1 ring-sky-100',
  neutral: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
};

interface BadgeProps {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ tone = 'neutral', children, className }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize', TONE[tone], className)}>
      {children}
    </span>
  );
}

const LEVEL_TONE: Record<string, Tone> = { high: 'danger', medium: 'warning', low: 'success' };

export function SeverityBadge({ severity }: { severity: string | null | undefined }) {
  if (!severity) return null;
  return <Badge tone={LEVEL_TONE[severity] ?? 'neutral'}>{severity}</Badge>;
}

export function RiskBadge({
  level,
  score,
}: {
  level: 'low' | 'medium' | 'high' | null | undefined;
  score?: number | null;
}) {
  if (!level) return null;
  return (
    <Badge tone={LEVEL_TONE[level] ?? 'neutral'}>
      {level} risk{score != null ? ` · ${Math.round(score)}` : ''}
    </Badge>
  );
}
