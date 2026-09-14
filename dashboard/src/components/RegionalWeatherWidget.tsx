import { CloudSun, Droplets } from 'lucide-react';
import { useApi } from '../lib/useApi';
import type { Weather } from '../lib/types';
import { Card } from './ui';

/** Compact current-conditions card for whatever point the map is centered on. */
export function RegionalWeatherWidget({ lat, lng }: { lat: number; lng: number }) {
  const { data, loading } = useApi<Weather>(`/api/weather?lat=${lat.toFixed(3)}&lng=${lng.toFixed(3)}`);

  if (loading && !data) {
    return (
      <Card padding="sm" className="w-64">
        <p className="text-xs text-slate-400">Loading weather…</p>
      </Card>
    );
  }
  if (!data) return null;

  const rain3d = data.daily.slice(0, 3).reduce((sum, d) => sum + (d.precipMm ?? 0), 0);
  const advisory = data.advisories[0];

  return (
    <Card padding="sm" className="w-64">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-status-info-bg text-status-info grid place-items-center shrink-0">
          <CloudSun size={18} />
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold text-slate-800 leading-tight">
            {data.current.tempC != null ? `${Math.round(data.current.tempC)}°C` : '—'}
          </p>
          <p className="text-xs text-slate-500 truncate">{data.current.condition}</p>
        </div>
        <div className="ml-auto text-right shrink-0">
          <p className="text-xs text-slate-500 flex items-center gap-1 justify-end">
            <Droplets size={12} /> {Math.round(rain3d)}mm
          </p>
          <p className="text-[10px] text-slate-400">next 3 days</p>
        </div>
      </div>
      {advisory && (
        <p className="text-xs text-slate-600 mt-2 pt-2 border-t border-slate-100 line-clamp-2">{advisory.title}</p>
      )}
    </Card>
  );
}
