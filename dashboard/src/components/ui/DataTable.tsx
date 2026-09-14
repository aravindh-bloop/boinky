import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { Skeleton } from './Skeleton';

export interface Column<T> {
  key: string;
  header: string;
  align?: 'left' | 'right';
  render: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  keyField: keyof T;
  onRowClick?: (row: T) => void;
  selectedKey?: string | number | null;
  loading?: boolean;
  emptyState?: ReactNode;
}

/** The one table every page renders a list through. */
export function DataTable<T>({
  columns,
  rows,
  keyField,
  onRowClick,
  selectedKey,
  loading,
  emptyState,
}: DataTableProps<T>) {
  return (
    <div className="bg-white rounded-[var(--radius-card)] border border-slate-200/70 overflow-hidden">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 border-b border-slate-200/70 text-slate-500">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={cn('px-4 py-3 font-medium text-xs uppercase tracking-wide', c.align === 'right' && 'text-right')}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-100 last:border-0">
                  {columns.map((c) => (
                    <td key={c.key} className="px-4 py-3">
                      <Skeleton variant="text" />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((row, i) => {
                const key = String(row[keyField]);
                return (
                  <motion.tr
                    key={key}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i, 10) * 0.02 }}
                    onClick={() => onRowClick?.(row)}
                    className={cn(
                      'border-b border-slate-100 last:border-0',
                      onRowClick && 'hover:bg-slate-50 cursor-pointer',
                      selectedKey != null && key === String(selectedKey) && 'bg-agri-primary/5',
                    )}
                  >
                    {columns.map((c) => (
                      <td key={c.key} className={cn('px-4 py-3', c.align === 'right' && 'text-right tabular-nums', c.className)}>
                        {c.render(row)}
                      </td>
                    ))}
                  </motion.tr>
                );
              })}
        </tbody>
      </table>
      {!loading && rows.length === 0 && (emptyState ?? <div className="p-10 text-center text-slate-500 text-sm">Nothing here yet.</div>)}
    </div>
  );
}
