import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Leaf,
  Bug,
  FileWarning,
  BellRing,
  IndianRupee,
  ArrowUpRight,
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
} from '../lib/types';
import { Loading, ErrorBox, timeAgo } from '../components/ui';

const rupee = (n: number) =>
  n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${Math.round(n).toLocaleString('en-IN')}`;

const sevDot = (s: string | null) =>
  s === 'high' ? 'bg-red-500' : s === 'medium' ? 'bg-amber-500' : 'bg-green-500';

export function Overview() {
  const nav = useNavigate();
  const ov = useApi<OverviewData>('/api/official/overview');
  const queue = useApi<{ items: QueueItem[] }>('/api/official/validation-queue?limit=6');
  const recent = useApi<{ items: QueueItem[] }>(
    '/api/official/validation-queue?includeResolved=true&limit=7',
  );
  const subs = useApi<SchemeSummary>('/api/official/scheme-summary');
  const districts = useApi<{ districts: DistrictRow[] }>('/api/official/districts?days=30');

  if (ov.loading) return <Loading label="Loading overview…" />;
  if (ov.error) return <ErrorBox message={ov.error} onRetry={ov.reload} />;
  const d = ov.data!;
  const s = subs.data;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="p-8 space-y-6 max-w-[1400px]"
    >
      {/* ── KPI row ── */}
      <div className="grid grid-cols-4 gap-5">
        <div className="rounded-2xl p-6 bg-agri-dark text-white relative overflow-hidden">
          <div className="w-11 h-11 rounded-xl bg-white/10 border border-white/15 grid place-items-center mb-5">
            <Leaf size={22} />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
            Scans · last 30 days
          </p>
          <p className="text-4xl font-bold mt-1">{d.scans.total.toLocaleString()}</p>
          <p className="text-sm mt-2 text-emerald-300 flex items-center gap-1">
            <ArrowUpRight size={14} />
            {d.scans.last7d} in the last week
          </p>
          <Leaf size={120} className="absolute -bottom-6 -right-4 text-white/5" />
        </div>

        <Kpi
          icon={FileWarning}
          tint="amber"
          label="Pending validations"
          value={d.scans.needs_validation}
          hint={d.scans.needs_validation ? 'Needs review' : 'All clear'}
          onClick={() => nav('/queue')}
        />
        <Kpi
          icon={BellRing}
          tint="red"
          label="Active alerts · 14 days"
          value={d.activeAlerts}
          hint="Broadcasts in effect"
          onClick={() => nav('/alerts')}
        />
        <Kpi
          icon={IndianRupee}
          tint="emerald"
          label="Subsidies disbursed"
          value={s ? rupee(s.totalDisbursed) : '—'}
          hint={s ? `${s.pendingReview} awaiting review` : ''}
          onClick={() => nav('/subsidies')}
        />
      </div>

      {/* ── attention + activity ── */}
      <div className="grid grid-cols-3 gap-5 items-start">
        <SectionCard
          className="col-span-2"
          title="Validation queue"
          subtitle={
            (queue.data?.items.length ?? 0) === 1
              ? '1 scan awaiting your review'
              : `${queue.data?.items.length ?? 0} scans awaiting your review`
          }
          action={{ label: 'Review all', onClick: () => nav('/queue') }}
        >
          {queue.loading ? (
            <Loading />
          ) : (queue.data?.items ?? []).length === 0 ? (
            <Empty text="The queue is clear." />
          ) : (
            <ul className="divide-y divide-slate-100 -mx-2">
              {queue.data!.items.map((it) => (
                <li
                  key={it.id}
                  onClick={() => nav('/queue')}
                  className="flex items-center gap-4 px-2 py-3 hover:bg-slate-50 rounded-lg cursor-pointer"
                >
                  <img src={it.image_url} alt="" className="w-11 h-11 rounded-lg object-cover bg-slate-100 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-slate-800 truncate">
                      {it.diagnosis_label ?? 'Unclassified'}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {it.farmer_name}
                      {it.crop ? ` · ${it.crop}` : ''}
                    </p>
                  </div>
                  {(it.confidence ?? 1) < 0.6 && (
                    <span className="text-[11px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full shrink-0">
                      low confidence
                    </span>
                  )}
                  <span className={`w-2 h-2 rounded-full shrink-0 ${sevDot(it.severity)}`} />
                  <span className="text-xs text-slate-400 shrink-0 w-16 text-right">
                    {timeAgo(it.created_at)}
                  </span>
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
                  <li key={it.id} className="flex items-center gap-3">
                    <span
                      className={`w-8 h-8 rounded-full grid place-items-center shrink-0 ${
                        it.severity === 'high'
                          ? 'bg-red-100 text-red-600'
                          : it.severity === 'medium'
                            ? 'bg-amber-100 text-amber-600'
                            : 'bg-green-100 text-green-600'
                      }`}
                    >
                      {pest ? <Bug size={15} /> : <Leaf size={15} />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {it.crop ? `${it.crop} · ` : ''}
                        {it.diagnosis_label ?? 'Scan'}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">{it.farmer_name}</p>
                    </div>
                    <span className="text-[11px] text-slate-400 shrink-0">{timeAgo(it.created_at)}</span>
                  </li>
                );
              })}
              {(recent.data?.items ?? []).length === 0 && <Empty text="No scans yet." />}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* ── district-wise outbreak load ── */}
      <SectionCard
        title="Outbreak load by district"
        subtitle="Scans attributed to their exact GPS district · last 30 days"
        action={{ label: 'Hotspot map', onClick: () => nav('/hotspots') }}
      >
        {districts.loading ? (
          <Loading />
        ) : (districts.data?.districts ?? []).length === 0 ? (
          <Empty text="No located scans yet." />
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-slate-400 text-left">
                  <th className="px-2 py-2 font-semibold">District</th>
                  <th className="px-2 py-2 font-semibold text-right">Scans</th>
                  <th className="px-2 py-2 font-semibold text-right">High severity</th>
                  <th className="px-2 py-2 font-semibold text-right">Pending</th>
                  <th className="px-2 py-2 font-semibold text-right">Farmers</th>
                  <th className="px-2 py-2 font-semibold">Most reported</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {districts.data!.districts.map((r) => (
                  <tr
                    key={r.district}
                    onClick={() => nav(`/queue?district=${encodeURIComponent(r.district)}`)}
                    className={`cursor-pointer hover:bg-slate-50 ${
                      r.district === 'Unresolved' ? 'text-slate-400' : ''
                    }`}
                  >
                    <td className="px-2 py-2.5 font-medium text-slate-800 flex items-center gap-1.5">
                      <MapPin size={13} className="text-slate-400 shrink-0" />
                      {r.district}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{r.scans}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">
                      {r.high_severity > 0 ? (
                        <span className="text-red-600 font-semibold">{r.high_severity}</span>
                      ) : (
                        '0'
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums">
                      {r.needs_validation > 0 ? (
                        <span className="text-amber-600">{r.needs_validation}</span>
                      ) : (
                        '0'
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{r.farmers}</td>
                    <td className="px-2 py-2.5 text-slate-500 capitalize truncate max-w-[180px]">
                      {r.top_diagnosis ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* ── analytics ── */}
      <div className="grid grid-cols-3 gap-5 items-start">
        <SectionCard title="Top diagnoses" subtitle="Confirmed problems · 30 days">
          <BarList
            rows={d.topDiagnoses.map((t) => ({
              label: t.label ?? 'Unknown',
              value: t.count,
              note: t.high > 0 ? `${t.high} high` : undefined,
            }))}
            color="bg-agri-primary"
            empty="No confirmed problems."
          />
        </SectionCard>

        <SectionCard title="Scans by crop" subtitle="All scans · 30 days">
          <BarList
            rows={d.byCrop.map((c) => ({ label: c.crop ?? 'Unlinked', value: c.count }))}
            color="bg-agri-dark"
            empty="No scans yet."
          />
        </SectionCard>

        <SectionCard
          title="Subsidies"
          subtitle="This region"
          action={{ label: 'Manage', onClick: () => nav('/subsidies') }}
        >
          {!s ? (
            <Loading />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <MiniStat label="Pending" value={s.pendingReview} />
                <MiniStat label="Approved" value={s.approvedNotDisbursed} />
                <MiniStat label="Queries" value={s.openQueries} tint={s.openQueries ? 'text-red-600' : undefined} />
              </div>
              <div className="pt-3 border-t border-slate-100">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
                  By scheme
                </p>
                {s.byScheme.slice(0, 4).map((sc) => (
                  <div key={sc.scheme_id} className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-slate-700 truncate pr-2 flex items-center gap-1.5">
                      <ShieldCheck size={13} className="text-agri-primary shrink-0" />
                      {sc.title}
                    </span>
                    <span className="text-sm text-slate-500 shrink-0">
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

/* ── small components ─────────────────────────────────────────────── */

function Kpi({
  icon: Icon,
  tint,
  label,
  value,
  hint,
  onClick,
}: {
  icon: typeof Leaf;
  tint: 'amber' | 'red' | 'emerald';
  label: string;
  value: string | number;
  hint?: string;
  onClick?: () => void;
}) {
  const bg =
    tint === 'amber'
      ? 'bg-amber-50 text-amber-600'
      : tint === 'red'
        ? 'bg-red-50 text-red-600'
        : 'bg-emerald-50 text-emerald-600';
  return (
    <button
      onClick={onClick}
      className="text-left rounded-2xl p-6 bg-white border border-slate-200/70 hover:border-slate-300 hover:shadow-sm transition group"
    >
      <div className="flex items-start justify-between">
        <div className={`w-11 h-11 rounded-xl grid place-items-center mb-5 ${bg}`}>
          <Icon size={22} />
        </div>
        {onClick && (
          <ChevronRight size={18} className="text-slate-300 group-hover:text-slate-400 mt-1" />
        )}
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="text-4xl font-bold mt-1 text-slate-800">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {hint && <p className="text-xs text-slate-400 mt-2">{hint}</p>}
    </button>
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
    <div className={`bg-white rounded-2xl border border-slate-200/70 p-6 ${className}`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-bold text-slate-800">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {action && (
          <button
            onClick={action.onClick}
            className="text-sm font-medium text-agri-primary hover:underline flex items-center gap-0.5 shrink-0"
          >
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
          <div className="flex justify-between text-sm mb-1">
            <span className="font-medium text-slate-700 capitalize truncate pr-2">{r.label}</span>
            <span className="text-slate-500 shrink-0">
              {r.value}
              {r.note && <span className="text-red-500"> · {r.note}</span>}
            </span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full ${color} rounded-full`} style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function MiniStat({ label, value, tint }: { label: string; value: number; tint?: string }) {
  return (
    <div className="bg-slate-50 rounded-xl py-3">
      <p className={`text-2xl font-bold ${tint ?? 'text-slate-800'}`}>{value}</p>
      <p className="text-[11px] uppercase tracking-wide text-slate-400 mt-0.5">{label}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-slate-400 py-4">{text}</p>;
}
