import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Trends } from '../lib/types';

const CATEGORY_COLOR: Record<string, string> = {
  disease: '#dc2626',
  pest: '#d97706',
  deficiency: '#2563eb',
  healthy: '#059669',
  unknown: '#94a3b8',
};

const CATEGORIES = ['disease', 'pest', 'deficiency', 'healthy', 'unknown'] as const;

function shortWeek(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Stacked week-over-week case volume by diagnosis category — the first real use of recharts here. */
export function TrendsChart({ data }: { data: Trends['weekly'] }) {
  const rows = useMemo(() => {
    const byWeek = new Map<string, Record<string, number | string>>();
    for (const r of data) {
      const key = r.week;
      const row = byWeek.get(key) ?? { week: key };
      const cat = r.category ?? 'unknown';
      row[cat] = Number(row[cat] ?? 0) + r.count;
      byWeek.set(key, row);
    }
    return [...byWeek.values()].sort((a, b) => String(a.week).localeCompare(String(b.week)));
  }, [data]);

  if (rows.length === 0) {
    return <p className="text-sm text-slate-400 py-8 text-center">Not enough weekly data yet.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={rows} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey="week"
          tickFormatter={shortWeek}
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip
          labelFormatter={(label) => shortWeek(String(label))}
          contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 11, textTransform: 'capitalize' }} iconType="circle" iconSize={8} />
        {CATEGORIES.map((c) => (
          <Area
            key={c}
            type="monotone"
            dataKey={c}
            name={c}
            stackId="1"
            stroke={CATEGORY_COLOR[c]}
            fill={CATEGORY_COLOR[c]}
            fillOpacity={0.25}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
