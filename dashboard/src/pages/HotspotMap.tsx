import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useApi } from '../lib/useApi';
import type { HotspotPoint, HotspotSummary } from '../lib/types';
import { Loading, ErrorBox, timeAgo } from '../components/ui';

const CHENNAI: [number, number] = [13.05, 80.25];
const sevColor = (s: string | null) =>
  s === 'high' ? '#ef4444' : s === 'medium' ? '#f59e0b' : '#22c55e';

export function HotspotMap() {
  const [crop, setCrop] = useState('');
  const [severity, setSeverity] = useState('');
  const [days, setDays] = useState(30);

  const path = useMemo(() => {
    const p = new URLSearchParams({
      centerLat: '13.05',
      centerLng: '80.25',
      radiusKm: '80',
      days: String(days),
      includePending: 'true',
    });
    if (crop) p.set('crop', crop);
    if (severity) p.set('severity', severity);
    return `/api/hotspots?${p}`;
  }, [crop, severity, days]);

  const { data, loading, error, reload } = useApi<{
    points: HotspotPoint[];
    summary: HotspotSummary[];
  }>(path);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="h-[calc(100vh-80px)] flex flex-col"
    >
      <div className="p-4 bg-white border-b flex gap-4 items-center flex-wrap">
        <select value={crop} onChange={(e) => setCrop(e.target.value)} className="border rounded-md px-3 py-1.5 text-sm">
          <option value="">All crops</option>
          <option value="rice">Rice</option>
          <option value="sugarcane">Sugarcane</option>
          <option value="groundnut">Groundnut</option>
        </select>
        <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="border rounded-md px-3 py-1.5 text-sm">
          <option value="">All severities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select value={days} onChange={(e) => setDays(+e.target.value)} className="border rounded-md px-3 py-1.5 text-sm">
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
        <span className="text-sm text-slate-500">
          {loading ? 'loading…' : `${data?.points.length ?? 0} scans`}
        </span>
      </div>

      {error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : (
        <div className="flex-1 relative z-0 flex">
          <MapContainer center={CHENNAI} zoom={11} scrollWheelZoom className="h-full flex-1">
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {(data?.points ?? []).map((p) => (
              <CircleMarker
                key={p.id}
                center={[p.lat, p.lng]}
                radius={p.severity === 'high' ? 13 : 9}
                color="#fff"
                weight={1.5}
                fillColor={sevColor(p.severity)}
                fillOpacity={0.85}
              >
                <Popup>
                  <strong>{p.diagnosis_label ?? 'Scan'}</strong>
                  <br />
                  {p.crop ?? 'unknown'} · {p.severity ?? '—'} · {p.status}
                  <br />
                  <span className="text-slate-500">{timeAgo(p.created_at)}</span>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>

          <div className="w-72 bg-white border-l overflow-auto p-4">
            <h3 className="font-bold text-sm uppercase tracking-wide text-slate-700 mb-3">By diagnosis</h3>
            {loading ? (
              <Loading />
            ) : (data?.summary ?? []).length === 0 ? (
              <p className="text-sm text-slate-400">No scans match these filters.</p>
            ) : (
              <div className="space-y-2">
                {data!.summary.map((s) => (
                  <div key={s.diagnosis_label ?? 'x'} className="p-3 rounded-lg border border-slate-100 bg-slate-50">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-slate-800">{s.diagnosis_label ?? 'Unknown'}</span>
                      <span className="text-sm text-slate-500">{s.count}</span>
                    </div>
                    {s.high_count > 0 && (
                      <span className="text-xs text-red-500">{s.high_count} high severity</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
