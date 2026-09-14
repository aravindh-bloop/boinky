import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Leaf,
  Bug,
  FileWarning,
  BellRing,
  IndianRupee,
  ChevronRight,
  ShieldCheck,
  MapPin,
} from 'lucide-react';
import { useApi } from '../lib/useApi';
import type {
  Overview as OverviewData,
  QueueItem,
  SchemeSummary,
  DistrictRow,
  Trends,
} from '../lib/types';
import { Loading, ErrorBox, StatCard } from '../components/ui';
import { rupee, timeAgo } from '../lib/format';
import { TrendsChart } from '../components/TrendsChart';

const sevDot = (s: string | null) =>
  s === 'high' ? 'bg-red-500' : s === 'medium' ? 'bg-amber-500' : 'bg-green-500';

export function Overview() {
  const nav = useNavigate();
  const ov = useApi<OverviewData>('/api/official/overview');
  const queue = useApi<{ items: QueueItem[] }>('/api/official/validation-queue?limit=6');
  const recent = useApi<{ items: QueueItem[] }>('/api/official/validation-queue?includeResolved=true&limit=7');
  const subs = useApi<SchemeSummary>('/api/official/scheme-summary');
  const districts = useApi<{ districts: DistrictRow[] }>('/api/official/districts?days=30');
  const trends = useApi<Trends>('/api/official/trends?days=90');

  if (ov.loading) return <Loading label="Loading overview…" />;
  if (ov.error) return <ErrorBox message={ov.error} onRetry={ov.reload} />;

  const d = ov.data!;
  const s = subs.data;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="mx-auto max-w-[1450px] space-y-6 p-4 md:p-6 xl:p-8"
    >
      <div className="rounded-[2rem] border border-[#dfece3] bg-gradient-to-br from-[#0d2d22] via-[#153d30] to-[#1d513d] p-5 text-white shadow-[0_20px_60px_rgba(15,45,34,0.18)] md:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-100/70">Regional snapshot</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Field health is trending in the right direction.</h2>
          </div>
          <div className="flex items-center gap-3 self-start rounded-full bg-white/10 px-3 py-2 text-sm text-emerald-50/90 ring-1 ring-white/10 backdrop-blur-sm">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(74,222,128,0.7)]" />
            18 hotspots require attention
          </div>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Leaf} tone="dark" label="Scans · last 30 days" value={d.scans.total} trend={{ direction: 'up', label: `${d.scans.last7d} in the last week` }} />
        <StatCard icon={FileWarning} label="Pending validations" value={d.scans.needs_validation} hint={d.scans.needs_validation ? 'Needs review' : 'All clear'} onClick={() => nav('/queue')} />
        <StatCard icon={BellRing} label="Active alerts · 14 days" value={d.activeAlerts} hint="Broadcasts in effect" onClick={() => nav('/alerts')} />
        <StatCard icon={IndianRupee} tone="accent" label="Subsidies disbursed" value={s ? rupee(s.totalDisbursed) : '—'} hint={s ? `${s.pendingReview} awaiting review` : ''} onClick={() => nav('/subsidies')} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.55fr_1fr]">
        <SectionCard
          title="Validation queue"
          subtitle={
            (queue.data?.items.length ?? 0) === 1
              ? '1 scan awaiting your review'
              : `${queue.data?.items.length ?? 0} scans awaiting your review`
          }
          action={{ label: 'Review all', onClick: () => nav('/queue') }}
          className="overflow-hidden"
        >
          {queue.loading ? (
            <Loading />
          ) : (queue.data?.items ?? []).length === 0 ? (
            <Empty text="The queue is clear." />
          ) : (
            <ul className="-mx-2 divide-y divide-slate-100">
              {queue.data!.items.map((it) => (
                <li key={it.id} onClick={() => nav('/queue')} className="flex cursor-pointer items-center gap-4 rounded-2xl px-2 py-3 transition hover:bg-slate-50">
                  <img src={it.image_url} alt="" className="h-12 w-12 rounded-xl bg-slate-100 object-cover ring-1 ring-slate-200" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{it.diagnosis_label ?? 'Unclassified'}</p>
                    <p className="truncate text-xs text-slate-500">
                      {it.farmer_name}
                      {it.crop ? ` · ${it.crop}` : ''}
                    </p>
                  </div>
                  {(it.confidence ?? 1) < 0.6 && (
                    <span className="shrink-0 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">
                      low confidence
                    </span>
                  )}
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${sevDot(it.severity)}`} />
                  <span className="w-16 shrink-0 text-right text-[11px] text-slate-400">{timeAgo(it.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Recent activity" subtitle="Latest scans across the region">
          {recent.loading ? (
            <Loading />
          ) : (
            <ul className="space-y-4">
              {(recent.data?.items ?? []).slice(0, 7).map((it) => {
                const pest = it.diagnosis_category === 'pest';
                return (
                  <li key={it.id} className="flex items-center gap-3 rounded-2xl p-1.5 transition hover:bg-slate-50">
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${it.severity === 'high' ? 'bg-red-100 text-red-600' : it.severity === 'medium' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-700'}`}>
                      {pest ? <Bug size={15} /> : <Leaf size={15} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">{it.crop ? `${it.crop} · ` : ''}{it.diagnosis_label ?? 'Scan'}</p>
                      <p className="truncate text-[11px] text-slate-400">{it.farmer_name}</p>
                    </div>
                    <span className="shrink-0 text-[11px] text-slate-400">{timeAgo(it.created_at)}</span>
                  </li>
                );
              })}
              {(recent.data?.items ?? []).length === 0 && <Empty text="No scans yet." />}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Outbreak load by district"
        subtitle="Scans attributed to their exact GPS district · last 30 days"
        action={{ label: 'Hotspot map', onClick: () => nav('/map') }}
      >
        {districts.loading ? (
          <Loading />
        ) : (districts.data?.districts ?? []).length === 0 ? (
          <Empty text="No located scans yet." />
        ) : (
          <div className="-mx-2 overflow-x-auto">
            <table className="min-w-[640px] w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-slate-400">
                  <th className="px-2 py-2 font-semibold">District</th>
                  <th className="px-2 py-2 text-right font-semibold">Scans</th>
                  <th className="px-2 py-2 text-right font-semibold">High severity</th>
                  <th className="px-2 py-2 text-right font-semibold">Pending</th>
                  <th className="px-2 py-2 text-right font-semibold">Farmers</th>
                  <th className="px-2 py-2 font-semibold">Most reported</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {districts.data!.districts.map((r) => (
                  <tr key={r.district} onClick={() => nav(`/queue?district=${encodeURIComponent(r.district)}`)} className={`cursor-pointer transition hover:bg-slate-50 ${r.district === 'Unresolved' ? 'text-slate-400' : ''}`}>
                    <td className="flex items-center gap-1.5 px-2 py-2.5 font-medium text-slate-800">
                      <MapPin size={13} className="shrink-0 text-slate-400" />
                      {r.district}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{r.scans}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{r.high_severity > 0 ? <span className="font-semibold text-red-600">{r.high_severity}</span> : '0'}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{r.needs_validation > 0 ? <span className="text-amber-600">{r.needs_validation}</span> : '0'}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{r.farmers}</td>
                    <td className="max-w-[180px] truncate px-2 py-2.5 capitalize text-slate-500">{r.top_diagnosis ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Case trends" subtitle="Weekly volume by category · last 90 days">
        {trends.loading ? <Loading /> : <TrendsChart data={trends.data?.weekly ?? []} />}
      </SectionCard>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <SectionCard title="Top diagnoses" subtitle="Confirmed problems · 30 days">
          <BarList rows={d.topDiagnoses.map((t) => ({ label: t.label ?? 'Unknown', value: t.count, note: t.high > 0 ? `${t.high} high` : undefined }))} color="bg-[#1d6b46]" empty="No confirmed problems." />
        </SectionCard>

        <SectionCard title="Scans by crop" subtitle="All scans · 30 days">
          <BarList rows={d.byCrop.map((c) => ({ label: c.crop ?? 'Unlinked', value: c.count }))} color="bg-[#0f2d22]" empty="No scans yet." />
        </SectionCard>

        <SectionCard title="Subsidies" subtitle="This region" action={{ label: 'Manage', onClick: () => nav('/subsidies') }}>
          {!s ? (
            <Loading />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <MiniStat label="Pending" value={s.pendingReview} />
                <MiniStat label="Approved" value={s.approvedNotDisbursed} />
                <MiniStat label="Queries" value={s.openQueries} tint={s.openQueries ? 'text-red-600' : undefined} />
              </div>
              <div className="border-t border-slate-100 pt-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">By scheme</p>
                {s.byScheme.slice(0, 4).map((sc) => (
                  <div key={sc.scheme_id} className="flex items-center justify-between gap-3 py-1.5">
                    <span className="flex items-center gap-1.5 truncate pr-2 text-sm text-slate-700">
                      <ShieldCheck size={13} className="shrink-0 text-[#1d6b46]" />
                      {sc.title}
                    </span>
                    <span className="shrink-0 text-sm text-slate-500">
                      {sc.disbursed}/{sc.applications}
                      {sc.amount > 0 && <span className="text-emerald-600"> · {rupee(sc.amount)}</span>}
                    </span>
                  </div>
                ))}
                {s.byScheme.length === 0 && <Empty text="No applications yet." />}
              </div>
            </div>
          )}
        </SectionCard>
      </div>
    </motion.div>
  );
}

function SectionCard({
  title,
  subtitle,
  action,
  className = '',
  children,
}: {
  title: string;
  subtitle?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-[1.75rem] border border-slate-200/80 bg-white/90 p-5 shadow-[var(--shadow-card)] backdrop-blur-sm md:p-6 ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold tracking-tight text-slate-900">{title}</h3>
          {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {action && (
          <button onClick={action.onClick} className="inline-flex items-center gap-0.5 shrink-0 text-sm font-semibold text-[#1d6b46] transition hover:text-[#0f2d22]">
            {action.label} <ChevronRight size={15} />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function BarList({
  rows,
  color,
  empty,
}: {
  rows: { label: string; value: number; note?: string }[];
  color: string;
  empty: string;
}) {
  if (rows.length === 0) return <Empty text={empty} />;
  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <div className="space-y-3">
      {rows.slice(0, 7).map((r) => (
        <div key={r.label}>
          <div className="mb-1 flex items-center justify-between gap-2 text-sm">
            <span className="truncate pr-2 font-medium capitalize text-slate-700">{r.label}</span>
            <span className="shrink-0 text-slate-500">
              {r.value}
              {r.note && <span className="text-red-500"> · {r.note}</span>}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${color}`} style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function MiniStat({ label, value, tint }: { label: string; value: number; tint?: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200/80">
      <p className={`text-2xl font-bold ${tint ?? 'text-slate-800'}`}>{value}</p>
      <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-slate-400">{label}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-4 text-sm text-slate-400">{text}</p>;
}
