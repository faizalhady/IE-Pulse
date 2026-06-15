/**
 * FsmsSubmissions.tsx — the combined Submissions surface (no tabs).
 * ──────────────────────────────────────────────────────────────────────────────
 * One page = the whole upload → request → status lifecycle:
 *   • Requests table (hub) with a filter segment (All / Pending / Awaiting my
 *     approval / Mine)
 *   • "New upload" → side sheet (SubmissionUpload)
 *   • Row click → detail drawer (SubmissionDetail: stepper + approvals + actions)
 * Mock-backed; mutations live in local state (upload appends, approve advances &
 * auto-promotes, reject/reset transition status). Real API/SSO wires in later.
 *
 * Route: /fsms/submissions
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import {
  isGated, KIND_BADGE, MOCK_CURRENT_USER, MOCK_SUBMISSIONS, nextSubmissionId,
  requiredRolesFor, STATUS_BADGE, statusLabel, type Submission,
} from '@/pages/fsms/mockSubmissionsData';
import SubmissionDetail from '@/pages/fsms/SubmissionDetail';
import SubmissionUpload from '@/pages/fsms/SubmissionUpload';
import type { UploadKind, UserRole } from '@/types/fsms';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

const fmt = (iso: string) => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const approvedCount = (s: Submission) => s.approvals.filter(a => a.decision === 'Approved').length;

type Filter = 'all' | 'Pending' | 'Approved' | 'Rejected' | 'approve';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'Pending', label: 'Pending' },
  { key: 'Approved', label: 'Approved' },
  { key: 'Rejected', label: 'Rejected' },
];

export default function FsmsSubmissions() {
  const me = MOCK_CURRENT_USER;
  const [subs, setSubs] = useState<Submission[]>(MOCK_SUBMISSIONS);
  const [filter, setFilter] = useState<Filter>('all');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = subs.find(s => s.id === selectedId) ?? null;
  const restageOptions = useMemo(
    () => subs.filter(s => s.kind === 'CONSO' && (s.status === 'Pending' || s.status === 'Rejected')),
    [subs],
  );

  const needsMyApproval = (s: Submission) => {
    if (!isGated(s.kind) || s.status !== 'Pending') return false;
    const approved = new Set(s.approvals.filter(a => a.decision === 'Approved').map(a => a.role));
    return me.roles.some(r => requiredRolesFor(s.kind).includes(r) && !approved.has(r));
  };

  const needApprovalCount = useMemo(
    () => subs.filter(needsMyApproval).length,
    [subs, me], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const rows = useMemo(() => subs.filter(s => {
    if (filter === 'all') return true;
    if (filter === 'approve') return needsMyApproval(s);
    return s.status === filter;
  }), [subs, filter, me]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── mutations (mock) ──────────────────────────────────────────────────────────
  const handleCreate = (input: { kind: UploadKind; filename: string; period_date: string; plants: string[]; restageId?: string }) => {
    const now = new Date().toISOString();
    if (input.restageId) {
      setSubs(prev => prev.map(s => s.id === input.restageId
        ? { ...s, filename: input.filename, period_date: input.period_date, plants: input.plants, approvals: [], status: 'Pending', created_at: now, status_at: now }
        : s));
      setSelectedId(input.restageId);
      toast.success(`Re-staged into batch #${input.restageId}`);
      return;
    }
    const id = nextSubmissionId();
    const gated = isGated(input.kind);
    const sub: Submission = {
      id, kind: input.kind, filename: input.filename, period_date: input.period_date, plants: input.plants,
      uploader_id: me.nameid, uploader_name: me.name,
      status: gated ? 'Pending' : 'Approved', created_at: now, status_at: now, approvals: [],
      summary: gated ? null : { label: input.kind === 'REVENUE' ? 'revenue rows' : input.kind === 'PRISM' ? 'forecast rows' : 'rate rows', rows: input.kind === 'REVENUE' ? 312 : input.kind === 'PRISM' ? 540 : 4 },
    };
    setSubs(prev => [sub, ...prev]);
    setSelectedId(id);
    toast.success(gated ? `Staged as batch #${id} for approval` : `${input.kind} imported`);
  };

  const handleDecision = (role: UserRole, decision: 'Approved' | 'Rejected', comment: string) => {
    const now = new Date().toISOString();
    setSubs(prev => prev.map(s => {
      if (s.id !== selectedId) return s;
      const approvals = [...s.approvals.filter(a => a.role !== role), { batch_id: s.id, approver_id: me.name, role, decision, decided_at: now, comment: comment || null }];
      let status = s.status;
      if (decision === 'Rejected') status = 'Rejected';
      else {
        const approved = new Set(approvals.filter(a => a.decision === 'Approved').map(a => a.role));
        status = requiredRolesFor(s.kind).every(r => approved.has(r)) ? 'Approved' : 'Pending';
      }
      return { ...s, approvals, status, status_at: now };
    }));
    if (decision === 'Approved') {
      const s = subs.find(x => x.id === selectedId);
      const willComplete = s && requiredRolesFor(s.kind).every(r => r === role || s.approvals.some(a => a.role === r && a.decision === 'Approved'));
      toast.success(willComplete ? `All approved — batch auto-promoted to live` : `Approved as ${role}`);
    } else {
      toast.error(`Rejected as ${role}`);
    }
  };

  const handleReset = () => {
    const now = new Date().toISOString();
    setSubs(prev => prev.map(s => s.id === selectedId ? { ...s, approvals: [], status: 'Pending', status_at: now } : s));
    toast.success('Batch reset to Pending');
  };

  return (
    <div className="min-h-screen">
      {/* header */}
      <div className="sticky top-0 z-20 bg-background border-b border-border px-5 pt-4 pb-3">
        <h1 className="text-xl font-semibold text-foreground">Submissions</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Upload, request, and track approvals — one pipeline.</p>
      </div>

      <div className="p-5 space-y-4">
        {/* filter segment */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 rounded-lg border border-border p-0.5">
            {FILTERS.map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  filter === f.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
                {f.label}
              </button>
            ))}
          </div>

          {/* Needs My Approval — standalone filter with notification badge */}
          <button onClick={() => setFilter('approve')}
            className={cn('relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors',
              filter === 'approve' ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground')}>
            Needs My Approval
            {needApprovalCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold leading-none">
                {needApprovalCount}
              </span>
            )}
          </button>

          <Button onClick={() => setUploadOpen(true)} className="gap-1.5 ml-auto"><Plus className="h-4 w-4" /> New upload</Button>
        </div>

        {/* requests table */}
        <div className="rounded-xl border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead>
              <tr className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wider">
                <th className="text-left font-medium px-4 py-3">File</th>
                <th className="text-left font-medium px-4 py-3">Period</th>
                <th className="text-left font-medium px-4 py-3">Plants</th>
                <th className="text-left font-medium px-4 py-3">Uploaded</th>
                <th className="text-center font-medium px-4 py-3">Approvals</th>
                <th className="text-center font-medium px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(s => {
                const req = requiredRolesFor(s.kind);
                return (
                  <tr key={s.id} onClick={() => setSelectedId(s.id)}
                    className="h-14 border-b border-border last:border-0 hover:bg-muted/40 cursor-pointer">
                    <td className="px-4">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn('text-[10px] font-semibold', KIND_BADGE[s.kind])}>{s.kind}</Badge>
                        <span className="font-medium text-foreground truncate max-w-[280px]">{s.filename}</span>
                        <span className="text-xs text-muted-foreground">#{s.id}</span>
                      </div>
                    </td>
                    <td className="px-4 font-mono text-xs text-muted-foreground">{s.period_date}</td>
                    <td className="px-4 text-xs text-muted-foreground">{s.plants.join(', ') || '—'}</td>
                    <td className="px-4 text-xs text-muted-foreground">{s.uploader_name} · {fmt(s.created_at)}</td>
                    <td className="px-4 text-center font-mono text-xs">
                      {req.length > 0
                        ? <span className={cn(approvedCount(s) === req.length ? 'text-emerald-400' : 'text-muted-foreground')}>{approvedCount(s)}/{req.length}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 text-center">
                      <Badge variant="outline" className={cn('text-[10px] font-semibold', STATUS_BADGE[s.status])}>{statusLabel(s)}</Badge>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">No submissions match this filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* upload sheet */}
      <Sheet open={uploadOpen} onOpenChange={setUploadOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>New upload</SheetTitle>
            <SheetDescription>Upload a file and stage it into the pipeline.</SheetDescription>
          </SheetHeader>
          <div className="mt-5">
            <SubmissionUpload onCreate={handleCreate} restageOptions={restageOptions} onClose={() => setUploadOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      {/* detail drawer */}
      <Sheet open={!!selected} onOpenChange={o => { if (!o) setSelectedId(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>Submission #{selected.id}</SheetTitle>
                <SheetDescription>{selected.kind} · {statusLabel(selected)}</SheetDescription>
              </SheetHeader>
              <div className="mt-5">
                <SubmissionDetail key={selected.id} submission={selected} currentUser={me} onDecision={handleDecision} onReset={handleReset} />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
