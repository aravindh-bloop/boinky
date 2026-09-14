import { motion } from 'framer-motion';
import { Fragment, useEffect, useState } from 'react';
import { Search, ChevronDown, ChevronRight, Phone, Leaf, Users } from 'lucide-react';
import { useApi } from '../lib/useApi';
import type { DirectoryFarmer } from '../lib/types';
import { Card, ErrorBox, EmptyState, PageHeader, Skeleton, Input } from '../components/ui';

export function FarmersFields() {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const path = debounced
    ? `/api/official/directory?q=${encodeURIComponent(debounced)}`
    : '/api/official/directory';
  const { data, loading, error, reload } = useApi<{ farmers: DirectoryFarmer[] }>(path);

  const farmers = data?.farmers ?? [];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="p-8 h-[calc(100vh-80px)] overflow-auto"
    >
      <PageHeader
        icon={Users}
        title="Farmers & Fields"
        subtitle="Every farmer in your region, their fields, crops and scan activity"
        action={
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or phone…"
              className="pl-10"
            />
          </div>
        }
      />

      {error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : (
        <Card padding="sm" className="overflow-hidden">
          <table className="w-full text-left">
            <thead className="border-b border-slate-100">
              <tr>
                <th className="px-3 py-3 w-10" />
                <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Name</th>
                <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Region</th>
                <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Contact</th>
                <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Fields</th>
                <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Scans</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-50 last:border-0">
                      <td colSpan={6} className="px-3 py-3">
                        <Skeleton variant="text" />
                      </td>
                    </tr>
                  ))
                : farmers.map((f) => (
                    <Fragment key={f.id}>
                      <tr
                        onClick={() => setExpanded((p) => ({ ...p, [f.id]: !p[f.id] }))}
                        className="border-b border-slate-50 last:border-0 hover:bg-slate-50 cursor-pointer"
                      >
                        <td className="px-3 py-3 text-slate-400">
                          {expanded[f.id] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </td>
                        <td className="px-3 py-3 font-medium text-slate-800">{f.name}</td>
                        <td className="px-3 py-3 text-sm text-slate-600">{f.region ?? '—'}</td>
                        <td className="px-3 py-3 text-sm text-slate-600">
                          {f.phone ? (
                            <span className="inline-flex items-center gap-1.5">
                              <Phone size={13} /> {f.phone}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-3 py-3 text-sm tabular-nums">{f.field_count}</td>
                        <td className="px-3 py-3 text-sm tabular-nums">{f.scan_count}</td>
                      </tr>
                      {expanded[f.id] && (
                        <tr className="bg-slate-50/60 border-b border-slate-50 last:border-0">
                          <td />
                          <td colSpan={5} className="px-3 py-3">
                            <div className="flex flex-wrap gap-2 items-center">
                              <span className="text-xs text-slate-500">
                                Language: {f.preferred_language ?? 'en'}
                              </span>
                              {f.crops.length > 0 ? (
                                f.crops.map((c) => (
                                  <span
                                    key={c}
                                    className="text-xs px-2 py-0.5 bg-white border border-slate-200 rounded-full capitalize inline-flex items-center gap-1"
                                  >
                                    <Leaf size={11} className="text-agri-primary" />
                                    {c}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-slate-400">no fields yet</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
            </tbody>
          </table>
          {!loading && farmers.length === 0 && (
            <EmptyState icon={Users} title="No farmers found" description="Try a different name or phone number." />
          )}
        </Card>
      )}
    </motion.div>
  );
}
