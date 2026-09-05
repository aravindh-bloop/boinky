import { motion } from 'framer-motion';
import { useState } from 'react';
import {
  Umbrella,
  ClipboardList,
  BadgeIndianRupee,
  ShieldCheck,
  Sparkles,
  Send,
  X,
} from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useApi } from '../lib/useApi';
import type {
  ClaimStatus,
  InsuranceClaimRow,
  InsuranceClaimDetail,
  InsuranceSummary,
} from '../lib/types';
import { Loading, ErrorBox, timeAgo } from '../components/ui';

const STATUS_STYLE: Record<ClaimStatus, string> = {
  submitted: 'bg-slate-100 text-slate-700',
  under_review: 'bg-amber-100 text-amber-700',
  surveyor_assigned: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  paid: 'bg-emerald-600 text-white',
};
const LABEL: Record<string, string> = {
  submitted: 'Submitted',
  under_review: 'Under review',
  surveyor_assigned: 'Surveyor assigned',
  approved: 'Approved',
  rejected: 'Rejected',
  paid: 'Paid',
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
  other: 'Other',
};
const rupee = (n: number | null | undefined) => (n == null ? '—' : '₹' + Math.round(n).toLocaleString('en-IN'));

export function Insurance() {
  const [statusFilter, setStatusFilter] = useState<ClaimStatus | ''>('');
  const summary = useApi<InsuranceSummary>('/api/official/insurance-summary');
  const claims = useApi<{ items: InsuranceClaimRow[] }>(
    `/api/official/insurance-claims${statusFilter ? `?status=${statusFilter}` : ''}`,
  );
  const [sel, setSel] = useState<string | null>(null);

  const refetch = () => {
    summary.reload();
    claims.reload();
  };
  const s = summary.data;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="p-8 h-[calc(100vh-80px)] overflow-auto"
    >
      <h2 className="text-2xl font-bold mb-6">Crop Insurance</h2>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <SummaryCard icon={BadgeIndianRupee} label="Paid out" value={rupee(s?.totalPaid)} tint="emerald" />
        <SummaryCard icon={ClipboardList} label="Pending review" value={s?.pendingReview ?? '—'} tint="amber" />
        <SummaryCard icon={ShieldCheck} label="Approved, not paid" value={s?.approvedNotPaid ?? '—'} tint="blue" />
        <SummaryCard icon={Umbrella} label="Active policies" value={s?.activePolicies ?? '—'} tint="slate" />
      </div>

      <div className="flex gap-6">
        <div className={sel ? 'w-3/5' : 'w-full'}>
          <div className="flex gap-2 mb-3 flex-wrap">
            {(['', 'submitted', 'under_review', 'surveyor_assigned', 'approved', 'paid', 'rejected'] as const).map(
              (st) => (
                <button
                  key={st || 'all'}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border ${
                    statusFilter === st
                      ? 'bg-agri-primary text-white border-transparent'
                      : 'bg-white text-slate-600'
                  }`}
                >
                  {st ? LABEL[st] : 'All'}
                </button>
              ),
            )}
          </div>

          {claims.loading ? (
            <Loading />
          ) : claims.error ? (
            <ErrorBox message={claims.error} onRetry={claims.reload} />
          ) : (
            <div className="bg-white rounded-xl border overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b text-slate-500">
                  <tr>
                    {['Farmer', 'Cause', 'Crop', 'Status', 'Payout', 'Updated'].map((h) => (
                      <th key={h} className="px-4 py-3 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(claims.data?.items ?? []).map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => setSel(c.id)}
                      className={`border-b hover:bg-slate-50 cursor-pointer ${sel === c.id ? 'bg-agri-primary/5' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{c.farmer_name}</div>
                        <div className="text-xs text-slate-500">
                          {c.district ?? c.region ?? c.farmer_phone}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {CAUSE[c.cause] ?? c.cause}
                        {c.has_assessment && (
                          <Sparkles size={12} className="inline ml-1 text-violet-500" />
                        )}
                      </td>
                      <td className="px-4 py-3 capitalize">{c.crop}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_STYLE[c.status]}`}>
                          {LABEL[c.status] ?? c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">{rupee(c.approved_amount)}</td>
                      <td className="px-4 py-3 text-slate-500">{timeAgo(c.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(claims.data?.items ?? []).length === 0 && (
                <div className="p-8 text-center text-slate-500">No claims.</div>
              )}
            </div>
          )}
        </div>

        {sel && (
          <ClaimPanel
            key={sel}
            claimId={sel}
            onClose={() => setSel(null)}
            onChange={refetch}
          />
        )}
      </div>
    </motion.div>
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

const PLAUS_STYLE: Record<string, string> = {
  consistent: 'bg-green-50 text-green-700 border-green-200',
  partly_consistent: 'bg-amber-50 text-amber-700 border-amber-200',
  inconsistent: 'bg-red-50 text-red-700 border-red-200',
  unclear: 'bg-slate-50 text-slate-600 border-slate-200',
};

function ClaimPanel({
  claimId,
  onClose,
  onChange,
}: {
  claimId: string;
  onClose: () => void;
  onChange: () => void;
}) {
  const { data, loading, reload } = useApi<InsuranceClaimDetail>(
    `/api/official/insurance-claims/${claimId}`,
  );
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('');
  const [loss, setLoss] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [active, setActive] = useState(0);

  if (loading || !data) {
    return (
      <div className="w-2/5 bg-white border rounded-xl p-5 h-fit sticky top-4">
        <Loading />
      </div>
    );
  }
  const { claim, media, events } = data;
  const ai = claim.ai_assessment;

  async function decide(status: ClaimStatus) {
    setBusy(status);
    try {
      await api.post(`/api/official/insurance-claims/${claimId}/decision`, {
        status,
        ...(note ? { note } : {}),
        ...(amount ? { approvedAmount: Number(amount) } : {}),
        ...(loss ? { assessedLossPct: Number(loss) } : {}),
      });
      setNote('');
      reload();
      onChange();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Failed');
    } finally {
      setBusy(null);
    }
  }

  async function sendMessage() {
    if (!msg.trim()) return;
    setBusy('msg');
    try {
      await api.post(`/api/official/insurance-claims/${claimId}/messages`, { body: msg });
      setMsg('');
      reload();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Failed');
    } finally {
      setBusy(null);
    }
  }

  const cur = media[Math.min(active, media.length - 1)];

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      className="w-2/5 bg-white border rounded-xl p-5 h-[calc(100vh-140px)] overflow-auto sticky top-4"
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-bold text-lg capitalize">
            {claim.crop} — {CAUSE[claim.cause] ?? claim.cause}
          </h3>
          <p className="text-sm text-slate-500">
            {claim.farmer_name} · {claim.district ?? claim.region ?? claim.farmer_phone}
          </p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
          <X size={18} />
        </button>
      </div>

      {/* evidence */}
      {media.length > 0 && cur && (
        <div className="mb-4">
          {cur.kind === 'video' ? (
            <video src={cur.url} controls className="w-full h-48 object-cover rounded-lg bg-black" />
          ) : (
            <img src={cur.url} alt="" className="w-full h-48 object-cover rounded-lg bg-slate-100" />
          )}
          {media.length > 1 && (
            <div className="flex gap-1.5 mt-2 overflow-x-auto">
              {media.map((m, i) => (
                <button
                  key={m.id}
                  onClick={() => setActive(i)}
                  className={`shrink-0 w-12 h-12 rounded overflow-hidden border-2 ${
                    i === active ? 'border-agri-primary' : 'border-transparent'
                  }`}
                >
                  <img src={m.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
          {cur.caption && <p className="text-xs text-slate-500 mt-1">{cur.caption}</p>}
        </div>
      )}

      <div className="text-sm space-y-2 mb-4">
        <p>
          <span className="text-slate-500">Incident:</span>{' '}
          {claim.incident_date ?? '—'} · <span className="text-slate-500">Season:</span> {claim.season}
        </p>
        <p>
          <span className="text-slate-500">Sum insured:</span> {rupee(claim.sum_insured)} ·{' '}
          <span className="text-slate-500">Farmer's estimate:</span>{' '}
          {claim.estimated_loss_pct != null ? `${claim.estimated_loss_pct}%` : '—'}
        </p>
        {claim.description && (
          <div className="p-3 bg-slate-50 rounded-lg border">
            <p className="text-xs text-slate-500 mb-1">Farmer's description</p>
            {claim.description}
          </div>
        )}
        {claim.scan_diagnosis && (
          <p>
            <span className="text-slate-500">Linked scan:</span> {claim.scan_diagnosis}
          </p>
        )}
      </div>

      {/* AI draft assessment */}
      {ai && (
        <div className="mb-4 rounded-lg border border-violet-200 bg-violet-50/60 p-3">
          <p className="text-xs font-semibold text-violet-700 flex items-center gap-1 mb-1">
            <Sparkles size={12} /> AI draft assessment — an aid, not a decision
          </p>
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs px-2 py-0.5 rounded border ${PLAUS_STYLE[ai.causePlausible]}`}>
              cause {ai.causePlausible.replace('_', ' ')}
            </span>
            {ai.estimatedLossPct != null && (
              <span className="text-xs text-slate-600">~{ai.estimatedLossPct}% loss</span>
            )}
            {ai.cropVisible && <span className="text-xs text-slate-500">crop seen: {ai.cropVisible}</span>}
          </div>
          <p className="text-sm text-slate-700">{ai.rationale}</p>
          {ai.notes.length > 0 && (
            <ul className="text-xs text-slate-600 list-disc pl-4 mt-1 space-y-0.5">
              {ai.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* decision */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        <input
          value={loss}
          onChange={(e) => setLoss(e.target.value.replace(/[^\d]/g, ''))}
          placeholder="Assessed loss %"
          inputMode="numeric"
          className="border rounded-lg px-3 py-2 text-sm"
        />
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
          placeholder="Payout ₹"
          inputMode="numeric"
          className="border rounded-lg px-3 py-2 text-sm"
        />
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="Note to the farmer (shown on the claim)"
        className="w-full border rounded-lg px-3 py-2 text-sm mb-2"
      />
      <div className="grid grid-cols-2 gap-2 mb-4">
        <button
          disabled={!!busy}
          onClick={() => decide('under_review')}
          className="py-2 text-sm border rounded-lg hover:bg-slate-50 disabled:opacity-40"
        >
          Under review
        </button>
        <button
          disabled={!!busy}
          onClick={() => decide('surveyor_assigned')}
          className="py-2 text-sm border rounded-lg hover:bg-slate-50 disabled:opacity-40"
        >
          Assign surveyor
        </button>
        <button
          disabled={!!busy}
          onClick={() => decide('rejected')}
          className="py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-40"
        >
          Reject
        </button>
        <button
          disabled={!!busy || !amount}
          onClick={() => decide(claim.status === 'approved' ? 'paid' : 'approved')}
          className="py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-40"
        >
          {claim.status === 'approved' ? 'Mark paid' : 'Approve'}
        </button>
      </div>

      {/* timeline + conversation */}
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Progress</p>
      <div className="space-y-2 mb-3">
        {events.map((e) =>
          e.kind === 'message' ? (
            <div key={e.id} className={`flex ${e.actor_role === 'official' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                  e.actor_role === 'official' ? 'bg-agri-primary text-white' : 'bg-slate-100 text-slate-800'
                }`}
              >
                {e.body}
              </div>
            </div>
          ) : (
            <div key={e.id} className="flex gap-2 text-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-agri-primary mt-2 shrink-0" />
              <div>
                <span className="font-medium">
                  {e.to_status ? LABEL[e.to_status] ?? e.to_status : 'Update'}
                </span>
                {e.body && <p className="text-slate-500">{e.body}</p>}
                <p className="text-[10px] text-slate-400">{timeAgo(e.created_at)}</p>
              </div>
            </div>
          ),
        )}
      </div>
      <div className="flex gap-2">
        <input
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Message the farmer…"
          className="flex-1 border rounded-lg px-3 py-2 text-sm"
        />
        <button
          onClick={sendMessage}
          disabled={busy === 'msg' || !msg.trim()}
          className="px-3 bg-agri-primary text-white rounded-lg disabled:opacity-40"
        >
          <Send size={16} />
        </button>
      </div>
    </motion.div>
  );
}
