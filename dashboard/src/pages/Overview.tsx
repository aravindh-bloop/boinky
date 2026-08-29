import { motion } from 'framer-motion';
import { Leaf, FileWarning, BellRing, Bug, Sprout } from 'lucide-react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useApi } from '../lib/useApi';
import type { Overview as OverviewData, HotspotPoint, QueueItem } from '../lib/types';
import { Loading, ErrorBox, timeAgo } from '../components/ui';

const CHENNAI: [number, number] = [13.05, 80.25];

const sevColor = (s: string | null) =>
  s === 'high' ? '#ef4444' : s === 'medium' ? '#f59e0b' : '#22c55e';

export function Overview() {
  const ov = useApi<OverviewData>('/api/official/overview');
  const hot = useApi<{ points: HotspotPoint[] }>(
    '/api/hotspots?centerLat=13.05&centerLng=80.25&radiusKm=60&days=30&includePending=true',
  );
  const recent = useApi<{ items: QueueItem[] }>('/api/official/validation-queue?includeResolved=true&limit=6');

  if (ov.loading) return <Loading label="Loading overview…" />;
  if (ov.error) return <ErrorBox message={ov.error} onRetry={ov.reload} />;
  const d = ov.data!;

  const activeFromScans = d.byStatus['auto_confirmed'] ?? 0;
  const stats = [
    { label: 'Total scans (30d region)', value: d.scans.total, icon: Leaf, dark: true },
    { label: 'Pending validations', value: d.scans.needs_validation, icon: FileWarning, tint: 'amber' },
    { label: 'Active alerts (14d)', value: d.activeAlerts, icon: BellRing, tint: 'red' },
    { label: 'Confirmed diagnoses', value: activeFromScans, icon: Sprout, tint: 'green' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="p-8 space-y-6"
    >
      <div className="grid grid-cols-4 gap-6">
        {stats.map((s) => (
          <div
            key={s.label}
            className={`rounded-[20px] p-6 shadow-sm border ${
              s.dark ? 'bg-agri-dark text-white border-transparent' : 'bg-white border-slate-100'
            }`}
          >
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center mb-6 ${
                s.dark
                  ? 'bg-white/10 border border-white/20'
                  : s.tint === 'amber'
                    ? 'bg-amber-50'
                    : s.tint === 'red'
                      ? 'bg-red-50'
                      : 'bg-green-50'
              }`}
            >
              <s.icon
                size={24}
                className={
                  s.dark
                    ? 'text-white'
                    : s.tint === 'amber'
                      ? 'text-amber-500'
                      : s.tint === 'red'
                        ? 'text-red-500'
                        : 'text-green-600'
                }
              />
            </div>
            <p
              className={`font-medium text-xs uppercase tracking-wider ${
                s.dark ? 'text-white/80' : 'text-slate-500'
              }`}
            >
              {s.label}
            </p>
            <h3 className={`text-[40px] font-bold leading-tight mt-1 ${s.dark ? '' : 'text-slate-800'}`}>
              {s.value.toLocaleString()}
            </h3>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-white rounded-[20px] p-6 shadow-sm border border-slate-100">
          <div className="mb-4">
            <h3 className="font-bold text-[15px] uppercase tracking-wider text-slate-800">Crop health overview</h3>
            <p className="text-slate-500 text-sm mt-1">Confirmed disease &amp; pest scans, last 30 days</p>
          </div>
          <div className="h-[350px] bg-slate-50 rounded-xl overflow-hidden relative z-0 border border-slate-100">
            <MapContainer center={CHENNAI} zoom={10} scrollWheelZoom={false} className="h-full w-full rounded-xl">
              <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
              {(hot.data?.points ?? []).map((p) => (
                <CircleMarker
                  key={p.id}
                  center={[p.lat, p.lng]}
                  radius={p.severity === 'high' ? 12 : 8}
                  color="transparent"
                  fillColor={sevColor(p.severity)}
                  fillOpacity={0.75}
                >
                  <Popup>
                    <strong>{p.diagnosis_label ?? 'Scan'}</strong>
                    <br />
                    {p.crop ?? 'unknown crop'} · {p.severity ?? '—'}
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
            <div className="absolute bottom-4 right-4 bg-white p-3 rounded-xl shadow-md border border-slate-100 z-[400] flex flex-col gap-2">
              {[['#ef4444', 'High'], ['#f59e0b', 'Moderate'], ['#22c55e', 'Low']].map(([c, l]) => (
                <div key={l} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
                  <span className="text-xs font-medium text-slate-700">{l}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[20px] p-6 shadow-sm border border-slate-100">
          <h3 className="font-bold text-[15px] uppercase tracking-wider text-slate-800 mb-6">Recent activity</h3>
          {recent.loading ? (
            <Loading />
          ) : (
            <div className="space-y-5">
              {(recent.data?.items ?? []).map((it) => {
                const bad = it.diagnosis_category === 'disease' || it.diagnosis_category === 'pest';
                return (
                  <div key={it.id} className="flex gap-4 items-center">
                    <div
                      className={`w-9 h-9 flex items-center justify-center rounded-full shrink-0 ${
                        it.severity === 'high'
                          ? 'bg-red-100 text-red-600'
                          : it.severity === 'medium'
                            ? 'bg-amber-100 text-amber-500'
                            : 'bg-green-100 text-green-600'
                      }`}
                    >
                      {it.diagnosis_category === 'pest' ? <Bug size={18} /> : <Leaf size={18} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-slate-800 truncate">
                        {it.crop ? `${it.crop} • ` : ''}
                        {it.diagnosis_label ?? 'Scan'}
                      </p>
                      <p className="text-xs text-slate-500 truncate">{it.farmer_name}</p>
                    </div>
                    <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
                      {timeAgo(it.created_at)}
                      <div
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: bad ? '#ef4444' : '#22c55e' }}
                      />
                    </div>
                  </div>
                );
              })}
              {(recent.data?.items ?? []).length === 0 && (
                <p className="text-sm text-slate-400">No recent scans.</p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-[20px] p-6 shadow-sm border border-slate-100">
          <h3 className="font-bold text-[15px] uppercase tracking-wider text-slate-800 mb-4">Top diagnoses (30d)</h3>
          <div className="space-y-3">
            {d.topDiagnoses.map((t) => {
              const max = d.topDiagnoses[0]?.count || 1;
              return (
                <div key={t.label ?? 'x'}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-slate-700">{t.label ?? 'Unknown'}</span>
                    <span className="text-slate-500">
                      {t.count}
                      {t.high > 0 && <span className="text-red-500"> · {t.high} high</span>}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-agri-primary rounded-full"
                      style={{ width: `${(t.count / max) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {d.topDiagnoses.length === 0 && <p className="text-sm text-slate-400">No confirmed problems yet.</p>}
          </div>
        </div>

        <div className="bg-white rounded-[20px] p-6 shadow-sm border border-slate-100">
          <h3 className="font-bold text-[15px] uppercase tracking-wider text-slate-800 mb-4">Scans by crop (30d)</h3>
          <div className="space-y-3">
            {d.byCrop.map((c) => {
              const max = d.byCrop[0]?.count || 1;
              return (
                <div key={c.crop ?? 'x'}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-slate-700 capitalize">{c.crop ?? 'Unlinked'}</span>
                    <span className="text-slate-500">{c.count}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-agri-dark rounded-full" style={{ width: `${(c.count / max) * 100}%` }} />
                  </div>
                </div>
              );
            })}
            {d.byCrop.length === 0 && <p className="text-sm text-slate-400">No scans yet.</p>}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
