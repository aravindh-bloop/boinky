import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import { useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useApi } from '../lib/useApi';
import type { HotspotPoint, HotspotSummary, CropsList } from '../lib/types';
import { Loading, ErrorBox, Button } from '../components/ui';
import { timeAgo } from '../lib/format';
import { RegionalWeatherWidget } from '../components/RegionalWeatherWidget';
import { EscalationPredictionPanel } from '../components/EscalationPredictionPanel';
import type { OutbreakProjectionRequest } from '../lib/types';
import { Sparkles } from 'lucide-react';

// India-wide bounding box — an honest "show everything" default rather than
// another hardcoded point. The view then fits to whatever real points come
// back (see FitBounds below), so an officer outside Chennai isn't silently
// shown zero data (the old default was centerLat/centerLng/radiusKm=80 around
// Chennai, which scoped the *query itself*, not just the map's initial view).
const INDIA_CENTER: [number, number] = [22.5, 80];
const INDIA_BBOX_NUMS: [number, number, number, number] = [68, 6, 97.5, 37.5];
const INDIA_BBOX = INDIA_BBOX_NUMS.join(',');

const sevColor = (s: string | null) =>
  s === 'high' ? '#ef4444' : s === 'medium' ? '#f59e0b' : '#22c55e';

/** Recenters/zooms the map to fit whatever points the current filters return. */
function FitBounds({ points }: { points: { lat: number; lng: number }[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
  }, [map, points]);
  return null;
}

export function HotspotMap() {
  const [crop, setCrop] = useState('');
  const [severity, setSeverity] = useState('');
  const [days, setDays] = useState(30);

  const path = useMemo(() => {
    const p = new URLSearchParams({
      bbox: INDIA_BBOX,
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
  const crops = useApi<CropsList>('/api/official/crops');
  const cropOptions = crops.data?.inRegion.length ? crops.data.inRegion : (crops.data?.known ?? []);

  // Centroid of the current result set — recomputed only when the underlying
  // data changes (a new filter/query), never on the user just panning/zooming
  // the map, so the weather call fires once per data set, not per gesture.
  const weatherCenter = useMemo(() => {
    const pts = data?.points ?? [];
    if (pts.length === 0) return null;
    const lat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
    const lng = pts.reduce((s, p) => s + p.lng, 0) / pts.length;
    return { lat, lng };
  }, [data?.points]);

  const [showPrediction, setShowPrediction] = useState(false);
  const projectionQuery: OutbreakProjectionRequest = useMemo(
    () => ({
      bbox: INDIA_BBOX_NUMS,
      days,
      crop: crop || undefined,
      severity: (severity as 'low' | 'medium' | 'high') || undefined,
      horizonDays: 21,
    }),
    [crop, severity, days],
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="h-[calc(100vh-80px)] flex flex-col"
    >
      <div className="p-4 bg-white border-b flex gap-4 items-center flex-wrap">
        <select value={crop} onChange={(e) => setCrop(e.target.value)} className="border rounded-md px-3 py-1.5 text-sm capitalize">
          <option value="">All crops</option>
          {cropOptions.map((c) => (
            <option key={c} value={c} className="capitalize">
              {c}
            </option>
          ))}
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
        <Button
          variant="primary"
          size="sm"
          icon={Sparkles}
          className="ml-auto"
          disabled={!data?.points.length}
          onClick={() => setShowPrediction(true)}
        >
          Predict escalation
        </Button>
      </div>

      {error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : (
        <div className="flex-1 relative z-0 flex">
          {weatherCenter && (
            <div className="absolute top-3 left-3 z-[1000]">
              <RegionalWeatherWidget lat={weatherCenter.lat} lng={weatherCenter.lng} />
            </div>
          )}
          <MapContainer center={INDIA_CENTER} zoom={5} scrollWheelZoom className="h-full flex-1">
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitBounds points={data?.points ?? []} />
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

          {showPrediction && (
            <EscalationPredictionPanel query={projectionQuery} onClose={() => setShowPrediction(false)} />
          )}
        </div>
      )}
    </motion.div>
  );
}
