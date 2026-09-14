import { motion } from 'framer-motion';
import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, BellRing } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useAuth } from '../lib/auth';
import type { AlertRow, CropsList } from '../lib/types';
import { Card, ErrorBox, EmptyState, PageHeader, Skeleton, Button, SeverityBadge, Input, Select, Textarea } from '../components/ui';

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
      toast.success('Alert broadcast');
      setOpen(false);
      setForm({ title: '', message: '', crop: '', severity: 'medium', scope: 'region' });
      reload();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Could not broadcast';
      setFormErr(msg);
      toast.error(msg);
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
      <PageHeader
        icon={BellRing}
        title="Broadcast Alerts"
        subtitle={`Sent to farmers in ${officer?.region ?? 'your region'}`}
        action={
          <Button icon={Plus} onClick={() => setOpen(true)}>
            New alert
          </Button>
        }
      />

      {error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : loading ? (
        <div className="space-y-3">
          <Skeleton variant="block" />
          <Skeleton variant="block" />
        </div>
      ) : alerts.length === 0 ? (
        <Card>
          <EmptyState icon={BellRing} title="No alerts broadcast yet" description="Send one to notify farmers in your region." />
        </Card>
      ) : (
        <div className="space-y-4">
          {alerts.map((a) => {
            const tone = a.severity === 'high' ? 'bg-status-danger-bg text-status-danger' : a.severity === 'medium' ? 'bg-status-warning-bg text-status-warning' : 'bg-status-success-bg text-status-success';
            return (
              <Card key={a.id} className="flex gap-4 items-start">
                <div className={`p-3 rounded-xl ${tone}`}>
                  <BellRing size={22} />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start gap-3">
                    <h3 className="font-bold text-lg text-slate-800">{a.title}</h3>
                    <span className="text-xs text-slate-500 shrink-0">{new Date(a.created_at).toLocaleString()}</span>
                  </div>
                  <div className="flex gap-2 mt-1 mb-3 items-center flex-wrap">
                    {a.region && (
                      <span className="text-xs font-medium px-2 py-0.5 bg-slate-100 rounded text-slate-600">{a.region}</span>
                    )}
                    {a.crop && (
                      <span className="text-xs font-medium px-2 py-0.5 bg-slate-100 rounded text-slate-600 capitalize">{a.crop}</span>
                    )}
                    <SeverityBadge severity={a.severity} />
                  </div>
                  <p className="text-slate-600 text-sm">{a.message}</p>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-lg">
            <Card>
              <h3 className="text-xl font-bold mb-4 text-slate-800">New alert</h3>
              <form onSubmit={submit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Select
                    label="Audience"
                    value={form.scope}
                    onChange={(e) => setForm({ ...form, scope: e.target.value as 'region' | 'all' })}
                  >
                    <option value="region">{officer?.region ?? 'My region'}</option>
                    <option value="all">All regions</option>
                  </Select>
                  <Select
                    label="Crop (optional)"
                    value={form.crop}
                    onChange={(e) => setForm({ ...form, crop: e.target.value })}
                    className="capitalize"
                  >
                    <option value="">All crops</option>
                    {cropOptions.map((c) => (
                      <option key={c} value={c} className="capitalize">
                        {c}
                      </option>
                    ))}
                  </Select>
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

                <Input
                  label="Title"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Brown planthopper — scout your rice"
                />
                <Textarea
                  label="Message"
                  required
                  rows={4}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="Actionable advice for farmers…"
                />

                {formErr && <p className="text-sm text-status-danger">{formErr}</p>}

                <div className="flex justify-end gap-3 mt-6">
                  <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" loading={busy}>
                    {busy ? 'Sending…' : 'Broadcast'}
                  </Button>
                </div>
              </form>
            </Card>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
