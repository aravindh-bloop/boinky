import { motion } from 'framer-motion';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle, XCircle, PencilLine, MapPin, X } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useApi } from '../lib/useApi';
import type { QueueItem } from '../lib/types';
import { Loading, ErrorBox, SeverityBadge } from '../components/ui';

export function ValidationQueue() {
  const [params, setParams] = useSearchParams();
  const district = params.get('district');
  const { data, loading, error, reload } = useApi<{ items: QueueItem[] }>(
    `/api/official/validation-queue?limit=50${
      district ? `&district=${encodeURIComponent(district)}` : ''
    }`,
  );
  const [selected, setSelected] = useState<QueueItem | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [correctLabel, setCorrectLabel] = useState('');
  const [note, setNote] = useState('');

  const items = data?.items ?? [];

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

          <img
            src={selected.image_url}
            alt=""
            className="w-full h-48 object-cover rounded-xl mb-4 bg-slate-100"
          />

          <div className="space-y-3 flex-1 overflow-auto">
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
