import { motion } from 'framer-motion';
import { useState } from 'react';
import { Plus, BellRing } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useAuth } from '../lib/auth';
import type { AlertRow, CropsList } from '../lib/types';
import { Loading, ErrorBox, SeverityBadge } from '../components/ui';

export function Alerts() {
  const { officer } = useAuth();
  const { data, loading, error, reload } = useApi<{ alerts: AlertRow[] }>('/api/alerts?scope=region');
  const crops = useApi<CropsList>('/api/official/crops');
  const cropOptions = crops.data?.inRegion.length ? crops.data.inRegion : (crops.data?.known ?? []);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    message: '',
    crop: '',
    severity: 'medium',
    scope: 'region' as 'region' | 'all',
  });
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  const alerts = data?.alerts ?? [];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormErr(null);
    try {
      await api.post('/api/alerts', {
        title: form.title,
        message: form.message,
        severity: form.severity,
        ...(form.crop ? { crop: form.crop } : {}),
        ...(form.scope === 'region' && officer?.region ? { region: officer.region } : {}),
      });
      setOpen(false);
      setForm({ title: '', message: '', crop: '', severity: 'medium', scope: 'region' });
      reload();
    } catch (e) {
      setFormErr(e instanceof ApiError ? e.message : 'Could not broadcast');
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="p-8 h-[calc(100vh-80px)] overflow-auto"
    >
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold">Broadcast Alerts</h2>
          <p className="text-sm text-slate-500">Sent to farmers in {officer?.region ?? 'your region'}</p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="bg-agri-primary text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-agri-dark"
        >
          <Plus size={18} /> New alert
        </button>
      </div>

      {error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : loading ? (
        <Loading />
      ) : (
        <div className="space-y-4">
          {alerts.map((a) => (
            <div key={a.id} className="bg-white p-6 rounded-xl border flex gap-4 items-start shadow-sm">
              <div
                className={`p-3 rounded-xl ${
                  a.severity === 'high'
                    ? 'bg-red-100 text-red-600'
                    : a.severity === 'medium'
                      ? 'bg-amber-100 text-amber-600'
                      : 'bg-green-100 text-green-600'
                }`}
              >
                <BellRing size={22} />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-lg">{a.title}</h3>
                  <span className="text-xs text-slate-500">{new Date(a.created_at).toLocaleString()}</span>
                </div>
                <div className="flex gap-2 mt-1 mb-3 items-center">
                  {a.region && (
                    <span className="text-xs font-medium px-2 py-0.5 bg-slate-100 rounded text-slate-600">
                      {a.region}
                    </span>
                  )}
                  {a.crop && (
                    <span className="text-xs font-medium px-2 py-0.5 bg-slate-100 rounded text-slate-600 capitalize">
                      {a.crop}
                    </span>
                  )}
                  <SeverityBadge severity={a.severity} />
                </div>
                <p className="text-slate-600 text-sm">{a.message}</p>
              </div>
            </div>
          ))}
          {alerts.length === 0 && (
            <div className="p-12 text-center text-slate-500 bg-white border border-dashed rounded-xl">
              No alerts broadcast yet.
            </div>
          )}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl"
          >
            <h3 className="text-xl font-bold mb-4">New alert</h3>
            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Audience</label>
                  <select
                    value={form.scope}
                    onChange={(e) => setForm({ ...form, scope: e.target.value as 'region' | 'all' })}
                    className="w-full border rounded-lg px-3 py-2 bg-white"
                  >
                    <option value="region">{officer?.region ?? 'My region'}</option>
                    <option value="all">All regions</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Crop (optional)</label>
                  <select
                    value={form.crop}
                    onChange={(e) => setForm({ ...form, crop: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 bg-white capitalize"
                  >
                    <option value="">All crops</option>
                    {cropOptions.map((c) => (
                      <option key={c} value={c} className="capitalize">
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Severity</label>
                <div className="flex gap-4">
                  {['low', 'medium', 'high'].map((sev) => (
                    <label key={sev} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="severity"
                        checked={form.severity === sev}
                        onChange={() => setForm({ ...form, severity: sev })}
                      />
                      <span className="capitalize text-sm">{sev}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="e.g. Brown planthopper — scout your rice"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Message</label>
                <textarea
                  required
                  rows={4}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Actionable advice for farmers…"
                />
              </div>

              {formErr && <p className="text-sm text-red-600">{formErr}</p>}

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 bg-agri-primary text-white font-medium rounded-lg hover:bg-agri-dark disabled:opacity-60"
                >
                  {busy ? 'Sending…' : 'Broadcast'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
