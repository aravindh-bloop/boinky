import type { ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-agri-primary text-white hover:bg-agri-dark disabled:hover:bg-agri-primary',
  secondary: 'bg-slate-800 text-white hover:bg-slate-900 disabled:hover:bg-slate-800',
  outline: 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:hover:bg-white',
  ghost: 'text-slate-600 hover:bg-slate-100 disabled:hover:bg-transparent',
  danger:
    'bg-white border border-status-danger/30 text-status-danger hover:bg-status-danger-bg disabled:hover:bg-white',
};

const SIZE: Record<Size, string> = {
  sm: 'text-xs px-2.5 py-1.5 gap-1.5 rounded-lg',
  md: 'text-sm px-3.5 py-2 gap-2 rounded-lg',
  lg: 'text-sm px-4 py-2.5 gap-2 rounded-xl',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: typeof Loader2;
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  loading,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-medium transition disabled:opacity-40 disabled:cursor-not-allowed',
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 size={size === 'sm' ? 13 : 15} className="animate-spin" /> : Icon ? <Icon size={size === 'sm' ? 13 : 15} /> : null}
      {children}
    </button>
  );
}
