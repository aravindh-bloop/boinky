import { cn } from '../../lib/utils';

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const TONE: Record<Tone, string> = {
  success: 'bg-status-success-bg text-status-success',
  warning: 'bg-status-warning-bg text-status-warning',
  danger: 'bg-status-danger-bg text-status-danger',
  info: 'bg-status-info-bg text-status-info',
  neutral: 'bg-slate-100 text-slate-600',
};

interface BadgeProps {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ tone = 'neutral', children, className }: BadgeProps) {
  return (
    <span className={cn('px-2 py-1 rounded text-xs font-medium capitalize inline-block', TONE[tone], className)}>
      {children}
    </span>
  );
}

/** severity/risk share the same three-level vocabulary — one tone mapping for both. */
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
