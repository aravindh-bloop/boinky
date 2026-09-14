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
    <div className="m-8 p-4 rounded-[var(--radius-card)] border border-status-danger/20 bg-status-danger-bg text-status-danger flex items-start gap-3">
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
