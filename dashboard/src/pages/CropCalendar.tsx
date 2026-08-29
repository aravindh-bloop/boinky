import { motion } from 'framer-motion';
import { useState } from 'react';
import { Droplets, SprayCan, Sprout, Eye, Scissors, CircleDot } from 'lucide-react';
import { useApi } from '../lib/useApi';
import { Loading, ErrorBox } from '../components/ui';

interface Template {
  crop: string;
  durationDays: number;
  peakVulnerability: { fromDay: number; toDay: number };
  mainThreats: string[];
  tasks: { offsetDays: number; taskType: string; title: string; description: string }[];
}

const CROPS = ['rice', 'sugarcane', 'groundnut', 'cotton', 'tomato', 'wheat', 'maize', 'onion'];

const ICON: Record<string, typeof Droplets> = {
  irrigation: Droplets,
  spraying: SprayCan,
  fertilizing: Sprout,
  scouting: Eye,
  harvest: Scissors,
  other: CircleDot,
};

export function CropCalendar() {
  const [crop, setCrop] = useState('rice');
  const { data, loading, error, reload } = useApi<Template>(
    `/api/official/calendar-template?crop=${crop}`,
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="p-8 h-[calc(100vh-80px)] overflow-auto"
    >
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold">Crop Calendar</h2>
          <p className="text-sm text-slate-500">
            The season schedule farmers get auto-generated when they add a field.
          </p>
        </div>
        <select
          value={crop}
          onChange={(e) => setCrop(e.target.value)}
          className="border rounded-lg px-3 py-2 bg-white capitalize"
        >
          {CROPS.map((c) => (
            <option key={c} value={c} className="capitalize">
              {c}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : loading || !data ? (
        <Loading />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-xl border p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Crop duration</p>
              <p className="text-2xl font-bold mt-1">{data.durationDays} days</p>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Peak-risk window</p>
              <p className="text-2xl font-bold mt-1">
                Day {data.peakVulnerability.fromDay}–{data.peakVulnerability.toDay}
              </p>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Main threats</p>
              <p className="text-sm font-medium mt-1 capitalize">{data.mainThreats.join(', ')}</p>
            </div>
          </div>

          <div className="relative pl-6 border-l-2 border-slate-200 space-y-6">
            {data.tasks
              .slice()
              .sort((a, b) => a.offsetDays - b.offsetDays)
              .map((t, i) => {
                const Ic = ICON[t.taskType] ?? CircleDot;
                const inPeak =
                  t.offsetDays >= data.peakVulnerability.fromDay &&
                  t.offsetDays <= data.peakVulnerability.toDay;
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
                        inPeak ? 'bg-amber-100 text-amber-600' : 'bg-agri-primary/15 text-agri-dark'
                      }`}
                    >
                      <Ic size={15} />
                    </div>
                    <div className="bg-white rounded-xl border p-4">
                      <div className="flex justify-between items-start">
                        <p className="font-semibold text-slate-800">{t.title}</p>
                        <span className="text-xs text-slate-500 shrink-0 ml-3">Day {t.offsetDays}</span>
                      </div>
                      <p className="text-sm text-slate-600 mt-1">{t.description}</p>
                      {inPeak && (
                        <span className="text-xs text-amber-600 font-medium mt-2 inline-block">
                          Falls in the peak-risk window
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
          </div>
        </>
      )}
    </motion.div>
  );
}
