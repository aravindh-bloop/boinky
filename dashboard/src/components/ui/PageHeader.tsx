import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

/** The one page-top pattern every page opens with — icon badge, title, subtitle, optional action. */
export function PageHeader({ icon: Icon, title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-agri-light text-agri-primary grid place-items-center shrink-0">
          <Icon size={22} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">{title}</h2>
          {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}
