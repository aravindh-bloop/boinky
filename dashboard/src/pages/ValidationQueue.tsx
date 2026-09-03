import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle, XCircle, PencilLine, MapPin, X, Video, ImageOff } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useApi } from '../lib/useApi';
import type { QueueItem, OfficerScanDetail } from '../lib/types';
import { Loading, ErrorBox, SeverityBadge } from '../components/ui';

const ANGLE_LABEL: Record<string, string> = {
  whole_plant: 'Whole plant',
  affected_closeup: 'Close-up',
  leaf_underside: 'Underside',
  stem_base: 'Stem / base',
  fruit_panicle: 'Fruit / grain',
  field_wide: 'Wider field',
  video: 'Video',
  extra: 'Photo',
};

export function ValidationQueue() {
  const [params, setParams] = useSearchParams();
  const district = params.get('district');
  const { data, loading, error, reload } = useApi<{ items: QueueItem[] }>(
    `/api/official/validation-queue?limit=50${
      district ? `&district=${encodeURIComponent(district)}` : ''
    }`,
  );
  const [selected, setSelected] = useState<QueueItem | null>(null);
  const [detail, setDetail] = useState<OfficerScanDetail | null>(null);
  const [activeMedia, setActiveMedia] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [correctLabel, setCorrectLabel] = useState('');
  const [note, setNote] = useState('');

  const items = data?.items ?? [];

  useEffect(() => {
    setDetail(null);
    setActiveMedia(0);
    if (!selected) return;
    let cancelled = false;
    api
      .get<{ scan: OfficerScanDetail }>(`/api/official/scans/${selected.id}`)
      .then((r) => !cancelled && setDetail(r.scan))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selected]);

  async function act(action: 'confirm' | 'correct' | 'reject') {
    if (!selected) return;
    setBusy(action);
    try {
      await api.post(`/api/official/scans/${selected.id}/validate`, {
        action,
        ...(action === 'correct' && correctLabel ? { correctedLabel: correctLabel } : {}),
        ...(note ? { note } : {}),
      });
      setSelected(null);
      setCorrectLabel('');
      setNote('');
      reload();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Action failed');
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <Loading label="Loading queue…" />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="p-8 flex h-[calc(100vh-80px)]"
    >
      <div className={`flex-1 pr-4 ${selected ? 'w-2/3 border-r' : 'w-full'}`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold">Validation Queue</h2>
            {district && (
              <button
                onClick={() => setParams({}, { replace: true })}
                className="flex items-center gap-1 text-sm bg-agri-primary/10 text-agri-primary px-2.5 py-1 rounded-full hover:bg-agri-primary/20"
              >
                <MapPin size={13} /> {district} <X size={13} />
              </button>
            )}
          </div>
          <span className="text-sm text-slate-500">{items.length} awaiting review</span>
        </div>
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b">
              <tr>
                {['Scan', 'Diagnosis', 'Farmer', 'Confidence', 'Severity', 'Date'].map((h) => (
                  <th key={h} className="px-4 py-3 text-sm font-medium text-slate-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((s, i) => (
                <motion.tr
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i, 10) * 0.03 }}
                  key={s.id}
                  onClick={() => setSelected(s)}
                  className={`border-b hover:bg-slate-50 cursor-pointer ${
                    selected?.id === s.id ? 'bg-agri-primary/5' : ''
                  } ${(s.confidence ?? 1) < 0.6 ? 'border-l-4 border-l-amber-500' : ''}`}
                >
                  <td className="px-4 py-3">
                    <img src={s.image_url} alt="" className="w-12 h-12 rounded object-cover bg-slate-100" />
                  </td>
                  <td className="px-4 py-3 font-medium">{s.diagnosis_label ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{s.farmer_name}</td>
                  <td className="px-4 py-3">
                    {(s.confidence ?? 1) < 0.6 && (
                      <AlertCircle size={14} className="inline text-amber-500 mr-1" />
                    )}
                    {s.confidence != null ? `${Math.round(s.confidence * 100)}%` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <SeverityBadge severity={s.severity} />
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {new Date(s.created_at).toLocaleDateString()}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && (
            <div className="p-10 text-center text-slate-500">Queue is clear — nothing to review.</div>
          )}
        </div>
      </div>

      {selected && (
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-1/3 pl-6 flex flex-col"
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold">Scan details</h3>
            <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-700">
              ✕
            </button>
          </div>

          <MediaGallery
            media={detail?.media ?? []}
            fallback={selected.image_url}
            active={activeMedia}
            setActive={setActiveMedia}
          />

          <div className="space-y-3 flex-1 overflow-auto">
            {detail && detail.image_quality && detail.image_quality !== 'good' && (detail.coverage_gaps?.length ?? 0) > 0 && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                <p className="text-xs font-semibold text-amber-700 flex items-center gap-1 mb-1">
                  <ImageOff size={12} /> AI flagged the photo set as “{detail.image_quality}”
                </p>
                <ul className="text-xs text-amber-800 list-disc pl-4 space-y-0.5">
                  {detail.coverage_gaps!.slice(0, 4).map((g, i) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
              </div>
            )}
            {detail?.farmer_note && (
              <div className="p-3 rounded-xl bg-slate-50 border">
                <p className="text-xs font-medium mb-1">
                  Farmer's note{detail.farmer_note_language ? ` (${detail.farmer_note_language})` : ''}
                </p>
                <p className="text-sm text-slate-600 italic">“{detail.farmer_note}”</p>
              </div>
            )}
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-slate-500">AI diagnosis</p>
                <p className="text-lg font-bold">{selected.diagnosis_label ?? 'Unknown'}</p>
              </div>
              <span className="text-sm px-2 py-1 bg-green-100 text-green-800 rounded">
                {selected.confidence != null ? `${Math.round(selected.confidence * 100)}%` : '—'}
              </span>
            </div>
            <p className="text-sm text-slate-600">
              {selected.crop ?? 'crop not linked'} · {selected.farmer_name}
              {selected.farmer_phone ? ` · ${selected.farmer_phone}` : ''}
            </p>
            {selected.district && (
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <MapPin size={12} /> {selected.district} district
                {selected.lat != null && selected.lng != null
                  ? ` · ${selected.lat.toFixed(4)}, ${selected.lng.toFixed(4)}`
                  : ''}
              </p>
            )}
            {selected.advisory_text && (
              <div className="p-3 bg-slate-50 rounded-xl border">
                <p className="text-xs font-medium mb-1">Advisory the farmer sees</p>
                <p className="text-sm text-slate-600">{selected.advisory_text}</p>
              </div>
            )}

            <div>
              <label className="text-xs text-slate-500 flex items-center gap-1 mb-1">
                <PencilLine size={12} /> Correct the label (optional)
              </label>
              <input
                value={correctLabel}
                onChange={(e) => setCorrectLabel(e.target.value)}
                placeholder={selected.diagnosis_label ?? 'e.g. Bacterial Leaf Blight'}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note to the farmer (optional)"
              rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <button
              onClick={() => act('reject')}
              disabled={!!busy}
              className="py-2.5 bg-white border border-red-200 text-red-600 rounded-lg flex items-center justify-center gap-1.5 text-sm font-medium hover:bg-red-50 disabled:opacity-50"
            >
              <XCircle size={16} /> Reject
            </button>
            <button
              onClick={() => act('correct')}
              disabled={!!busy || !correctLabel}
              className="py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg flex items-center justify-center gap-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
            >
              <PencilLine size={16} /> Correct
            </button>
            <button
              onClick={() => act('confirm')}
              disabled={!!busy}
              className="py-2.5 bg-agri-primary text-white rounded-lg flex items-center justify-center gap-1.5 text-sm font-medium hover:bg-agri-dark disabled:opacity-50"
            >
              <CheckCircle size={16} /> Confirm
            </button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

function MediaGallery({
  media,
  fallback,
  active,
  setActive,
}: {
  media: { id: string; kind: string; url: string; resource: 'image' | 'video' }[];
  fallback: string;
  active: number;
  setActive: (n: number) => void;
}) {
  const items =
    media.length > 0
      ? media
      : [{ id: 'x', kind: 'whole_plant', url: fallback, resource: 'image' as const }];
  const cur = items[Math.min(active, items.length - 1)]!;

  return (
    <div className="mb-4">
      {cur.resource === 'video' ? (
        <video src={cur.url} controls className="w-full h-48 object-cover rounded-xl bg-black" />
      ) : (
        <img src={cur.url} alt="" className="w-full h-48 object-cover rounded-xl bg-slate-100" />
      )}
      {items.length > 1 && (
        <>
          <div className="flex gap-1.5 mt-2 overflow-x-auto">
            {items.map((m, i) => (
              <button
                key={m.id}
                onClick={() => setActive(i)}
                className={`relative shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 ${
                  i === active ? 'border-agri-primary' : 'border-transparent'
                }`}
              >
                <img src={m.url} alt="" className="w-full h-full object-cover" />
                {m.resource === 'video' && (
                  <span className="absolute inset-0 grid place-items-center bg-black/25 text-white">
                    <Video size={14} />
                  </span>
                )}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {ANGLE_LABEL[cur.kind] ?? 'Photo'} · {active + 1}/{items.length}
          </p>
        </>
      )}
    </div>
  );
}
