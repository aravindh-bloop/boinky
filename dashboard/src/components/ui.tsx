import { Loader2, AlertTriangle } from 'lucide-react';

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-slate-400 p-8">
      <Loader2 size={16} className="animate-spin" />
      {label}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="m-8 p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 flex items-start gap-3">
      <AlertTriangle size={18} className="mt-0.5 shrink-0" />
      <div>
        <p className="text-sm font-medium">{message}</p>
        {onRetry && (
          <button onClick={onRetry} className="text-xs underline mt-1">
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

const SEV: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-green-100 text-green-700',
};

export function SeverityBadge({ severity }: { severity: string | null }) {
  if (!severity) return null;
  return (
    <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${SEV[severity] ?? 'bg-slate-100 text-slate-600'}`}>
      {severity}
    </span>
  );
}

export function timeAgo(iso: string) {
  const s = Math.round((Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} hr ago`;
  return `${Math.round(s / 86400)} d ago`;
}
