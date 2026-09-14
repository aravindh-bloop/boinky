import { motion } from 'framer-motion';
import { useState } from 'react';
import { toast } from 'sonner';
import { IndianRupee, ClipboardList, CheckCircle2, MessagesSquare, Send, X, HandCoins } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useApi } from '../lib/useApi';
import type {
  AppStatus,
  SchemeApplication,
  SchemeSummary,
  SchemeThread,
  SchemeMessage,
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
  Textarea,
  Input,
  EmptyState,
  type Tone,
  type Column,
} from '../components/ui';
import { rupee, timeAgo } from '../lib/format';

const STATUS_TONE: Record<AppStatus, Tone> = {
  submitted: 'neutral',
  under_review: 'info',
  approved: 'success',
  rejected: 'danger',
  disbursed: 'success',
};
const STATUS_LABEL: Record<AppStatus, string> = {
  submitted: 'Submitted',
  under_review: 'Under review',
  approved: 'Approved',
  rejected: 'Rejected',
  disbursed: 'Disbursed',
};

export function Subsidies() {
  const [tab, setTab] = useState<'applications' | 'queries'>('applications');
  const [statusFilter, setStatusFilter] = useState<AppStatus | ''>('');
  const summary = useApi<SchemeSummary>('/api/official/scheme-summary');
  const apps = useApi<{ items: SchemeApplication[] }>(
    `/api/official/scheme-applications${statusFilter ? `?status=${statusFilter}` : ''}`,
  );
  const threads = useApi<{ threads: SchemeThread[] }>('/api/official/scheme-threads');

  const [sel, setSel] = useState<SchemeApplication | null>(null);
  const [selThread, setSelThread] = useState<string | null>(null);

  const refetchAll = () => {
    summary.reload();
    apps.reload();
    threads.reload();
  };

  const s = summary.data;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="p-8 h-[calc(100vh-80px)] overflow-auto"
    >
      <PageHeader icon={HandCoins} title="Subsidies & Schemes" subtitle="Applications, disbursements and farmer queries" />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard icon={IndianRupee} label="Total disbursed" value={s ? rupee(s.totalDisbursed) : '—'} tone="accent" />
        <StatCard icon={ClipboardList} label="Pending review" value={s?.pendingReview ?? '—'} />
        <StatCard icon={CheckCircle2} label="Approved, not paid" value={s?.approvedNotDisbursed ?? '—'} />
        <StatCard icon={MessagesSquare} label="Open queries" value={s?.openQueries ?? '—'} />
      </div>

      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 mb-4 w-fit">
        {(['applications', 'queries'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition ${
              tab === t ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'
            }`}
          >
            {t}
            {t === 'queries' && s?.openQueries ? ` (${s.openQueries})` : ''}
          </button>
        ))}
      </div>

      {tab === 'applications' ? (
        <div className="flex gap-6">
          <div className={sel ? 'w-2/3' : 'w-full'}>
            <div className="flex gap-2 mb-3 flex-wrap">
              {(['', 'submitted', 'under_review', 'approved', 'disbursed', 'rejected'] as const).map((st) => (
                <FilterPill key={st || 'all'} active={statusFilter === st} onClick={() => setStatusFilter(st)}>
                  {st ? STATUS_LABEL[st] : 'All'}
                </FilterPill>
              ))}
            </div>
            {apps.error ? (
              <ErrorBox message={apps.error} onRetry={apps.reload} />
            ) : (
              <DataTable<SchemeApplication>
                loading={apps.loading}
                rows={apps.data?.items ?? []}
                keyField="id"
                selectedKey={sel?.id}
                onRowClick={setSel}
                emptyState={<EmptyState icon={ClipboardList} title="No applications" />}
                columns={
                  [
                    {
                      key: 'farmer',
                      header: 'Farmer',
                      render: (a) => (
                        <>
                          <div className="font-medium text-slate-800">{a.farmer_name}</div>
                          <div className="text-xs text-slate-500">{a.farmer_phone ?? a.region}</div>
                        </>
                      ),
                    },
                    { key: 'scheme', header: 'Scheme', render: (a) => a.scheme_title },
                    { key: 'status', header: 'Status', render: (a) => <Badge tone={STATUS_TONE[a.status]}>{STATUS_LABEL[a.status]}</Badge> },
                    { key: 'amount', header: 'Amount', render: (a) => (a.amount != null ? rupee(a.amount) : '—') },
                    { key: 'updated', header: 'Updated', render: (a) => <span className="text-slate-500">{timeAgo(a.updated_at)}</span> },
                  ] satisfies Column<SchemeApplication>[]
                }
              />
            )}
          </div>

          {sel && (
            <DecisionPanel
              app={sel}
              onClose={() => setSel(null)}
              onDone={() => {
                setSel(null);
                refetchAll();
              }}
            />
          )}
        </div>
      ) : (
        <div className="flex gap-6">
          <div className={selThread ? 'w-1/2' : 'w-full'}>
            {threads.loading ? (
              <Loading />
            ) : (threads.data?.threads ?? []).length === 0 ? (
              <Card>
                <EmptyState icon={MessagesSquare} title="No questions from farmers yet" />
              </Card>
            ) : (
              <div className="space-y-2">
                {(threads.data?.threads ?? []).map((t) => (
                  <Card
                    key={t.id}
                    padding="md"
                    interactive
                    onClick={() => setSelThread(t.id)}
                    className={selThread === t.id ? 'border-agri-primary' : ''}
                  >
                    <div className="flex justify-between items-start gap-3">
                      <span className="font-semibold text-slate-800">{t.subject}</span>
                      <Badge tone={t.status === 'open' ? 'danger' : t.status === 'answered' ? 'success' : 'neutral'}>
                        {t.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                      {t.farmer_name}
                      {t.scheme_title ? ` · ${t.scheme_title}` : ''} · {timeAgo(t.last_message_at)}
                    </p>
                    {t.last_message && (
                      <p className="text-sm text-slate-600 mt-2 line-clamp-1">
                        {t.last_sender === 'official' ? 'You: ' : ''}
                        {t.last_message}
                      </p>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>

          {selThread && (
            <ThreadPanel key={selThread} threadId={selThread} onClose={() => setSelThread(null)} onReply={refetchAll} />
          )}
        </div>
      )}
    </motion.div>
  );
}

function DecisionPanel({
  app,
  onClose,
  onDone,
}: {
  app: SchemeApplication;
  onClose: () => void;
  onDone: () => void;
}) {
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  async function decide(status: 'under_review' | 'approved' | 'rejected' | 'disbursed') {
    setBusy(status);
    try {
      await api.post(`/api/official/scheme-applications/${app.id}/decision`, {
        status,
        ...(note ? { note } : {}),
        ...(status === 'disbursed' ? { amount: Number(amount) } : {}),
      });
      toast.success(`Marked ${STATUS_LABEL[status].toLowerCase()}`);
      onDone();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} className="w-1/3 h-fit sticky top-4">
      <Card>
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="font-bold text-lg text-slate-800">{app.scheme_title}</h3>
            <p className="text-sm text-slate-500">
              {app.farmer_name} · {app.farmer_phone ?? app.region}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>

        <div className="text-sm space-y-2 mb-4">
          <p>
            <span className="text-slate-500">Indicative benefit:</span> {app.benefit_amount ?? '—'}
          </p>
          {app.farmer_note && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <p className="text-xs text-slate-500 mb-1">Farmer's note</p>
              {app.farmer_note}
            </div>
          )}
          {app.officer_note && (
            <div className="p-3 bg-status-warning-bg rounded-lg border border-amber-100">
              <p className="text-xs text-slate-500 mb-1">Last officer note</p>
              {app.officer_note}
            </div>
          )}
          <p>
            <span className="text-slate-500">Current status:</span> {STATUS_LABEL[app.status]}
            {app.amount != null && ` · ${rupee(app.amount)}`}
          </p>
        </div>

        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Note / reason (shown to the farmer)" className="mb-3" />
        <Input
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
          placeholder="Amount to disburse (₹)"
          inputMode="numeric"
          className="mb-3"
        />

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" disabled={!!busy || app.status === 'disbursed'} onClick={() => decide('under_review')}>
            Under review
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!!busy || app.status === 'disbursed'}
            onClick={() => decide('approved')}
            className="border-status-success/30 text-status-success hover:bg-status-success-bg"
          >
            Approve
          </Button>
          <Button variant="danger" size="sm" disabled={!!busy} onClick={() => decide('rejected')}>
            Reject
          </Button>
          <Button variant="primary" size="sm" disabled={!!busy || !amount} onClick={() => decide('disbursed')}>
            Mark disbursed
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}

function ThreadPanel({
  threadId,
  onClose,
  onReply,
}: {
  threadId: string;
  onClose: () => void;
  onReply: () => void;
}) {
  const { data, loading, reload } = useApi<{ thread: SchemeThread; messages: SchemeMessage[] }>(
    `/api/official/scheme-threads/${threadId}`,
  );
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!msg.trim()) return;
    setBusy(true);
    try {
      await api.post(`/api/official/scheme-threads/${threadId}/messages`, { body: msg });
      setMsg('');
      reload();
      onReply();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to send');
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      className="w-1/2 bg-white border border-slate-200/70 rounded-[var(--radius-card)] shadow-[var(--shadow-card)] flex flex-col h-[calc(100vh-220px)]"
    >
      <div className="p-4 border-b border-slate-100 flex justify-between items-start">
        <div>
          <h3 className="font-bold text-slate-800">{data?.thread.subject ?? 'Conversation'}</h3>
          <p className="text-xs text-slate-500">
            {data?.thread.farmer_name}
            {data?.thread.scheme_title ? ` · ${data.thread.scheme_title}` : ''}
          </p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-3">
        {loading ? (
          <Loading />
        ) : (
          (data?.messages ?? []).map((m) => (
            <div key={m.id} className={`flex ${m.sender_role === 'official' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                  m.sender_role === 'official' ? 'bg-agri-primary text-white' : 'bg-slate-100 text-slate-800'
                }`}
              >
                {m.body}
                <div className={`text-[10px] mt-1 ${m.sender_role === 'official' ? 'text-white/70' : 'text-slate-400'}`}>
                  {timeAgo(m.created_at)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-3 border-t border-slate-100 flex gap-2">
        <Input value={msg} onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Type a reply…" className="flex-1" />
        <Button size="md" icon={Send} onClick={send} disabled={busy || !msg.trim()} className="px-3" />
      </div>
    </motion.div>
  );
}
