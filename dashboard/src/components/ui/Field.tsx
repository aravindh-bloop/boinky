import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

const base =
  'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white placeholder:text-slate-400 ' +
  'focus:outline-none focus:ring-2 focus:ring-agri-primary/30 focus:border-agri-primary transition';

interface LabeledProps {
  label?: string;
}

export function Input({ label, className, ...props }: LabeledProps & InputHTMLAttributes<HTMLInputElement>) {
  const el = <input className={cn(base, className)} {...props} />;
  return label ? (
    <label className="block">
      <span className="text-xs text-slate-500">{label}</span>
      <div className="mt-0.5">{el}</div>
    </label>
  ) : (
    el
  );
}

export function Textarea({ label, className, ...props }: LabeledProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const el = <textarea className={cn(base, className)} {...props} />;
  return label ? (
    <label className="block">
      <span className="text-xs text-slate-500">{label}</span>
      <div className="mt-0.5">{el}</div>
    </label>
  ) : (
    el
  );
}

export function Select({
  label,
  className,
  children,
  ...props
}: LabeledProps & SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  const el = (
    <select className={cn(base, className)} {...props}>
      {children}
    </select>
  );
  return label ? (
    <label className="block">
      <span className="text-xs text-slate-500">{label}</span>
      <div className="mt-0.5">{el}</div>
    </label>
  ) : (
    el
  );
}

/** Pill filter/tab button — the one selected/unselected treatment every filter bar uses. */
export function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 rounded-full text-xs font-medium border transition capitalize',
        active
          ? 'bg-agri-primary text-white border-transparent'
          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300',
      )}
    >
      {children}
    </button>
  );
}
