import { motion } from 'framer-motion';
import { useState } from 'react';
import { toast } from 'sonner';
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
import {
  Loading,
  ErrorBox,
  StatCard,
  DataTable,
  Badge,
  Card,
  Button,
  PageHeader,
  FilterPill,
  Input,
  Textarea,
  Select,
  EmptyState,
  type Tone,
  type Column,
} from '../components/ui';
import { timeAgo } from '../lib/format';

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
const STATUS_TONE: Record<EscalationStatus, Tone> = {
  sent: 'warning',
  acknowledged: 'info',
  in_progress: 'info',
  resolved: 'success',
  closed: 'neutral',
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
      <PageHeader
        icon={Umbrella}
        title="Crop Insurance — claim tracker"
        subtitle="PMFBY claims stuck in the pipeline, escalated to the right desk"
        action={
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
            {(['inbox', 'directory'] as const).map((k) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
                  tab === k ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'
                }`}
              >
                {k === 'inbox' ? 'Escalations' : 'Officer directory'}
              </button>
            ))}
          </div>
        }
      />

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
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard icon={ShieldAlert} label="Open" value={s?.open ?? '—'} />
        <StatCard icon={ClipboardList} label="In progress" value={s?.byStatus?.in_progress ?? 0} />
        <StatCard icon={CheckCircle2} label="Resolved" value={s?.resolved ?? '—'} tone="accent" />
        <StatCard
          icon={Umbrella}
          label="Top rung"
          value={s?.byRung?.[0] ? RUNG_LABEL[s.byRung[0].rung as Rung] ?? s.byRung[0].rung : '—'}
        />
      </div>

      <div className="flex gap-6">
        <div className={sel ? 'w-3/5' : 'w-full'}>
          <div className="flex gap-2 mb-3 flex-wrap">
            {(['', 'sent', 'acknowledged', 'in_progress', 'resolved', 'closed'] as const).map((st) => (
              <FilterPill key={st || 'all'} active={statusFilter === st} onClick={() => setStatusFilter(st)}>
                {st ? st.replace('_', ' ') : 'All'}
              </FilterPill>
            ))}
          </div>

          {list.error ? (
            <ErrorBox message={list.error} onRetry={list.reload} />
          ) : (
            <DataTable<EscalationRow>
              loading={list.loading}
              rows={list.data?.items ?? []}
              keyField="id"
              selectedKey={sel}
              onRowClick={(e) => setSel(e.id)}
              emptyState={<EmptyState icon={ShieldAlert} title="No escalations" />}
              columns={
                [
                  {
                    key: 'farmer',
                    header: 'Farmer',
                    render: (e) => (
                      <>
                        <div className="font-medium text-slate-800">{e.farmer_name}</div>
                        <div className="text-xs text-slate-500">{e.district ?? e.farmer_phone}</div>
                      </>
                    ),
                  },
                  {
                    key: 'claim',
                    header: 'Claim',
                    render: (e) => (
                      <>
                        <div className="capitalize">
                          {CAUSE[e.cause] ?? e.cause} · {e.crop}
                        </div>
                        <div className="text-xs text-slate-500">stuck at {STAGE_LABEL[e.stage] ?? e.stage}</div>
                      </>
                    ),
                  },
                  { key: 'rung', header: 'Escalated to', render: (e) => <span className="text-slate-700">{RUNG_LABEL[e.rung] ?? e.rung}</span> },
                  { key: 'status', header: 'Status', render: (e) => <Badge tone={STATUS_TONE[e.status]}>{e.status.replace('_', ' ')}</Badge> },
                  { key: 'age', header: 'Age', render: (e) => <span className="text-slate-500">{timeAgo(e.created_at)}</span> },
                ] satisfies Column<EscalationRow>[]
              }
            />
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
      <div className="w-2/5 h-fit sticky top-4">
        <Card>
          <Loading />
        </Card>
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
      toast.success('Status updated');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      className="w-2/5 h-[calc(100vh-140px)] sticky top-4"
    >
      <Card className="h-full overflow-auto">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="font-bold text-lg capitalize text-slate-800">
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

        <div className="rounded-lg border border-amber-200 bg-status-warning-bg/60 p-3 mb-4 text-sm">
          <p className="text-xs font-semibold text-status-warning mb-1">
            Escalated to {RUNG_LABEL[e.rung] ?? e.rung} · via {e.channel}
          </p>
          <p className="text-slate-700">{e.reason}</p>
          {e.external_ref && <p className="text-xs text-slate-500 mt-1">Ref: {e.external_ref}</p>}
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

        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Farmer's timeline</p>
        <div className="space-y-2 mb-4">
          {data.events.map((ev, i) => (
            <div key={i} className="flex gap-2 text-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-agri-primary mt-2 shrink-0" />
              <div>
                <p className="text-slate-700">
                  {ev.body ?? (ev.to_stage ? `Moved to ${STAGE_LABEL[ev.to_stage] ?? ev.to_stage}` : '—')}
                </p>
                <p className="text-[10px] text-slate-400">
                  {timeAgo(ev.at)}
                  {ev.source === 'officer' ? ' · officer' : ''}
                </p>
              </div>
            </div>
          ))}
        </div>

        {e.letter_en && (
          <details className="mb-4">
            <summary className="text-xs font-semibold text-slate-500 cursor-pointer">
              Grievance letter (as sent by the farmer)
            </summary>
            <pre className="mt-2 whitespace-pre-wrap text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-lg p-3">
              {e.letter_en}
            </pre>
          </details>
        )}

        <Textarea value={note} onChange={(ev) => setNote(ev.target.value)} rows={2} placeholder="Note back to the farmer (shown on the claim)" className="mb-2" />
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" disabled={!!busy} onClick={() => setStatus('acknowledged')}>
            Acknowledge
          </Button>
          <Button variant="outline" size="sm" disabled={!!busy} onClick={() => setStatus('in_progress')}>
            Working on it
          </Button>
          <Button variant="outline" size="sm" disabled={!!busy} onClick={() => setStatus('closed')}>
            Close
          </Button>
          <Button variant="primary" size="sm" disabled={!!busy} onClick={() => setStatus('resolved')}>
            Resolved
          </Button>
        </div>
      </Card>
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
      <div className="flex justify-between items-center mb-4 gap-4">
        <p className="text-sm text-slate-500">
          Escalation contacts the farmer app routes to. Verify each row against the district agriculture
          office / portal before ticking it.
        </p>
        <Button icon={Plus} onClick={() => setEditing({ rung: 'district', verified: false })} className="shrink-0">
          Add contact
        </Button>
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
              <Card padding="sm" className="divide-y divide-slate-100">
                {gr.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setEditing(r)}
                    className="w-full text-left px-3 py-3 hover:bg-slate-50 flex items-start gap-3 first:pt-0 last:pb-0"
                  >
                    <span className="mt-0.5 shrink-0">
                      <Badge tone={r.verified ? 'success' : 'neutral'}>{r.rung}</Badge>
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-800">{r.name ?? r.designation}</div>
                      {r.name && <div className="text-xs text-slate-500">{r.designation}</div>}
                      <div className="text-xs text-slate-500 flex gap-3 mt-0.5 flex-wrap">
                        {r.phone && (
                          <span className="flex items-center gap-1">
                            <Phone size={11} /> {r.phone}
                          </span>
                        )}
                        {r.email && (
                          <span className="flex items-center gap-1">
                            <Mail size={11} /> {r.email}
                          </span>
                        )}
                        {r.url && (
                          <span className="flex items-center gap-1">
                            <ExternalLink size={11} /> link
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {r.verified ? `✓ ${r.last_verified ?? ''}` : 'unverified'}
                    </span>
                  </button>
                ))}
              </Card>
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
    if (!f.designation?.trim() || !f.rung) return toast.error('Designation and rung are required');
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
      toast.success('Contact saved');
      onSaved();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  const field = (k: keyof DirectoryRow, label: string, ph = '') => (
    <Input key={k} label={label} value={(f[k] as string) ?? ''} onChange={(e) => set(k, e.target.value)} placeholder={ph} />
  );

  return (
    <div className="fixed inset-0 bg-black/30 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="w-full max-w-[520px] max-h-[85vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <Card>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg text-slate-800">{f.id ? 'Edit contact' : 'Add contact'}</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
              <X size={18} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field('district', 'District (blank = statewide/national)', 'Tiruvallur')}
            <Select label="Rung" value={f.rung ?? 'district'} onChange={(e) => set('rung', e.target.value as Rung)}>
              {(Object.keys(RUNG_LABEL) as Rung[]).map((r) => (
                <option key={r} value={r}>
                  {RUNG_LABEL[r]}
                </option>
              ))}
            </Select>
            {field('designation', 'Designation', 'Joint Director of Agriculture, Tiruvallur')}
            {field('name', 'Officer name (optional)')}
            {field('phone', 'Phone')}
            {field('email', 'Email')}
          </div>
          <div className="mt-3">{field('office', 'Office address')}</div>
          <div className="mt-3">{field('url', 'URL (district portal / grievance page)')}</div>
          <div className="mt-3">
            <Textarea label="Note (shown to the farmer)" value={f.note ?? ''} onChange={(e) => set('note', e.target.value)} rows={2} />
          </div>
          <label className="flex items-center gap-2 mt-3 text-sm">
            <input type="checkbox" checked={!!f.verified} onChange={(e) => set('verified', e.target.checked)} />
            Verified against a public source (stamps today's date)
          </label>
          <Button onClick={save} loading={busy} className="mt-4 w-full">
            Save
          </Button>
        </Card>
      </div>
    </div>
  );
}
