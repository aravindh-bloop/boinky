import { motion } from 'framer-motion';
import { useState } from 'react';
import {
  Umbrella,
  ClipboardList,
  CheckCircle2,
  ShieldAlert,
  X,
  Phone,
  Mail,
  ExternalLink,
  Plus,
} from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useApi } from '../lib/useApi';
import type {
  EscalationRow,
  EscalationDetail,
  EscalationStatus,
  EscalationSummary,
  DirectoryRow,
  Rung,
} from '../lib/types';
import { Loading, ErrorBox, timeAgo } from '../components/ui';

const STAGE_LABEL: Record<string, string> = {
  intimation: 'Loss reported',
  survey: 'Field survey',
  assessment: 'Loss assessed',
  approval: 'Claim decided',
  payout: 'Money paid',
  closed: 'Closed',
};
const RUNG_LABEL: Record<Rung, string> = {
  block: 'Block Agri Officer',
  district: 'District Joint Director',
  dgrc: 'District Grievance Committee',
  state: 'State Nodal / Directorate',
  ombudsman: 'Insurance Ombudsman',
  krph: 'KRPH 14447',
  cpgrams: 'CPGRAMS',
};
const STATUS_STYLE: Record<EscalationStatus, string> = {
  sent: 'bg-amber-100 text-amber-700',
  acknowledged: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-blue-100 text-blue-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-slate-100 text-slate-600',
};
const CAUSE: Record<string, string> = {
  flood: 'Flood',
  drought: 'Drought',
  pest_disease: 'Pest / disease',
  hailstorm: 'Hailstorm',
  cyclone: 'Cyclone',
  fire: 'Fire',
  unseasonal_rain: 'Unseasonal rain',
  frost: 'Frost',
  prevented_sowing: 'Prevented sowing',
  other: 'Other',
};

export function Insurance() {
  const [tab, setTab] = useState<'inbox' | 'directory'>('inbox');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="p-8 h-[calc(100vh-80px)] overflow-auto"
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Crop Insurance — claim tracker</h2>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {(['inbox', 'directory'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium ${
                tab === k ? 'bg-white shadow-sm' : 'text-slate-500'
              }`}
            >
              {k === 'inbox' ? 'Escalations' : 'Officer directory'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'inbox' ? <Inbox /> : <Directory />}
    </motion.div>
  );
}

// ── escalations inbox ───────────────────────────────────────────────────────

function Inbox() {
  const [statusFilter, setStatusFilter] = useState<EscalationStatus | ''>('');
  const summary = useApi<EscalationSummary>('/api/official/insurance-summary');
  const list = useApi<{ items: EscalationRow[] }>(
    `/api/official/insurance-escalations${statusFilter ? `?status=${statusFilter}` : ''}`,
  );
  const [sel, setSel] = useState<string | null>(null);
  const s = summary.data;

  const refetch = () => {
    summary.reload();
    list.reload();
  };

  return (
    <>
      <div className="grid grid-cols-4 gap-4 mb-6">
        <SummaryCard icon={ShieldAlert} label="Open" value={s?.open ?? '—'} tint="amber" />
        <SummaryCard
          icon={ClipboardList}
          label="In progress"
          value={s?.byStatus?.in_progress ?? 0}
          tint="blue"
        />
        <SummaryCard icon={CheckCircle2} label="Resolved" value={s?.resolved ?? '—'} tint="emerald" />
        <SummaryCard
          icon={Umbrella}
          label="Top rung"
          value={s?.byRung?.[0] ? RUNG_LABEL[s.byRung[0].rung as Rung] ?? s.byRung[0].rung : '—'}
          tint="slate"
        />
      </div>

      <div className="flex gap-6">
        <div className={sel ? 'w-3/5' : 'w-full'}>
          <div className="flex gap-2 mb-3 flex-wrap">
            {(['', 'sent', 'acknowledged', 'in_progress', 'resolved', 'closed'] as const).map((st) => (
              <button
                key={st || 'all'}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-full text-xs font-medium border ${
                  statusFilter === st
                    ? 'bg-agri-primary text-white border-transparent'
                    : 'bg-white text-slate-600'
                }`}
              >
                {st ? st.replace('_', ' ') : 'All'}
              </button>
            ))}
          </div>

          {list.loading ? (
            <Loading />
          ) : list.error ? (
            <ErrorBox message={list.error} onRetry={list.reload} />
          ) : (
            <div className="bg-white rounded-xl border overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b text-slate-500">
                  <tr>
                    {['Farmer', 'Claim', 'Escalated to', 'Status', 'Age'].map((h) => (
                      <th key={h} className="px-4 py-3 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(list.data?.items ?? []).map((e) => (
                    <tr
                      key={e.id}
                      onClick={() => setSel(e.id)}
                      className={`border-b hover:bg-slate-50 cursor-pointer ${
                        sel === e.id ? 'bg-agri-primary/5' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{e.farmer_name}</div>
                        <div className="text-xs text-slate-500">{e.district ?? e.farmer_phone}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="capitalize">
                          {CAUSE[e.cause] ?? e.cause} · {e.crop}
                        </div>
                        <div className="text-xs text-slate-500">
                          stuck at {STAGE_LABEL[e.stage] ?? e.stage}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{RUNG_LABEL[e.rung] ?? e.rung}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${STATUS_STYLE[e.status]}`}
                        >
                          {e.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{timeAgo(e.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(list.data?.items ?? []).length === 0 && (
                <div className="p-8 text-center text-slate-500">No escalations.</div>
              )}
            </div>
          )}
        </div>

        {sel && <EscalationPanel key={sel} id={sel} onClose={() => setSel(null)} onChange={refetch} />}
      </div>
    </>
  );
}

function EscalationPanel({
  id,
  onClose,
  onChange,
}: {
  id: string;
  onClose: () => void;
  onChange: () => void;
}) {
  const { data, loading, reload } = useApi<EscalationDetail>(
    `/api/official/insurance-escalations/${id}`,
  );
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  if (loading || !data) {
    return (
      <div className="w-2/5 bg-white border rounded-xl p-5 h-fit sticky top-4">
        <Loading />
      </div>
    );
  }
  const e = data.escalation;

  async function setStatus(status: EscalationStatus) {
    setBusy(status);
    try {
      await api.post(`/api/official/insurance-escalations/${id}/status`, {
        status,
        ...(note ? { note } : {}),
      });
      setNote('');
      reload();
      onChange();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      className="w-2/5 bg-white border rounded-xl p-5 h-[calc(100vh-140px)] overflow-auto sticky top-4"
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-bold text-lg capitalize">
            {CAUSE[e.cause] ?? e.cause} — {e.crop}
          </h3>
          <p className="text-sm text-slate-500">
            {e.farmer_name} · {e.district ?? e.farmer_region ?? e.farmer_phone}
          </p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
          <X size={18} />
        </button>
      </div>

      <div className="rounded-lg border bg-amber-50/60 border-amber-200 p-3 mb-4 text-sm">
        <p className="text-xs font-semibold text-amber-700 mb-1">
          Escalated to {RUNG_LABEL[e.rung] ?? e.rung} · via {e.channel}
        </p>
        <p className="text-slate-700">{e.reason}</p>
        {e.external_ref && (
          <p className="text-xs text-slate-500 mt-1">Ref: {e.external_ref}</p>
        )}
      </div>

      <div className="text-sm space-y-1 mb-4">
        <Fact k="PMFBY application" v={e.application_no} />
        <Fact k="Docket / intimation" v={e.docket_id} />
        <Fact k="Insurer" v={e.insurer_name} />
        <Fact k="Season" v={e.season} />
        <Fact k="Loss reported" v={e.incident_date} />
        <Fact k="Stuck at" v={`${STAGE_LABEL[e.stage] ?? e.stage} since ${e.stage_since?.slice(0, 10)}`} />
        <Fact k="Sum insured" v={e.sum_insured ? `₹${Math.round(e.sum_insured).toLocaleString('en-IN')}` : null} />
      </div>

      {/* claim timeline */}
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
        Farmer's timeline
      </p>
      <div className="space-y-2 mb-4">
        {data.events.map((ev, i) => (
          <div key={i} className="flex gap-2 text-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-agri-primary mt-2 shrink-0" />
            <div>
              <p className="text-slate-700">
                {ev.body ??
                  (ev.to_stage ? `Moved to ${STAGE_LABEL[ev.to_stage] ?? ev.to_stage}` : '—')}
              </p>
              <p className="text-[10px] text-slate-400">
                {timeAgo(ev.at)}
                {ev.source === 'officer' ? ' · officer' : ''}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* the grievance letter the farmer holds */}
      {e.letter_en && (
        <details className="mb-4">
          <summary className="text-xs font-semibold text-slate-500 cursor-pointer">
            Grievance letter (as sent by the farmer)
          </summary>
          <pre className="mt-2 whitespace-pre-wrap text-xs text-slate-600 bg-slate-50 border rounded-lg p-3">
            {e.letter_en}
          </pre>
        </details>
      )}

      {/* status controls */}
      <textarea
        value={note}
        onChange={(ev) => setNote(ev.target.value)}
        rows={2}
        placeholder="Note back to the farmer (shown on the claim)"
        className="w-full border rounded-lg px-3 py-2 text-sm mb-2"
      />
      <div className="grid grid-cols-2 gap-2">
        <button
          disabled={!!busy}
          onClick={() => setStatus('acknowledged')}
          className="py-2 text-sm border rounded-lg hover:bg-slate-50 disabled:opacity-40"
        >
          Acknowledge
        </button>
        <button
          disabled={!!busy}
          onClick={() => setStatus('in_progress')}
          className="py-2 text-sm border rounded-lg hover:bg-slate-50 disabled:opacity-40"
        >
          Working on it
        </button>
        <button
          disabled={!!busy}
          onClick={() => setStatus('closed')}
          className="py-2 text-sm border rounded-lg hover:bg-slate-50 disabled:opacity-40"
        >
          Close
        </button>
        <button
          disabled={!!busy}
          onClick={() => setStatus('resolved')}
          className="py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-40"
        >
          Resolved
        </button>
      </div>
    </motion.div>
  );
}

function Fact({ k, v }: { k: string; v: string | null | undefined }) {
  if (!v) return null;
  return (
    <p>
      <span className="text-slate-500">{k}:</span> {v}
    </p>
  );
}

// ── officer directory CMS ───────────────────────────────────────────────────

function Directory() {
  const list = useApi<{ contacts: DirectoryRow[] }>('/api/official/insurance-directory');
  const [editing, setEditing] = useState<Partial<DirectoryRow> | null>(null);

  const rows = list.data?.contacts ?? [];
  const groups = new Map<string, DirectoryRow[]>();
  for (const r of rows) {
    const g = r.district ?? 'Statewide / national';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(r);
  }

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-slate-500">
          Escalation contacts the farmer app routes to. Verify each row against the district
          agriculture office / portal before ticking it.
        </p>
        <button
          onClick={() => setEditing({ rung: 'district', verified: false })}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-agri-primary text-white rounded-lg"
        >
          <Plus size={15} /> Add contact
        </button>
      </div>

      {list.loading ? (
        <Loading />
      ) : list.error ? (
        <ErrorBox message={list.error} onRetry={list.reload} />
      ) : (
        <div className="space-y-6">
          {[...groups.entries()].map(([g, gr]) => (
            <div key={g}>
              <h3 className="text-sm font-semibold text-slate-600 mb-2">{g}</h3>
              <div className="bg-white rounded-xl border divide-y">
                {gr.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setEditing(r)}
                    className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-start gap-3"
                  >
                    <span
                      className={`mt-0.5 text-[10px] px-1.5 py-0.5 rounded uppercase font-semibold ${
                        r.verified ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {r.rung}
                    </span>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-slate-800">
                        {r.name ?? r.designation}
                      </div>
                      {r.name && (
                        <div className="text-xs text-slate-500">{r.designation}</div>
                      )}
                      <div className="text-xs text-slate-500 flex gap-3 mt-0.5 flex-wrap">
                        {r.phone && (
                          <span className="flex items-center gap-1">
                            <Phone size={11} />
                            {r.phone}
                          </span>
                        )}
                        {r.email && (
                          <span className="flex items-center gap-1">
                            <Mail size={11} />
                            {r.email}
                          </span>
                        )}
                        {r.url && (
                          <span className="flex items-center gap-1">
                            <ExternalLink size={11} />
                            link
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {r.verified ? `✓ ${r.last_verified ?? ''}` : 'unverified'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <DirectoryEditor
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            list.reload();
          }}
        />
      )}
    </>
  );
}

function DirectoryEditor({
  row,
  onClose,
  onSaved,
}: {
  row: Partial<DirectoryRow>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState<Partial<DirectoryRow>>(row);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof DirectoryRow, v: unknown) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    if (!f.designation?.trim() || !f.rung) return alert('Designation and rung are required');
    setBusy(true);
    try {
      await api.post('/api/official/insurance-directory', {
        id: f.id,
        district: f.district?.trim() || null,
        rung: f.rung,
        designation: f.designation.trim(),
        name: f.name?.trim() || null,
        office: f.office?.trim() || null,
        phone: f.phone?.trim() || null,
        email: f.email?.trim() || null,
        url: f.url?.trim() || null,
        note: f.note?.trim() || null,
        verified: !!f.verified,
      });
      onSaved();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  const Input = (k: keyof DirectoryRow, label: string, ph = '') => (
    <label className="block">
      <span className="text-xs text-slate-500">{label}</span>
      <input
        value={(f[k] as string) ?? ''}
        onChange={(e) => set(k, e.target.value)}
        placeholder={ph}
        className="w-full border rounded-lg px-3 py-2 text-sm mt-0.5"
      />
    </label>
  );

  return (
    <div className="fixed inset-0 bg-black/30 grid place-items-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-xl p-6 w-[520px] max-h-[85vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg">{f.id ? 'Edit contact' : 'Add contact'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {Input('district', 'District (blank = statewide/national)', 'Tiruvallur')}
          <label className="block">
            <span className="text-xs text-slate-500">Rung</span>
            <select
              value={f.rung ?? 'district'}
              onChange={(e) => set('rung', e.target.value as Rung)}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-0.5"
            >
              {(Object.keys(RUNG_LABEL) as Rung[]).map((r) => (
                <option key={r} value={r}>
                  {RUNG_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
          {Input('designation', 'Designation', 'Joint Director of Agriculture, Tiruvallur')}
          {Input('name', 'Officer name (optional)')}
          {Input('phone', 'Phone')}
          {Input('email', 'Email')}
        </div>
        {Input('office', 'Office address')}
        {Input('url', 'URL (district portal / grievance page)')}
        <label className="block mt-3">
          <span className="text-xs text-slate-500">Note (shown to the farmer)</span>
          <textarea
            value={f.note ?? ''}
            onChange={(e) => set('note', e.target.value)}
            rows={2}
            className="w-full border rounded-lg px-3 py-2 text-sm mt-0.5"
          />
        </label>
        <label className="flex items-center gap-2 mt-3 text-sm">
          <input
            type="checkbox"
            checked={!!f.verified}
            onChange={(e) => set('verified', e.target.checked)}
          />
          Verified against a public source (stamps today's date)
        </label>
        <button
          onClick={save}
          disabled={busy}
          className="mt-4 w-full py-2 bg-agri-primary text-white rounded-lg disabled:opacity-40"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tint,
}: {
  icon: typeof Umbrella;
  label: string;
  value: string | number;
  tint: string;
}) {
  const bg =
    tint === 'emerald'
      ? 'bg-emerald-50 text-emerald-600'
      : tint === 'amber'
        ? 'bg-amber-50 text-amber-600'
        : tint === 'blue'
          ? 'bg-blue-50 text-blue-600'
          : 'bg-slate-100 text-slate-600';
  return (
    <div className="bg-white rounded-xl border p-5">
      <div className={`w-10 h-10 rounded-lg grid place-items-center mb-3 ${bg}`}>
        <Icon size={20} />
      </div>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
    </div>
  );
}
