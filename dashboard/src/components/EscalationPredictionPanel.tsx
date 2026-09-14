import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, ChevronDown, Sparkles, X } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import type { OutbreakProjectionRequest, OutbreakProjectionResponse, ProjectionSeriesPoint } from '../lib/types';
import { Badge, Loading } from './ui';

const PHASE_COLOR = { observed: '#334155', forecast: '#1b5e20', extrapolated: '#94a3b8' } as const;

function shortDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface ChartRow {
  date: string;
  phase: ProjectionSeriesPoint['phase'];
  observed: number | null;
  forecast: number | null;
  extrapolated: number | null;
  riskScore: number | null;
  tempMeanC: number | null;
  humidityMeanPct: number | null;
  rainfallMm: number | null;
}

function toChartRows(series: ProjectionSeriesPoint[]): ChartRow[] {
  const rows: ChartRow[] = series.map((p) => ({
    date: p.date,
    phase: p.phase,
    observed: p.phase === 'observed' ? p.projectedCount : null,
    forecast: p.phase === 'forecast' ? p.projectedCount : null,
    extrapolated: p.phase === 'extrapolated' ? p.projectedCount : null,
    riskScore: p.riskScore,
    tempMeanC: p.tempMeanC,
    humidityMeanPct: p.humidityMeanPct,
    rainfallMm: p.rainfallMm,
  }));
  // duplicate each boundary value into the next segment's key so the three
  // lines visually connect instead of leaving a gap between phases
  for (let i = 1; i < rows.length; i++) {
    if (rows[i]!.phase === 'forecast' && rows[i - 1]!.phase === 'observed') {
      rows[i - 1]!.forecast = rows[i - 1]!.observed;
    }
    if (rows[i]!.phase === 'extrapolated' && rows[i - 1]!.phase === 'forecast') {
      rows[i - 1]!.extrapolated = rows[i - 1]!.forecast;
    }
  }
  return rows;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: ChartRow }[] }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]!.payload;
  const value = row.observed ?? row.forecast ?? row.extrapolated;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs space-y-1 max-w-[220px]">
      <p className="font-semibold text-slate-800">{shortDate(row.date)}</p>
      <p className="text-slate-600 capitalize">
        {row.phase} · {value} cumulative case{value === 1 ? '' : 's'}
      </p>
      {row.riskScore != null && (
        <p className="text-slate-500">
          Risk score {row.riskScore}
          {row.tempMeanC != null ? ` · ${Math.round(row.tempMeanC)}°C` : ''}
          {row.humidityMeanPct != null ? ` · ${Math.round(row.humidityMeanPct)}% RH` : ''}
          {row.rainfallMm != null ? ` · ${Math.round(row.rainfallMm)}mm rain` : ''}
        </p>
      )}
    </div>
  );
}

interface Props {
  query: OutbreakProjectionRequest;
  onClose: () => void;
}

export function EscalationPredictionPanel({ query, onClose }: Props) {
  const [data, setData] = useState<OutbreakProjectionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [howOpen, setHowOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    api
      .post<OutbreakProjectionResponse>('/api/official/outbreak-projection', query)
      .then((r) => alive && setData(r))
      .catch((e) => alive && setError(e instanceof ApiError ? e.message : 'Prediction failed'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(query)]);

  const chartRows = useMemo(() => (data ? toChartRows(data.series) : []), [data]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      className="w-[420px] bg-white border-l border-slate-200 h-full overflow-y-auto p-5"
    >
      <div className="flex items-start justify-between mb-1">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Sparkles size={18} className="text-agri-primary" /> Escalation prediction
        </h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
          <X size={18} />
        </button>
      </div>

      {loading && (
        <div className="py-10">
          <Loading label="Projecting how this will escalate…" />
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 rounded-xl bg-status-danger-bg text-status-danger text-sm flex items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {data && (
        <div className="space-y-5 mt-3">
          <p className="text-xs text-slate-500">
            {data.crop ? <span className="capitalize">{data.crop}</span> : 'This area'} ·{' '}
            {data.population.fieldsInArea} field{data.population.fieldsInArea === 1 ? '' : 's'} ·{' '}
            {data.population.areaAcresTotal} acres
          </p>

          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartRows} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 10, textTransform: 'capitalize' }} iconType="plainline" />
              <Line type="monotone" dataKey="observed" name="observed" stroke={PHASE_COLOR.observed} strokeWidth={2} dot={{ r: 2 }} connectNulls />
              <Line type="monotone" dataKey="forecast" name="forecast (7-day)" stroke={PHASE_COLOR.forecast} strokeWidth={2} dot={{ r: 2 }} connectNulls />
              <Line
                type="monotone"
                dataKey="extrapolated"
                name="extrapolated"
                stroke={PHASE_COLOR.extrapolated}
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={{ r: 2 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>

          {/* yield loss — always visible with its disclaimer, never tucked into a tooltip */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
            <p className="text-sm font-semibold text-amber-800">
              Estimated yield loss: {data.yieldLossEstimate.estimatedLossPctLow}–
              {data.yieldLossEstimate.estimatedLossPctHigh}% if unaddressed
            </p>
            <p className="text-xs text-amber-700 mt-1">{data.yieldLossEstimate.basis}</p>
            <p className="text-[11px] text-amber-600/80 mt-2">{data.yieldLossEstimate.disclaimer}</p>
          </div>

          {/* narrative — gracefully absent, never blocks the quantitative result */}
          {data.narrative ? (
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">{data.narrative.headline}</p>
                <p className="text-sm text-slate-600 mt-1">{data.narrative.summary}</p>
              </div>
              {data.narrative.keyDrivers.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {data.narrative.keyDrivers.map((d, i) => (
                    <span key={i} title={d.basis} className="cursor-help">
                      <Badge tone="info">{d.label}</Badge>
                    </span>
                  ))}
                </div>
              )}
              {data.narrative.recommendedActions.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
                    Recommended actions
                  </p>
                  <ul className="space-y-1">
                    {data.narrative.recommendedActions.map((a, i) => (
                      <li key={i} className="text-sm text-slate-700 flex gap-2">
                        <span className="text-agri-primary">•</span> {a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {data.narrative.confidenceCaveat && (
                <p className="text-xs text-slate-400 italic">{data.narrative.confidenceCaveat}</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-400">AI narrative unavailable right now — the chart and estimate above are unaffected.</p>
          )}

          {/* how this is calculated — non-negotiable given the no-hardcoding project rule */}
          <div className="border-t border-slate-100 pt-3">
            <button
              onClick={() => setHowOpen((v) => !v)}
              className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
            >
              <ChevronDown size={13} className={howOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
              How this is calculated
            </button>
            {howOpen && (
              <div className="mt-2 space-y-2">
                <p className="text-xs text-slate-500">{data.modelDisclosure.method}</p>
                <ul className="text-[11px] text-slate-400 list-disc pl-4 space-y-0.5">
                  {data.modelDisclosure.sources.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
