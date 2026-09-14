import { cn } from '../../lib/utils';

const VARIANT = {
  text: 'h-4 w-3/4 rounded',
  block: 'h-24 w-full rounded-xl',
  circle: 'h-10 w-10 rounded-full',
} as const;

export function Skeleton({ variant = 'text', className }: { variant?: keyof typeof VARIANT; className?: string }) {
  return <div className={cn('bg-slate-100 animate-pulse', VARIANT[variant], className)} />;
}
