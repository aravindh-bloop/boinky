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

export function Card({ children, className, padding = 'lg', interactive, onClick }: CardProps) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      onClick={onClick}
      className={cn(
        'rounded-[var(--radius-card)] border border-slate-200/80 bg-white/90 shadow-[var(--shadow-card)] backdrop-blur-sm',
        PADDING[padding],
        onClick && 'text-left w-full',
        interactive && 'cursor-pointer transition duration-200 hover:-translate-y-0.5 hover:border-[#d4eadc] hover:shadow-[0_16px_40px_rgba(15,45,34,0.09)]',
        className,
      )}
    >
      {children}
    </Comp>
  );
}
