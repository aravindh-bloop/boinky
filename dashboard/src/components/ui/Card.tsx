import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

const PADDING = { sm: 'p-4', md: 'p-5', lg: 'p-6' } as const;

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: keyof typeof PADDING;
  interactive?: boolean;
  onClick?: () => void;
}

/** The one card shell every surface in the dashboard should render on. */
export function Card({ children, className, padding = 'lg', interactive, onClick }: CardProps) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      onClick={onClick}
      className={cn(
        'bg-white rounded-[var(--radius-card)] border border-slate-200/70 shadow-[var(--shadow-card)]',
        PADDING[padding],
        onClick && 'text-left w-full',
        interactive && 'transition hover:border-slate-300 hover:shadow-md cursor-pointer',
        className,
      )}
    >
      {children}
    </Comp>
  );
}
