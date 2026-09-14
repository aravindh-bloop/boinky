import { motion } from 'framer-motion';
import { useState } from 'react';
import { Droplets, SprayCan, Sprout, Eye, Scissors, CircleDot, CalendarDays } from 'lucide-react';
import { useApi } from '../lib/useApi';
import type { CropsList } from '../lib/types';
import { Card, ErrorBox, PageHeader, Skeleton, Select } from '../components/ui';

interface Template {
  crop: string;
  durationDays: number;
  peakVulnerability: { fromDay: number; toDay: number };
  mainThreats: string[];
  tasks: { offsetDays: number; taskType: string; title: string; description: string }[];
}

const ICON: Record<string, typeof Droplets> = {
  irrigation: Droplets,
  spraying: SprayCan,
  fertilizing: Sprout,
  scouting: Eye,
  harvest: Scissors,
  other: CircleDot,
};

export function CropCalendar() {
  const cropsApi = useApi<CropsList>('/api/official/crops');
  const crops = cropsApi.data?.known ?? [];
  const regionCrops = cropsApi.data?.inRegion ?? [];
  const [crop, setCrop] = useState('');
  const active = crop || regionCrops[0] || crops[0] || '';

  const { data, loading, error, reload } = useApi<Template>(
    active ? `/api/official/calendar-template?crop=${active}` : null,
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="p-8 h-[calc(100vh-80px)] overflow-auto"
    >
      <PageHeader
        icon={CalendarDays}
        title="Crop Calendar"
        subtitle="The season schedule farmers get auto-generated when they add a field"
        action={
          <Select value={active} onChange={(e) => setCrop(e.target.value)} className="capitalize w-48">
            {crops.map((c) => (
              <option key={c} value={c} className="capitalize">
                {c}
                {regionCrops.includes(c) ? ' • in region' : ''}
              </option>
            ))}
          </Select>
        }
      />

      {error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : loading || !data ? (
        <div className="grid grid-cols-3 gap-4">
          <Skeleton variant="block" />
          <Skeleton variant="block" />
          <Skeleton variant="block" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <Card padding="md">
              <p className="text-xs uppercase tracking-wide text-slate-500">Crop duration</p>
              <p className="text-2xl font-bold mt-1 text-slate-800">{data.durationDays} days</p>
            </Card>
            <Card padding="md">
              <p className="text-xs uppercase tracking-wide text-slate-500">Peak-risk window</p>
              <p className="text-2xl font-bold mt-1 text-slate-800">
                Day {data.peakVulnerability.fromDay}–{data.peakVulnerability.toDay}
              </p>
            </Card>
            <Card padding="md">
              <p className="text-xs uppercase tracking-wide text-slate-500">Main threats</p>
              <p className="text-sm font-medium mt-1 capitalize text-slate-800">{data.mainThreats.join(', ')}</p>
            </Card>
          </div>

          <div className="relative pl-6 border-l-2 border-slate-200 space-y-6">
            {data.tasks
              .slice()
              .sort((a, b) => a.offsetDays - b.offsetDays)
              .map((t, i) => {
                const Ic = ICON[t.taskType] ?? CircleDot;
                const inPeak =
                  t.offsetDays >= data.peakVulnerability.fromDay && t.offsetDays <= data.peakVulnerability.toDay;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i, 12) * 0.03 }}
                    className="relative"
                  >
                    <div
                      className={`absolute -left-[35px] w-8 h-8 rounded-full border-2 border-white grid place-items-center ${
                        inPeak ? 'bg-status-warning-bg text-status-warning' : 'bg-agri-light text-agri-primary'
                      }`}
                    >
                      <Ic size={15} />
                    </div>
                    <Card padding="md">
                      <div className="flex justify-between items-start gap-3">
                        <p className="font-semibold text-slate-800">{t.title}</p>
                        <span className="text-xs text-slate-500 shrink-0">Day {t.offsetDays}</span>
                      </div>
                      <p className="text-sm text-slate-600 mt-1">{t.description}</p>
                      {inPeak && (
                        <span className="text-xs text-status-warning font-medium mt-2 inline-block">
                          Falls in the peak-risk window
                        </span>
                      )}
                    </Card>
                  </motion.div>
                );
              })}
          </div>
        </>
      )}
    </motion.div>
  );
}
