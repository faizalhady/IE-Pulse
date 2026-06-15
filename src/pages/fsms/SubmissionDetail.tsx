/**
 * SubmissionDetail.tsx — content of the Submissions detail drawer.
 * Shows the lifecycle stepper (Uploaded → 4 approvers → Promoted), the approval
 * records, and role-aware Approve / Reject / Reset actions. Mock auth (acts on
 * behalf of any required role for the demo). Direct imports show a parse summary.
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  isGated, KIND_BADGE, requiredRolesFor, STATUS_BADGE, statusLabel,
  type CurrentUser, type Submission,
} from '@/pages/fsms/mockSubmissionsData';
import type { TimelineStep, UserRole } from '@/types/fsms';
import { Check, Clock, Download, FileSpreadsheet, RotateCcw, X } from 'lucide-react';
import { useState } from 'react';

const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

function buildTimeline(s: Submission): TimelineStep[] {
  const steps: TimelineStep[] = [{ label: 'Uploaded', state: 'done', actor: s.uploader_name, at: s.created_at }];
  const req = requiredRolesFor(s.kind);
  if (req.length === 0) {
    steps.push({ label: 'Imported', state: s.status === 'Approved' ? 'done' : 'current', at: s.status_at });
    return steps;
  }
  const rejected = s.status === 'Rejected';
  let currentSet = false;
  for (const role of req) {
    const a = s.approvals.find(x => x.role === role);
    if (a?.decision === 'Approved') steps.push({ label: role, state: 'done', actor: a.approver_id, at: a.decided_at, comment: a.comment ?? undefined });
    else if (a?.decision === 'Rejected') steps.push({ label: role, state: 'rejected', actor: a.approver_id, at: a.decided_at, comment: a.comment ?? undefined });
    else if (rejected) steps.push({ label: role, state: 'skipped' });
    else if (!currentSet) { steps.push({ label: role, state: 'current' }); currentSet = true; }
    else steps.push({ label: role, state: 'waiting' });
  }
  steps.push({ label: s.status === 'Approved' ? 'Promoted' : rejected ? 'Rejected' : 'Promote', state: s.status === 'Approved' ? 'done' : rejected ? 'rejected' : 'waiting' });
  return steps;
}

const NODE: Record<TimelineStep['state'], string> = {
  done:     'bg-emerald-500/20 border-emerald-500 text-emerald-400',
  current:  'border-primary text-primary ring-2 ring-primary/30',
  rejected: 'bg-red-500/20 border-red-500 text-red-400',
  waiting:  'border-border text-muted-foreground',
  skipped:  'border-dashed border-border text-muted-foreground/60',
};
const nodeIcon = (st: TimelineStep['state']) =>
  st === 'done' ? <Check className="h-3.5 w-3.5" /> : st === 'rejected' ? <X className="h-3.5 w-3.5" /> : st === 'current' ? <Clock className="h-3.5 w-3.5" /> : null;

function Stepper({ steps }: { steps: TimelineStep[] }) {
  return (
    <div className="flex items-start overflow-x-auto pb-1">
      {steps.map((st, i) => (
        <div key={`${st.label}-${i}`} className="flex items-center">
          <div className="flex flex-col items-center min-w-[78px] px-1 text-center">
            <span className={cn('h-7 w-7 rounded-full grid place-items-center border text-[10px] font-bold', NODE[st.state])}>
              {nodeIcon(st.state) ?? (st.state === 'skipped' ? '–' : i)}
            </span>
            <span className="mt-1 text-[10px] font-medium text-foreground leading-tight">{st.label}</span>
            {st.actor && <span className="text-[9px] text-muted-foreground leading-tight">{st.actor}</span>}
            {st.at && <span className="text-[9px] text-muted-foreground leading-tight">{fmt(st.at)}</span>}
          </div>
          {i < steps.length - 1 && <span className={cn('h-px w-5 shrink-0 mt-3.5', st.state === 'done' ? 'bg-emerald-500/50' : 'bg-border')} />}
        </div>
      ))}
    </div>
  );
}

export default function SubmissionDetail({ submission, currentUser, onDecision, onReset }: {
  submission: Submission;
  currentUser: CurrentUser;
  onDecision: (role: UserRole, decision: 'Approved' | 'Rejected', comment: string) => void;
  onReset: () => void;
}) {
  const s = submission;
  const req = requiredRolesFor(s.kind);
  const undecided = req.filter(r => !s.approvals.some(a => a.role === r));
  const [actAs, setActAs] = useState<UserRole>(undecided[0] ?? req[0]);
  const [decision, setDecision] = useState<'Approved' | 'Rejected'>('Approved');
  const [comment, setComment] = useState('');

  const approvedRoles = new Set(s.approvals.filter(a => a.decision === 'Approved').map(a => a.role));
  const needComment = decision === 'Rejected' && !comment.trim();
  const canAct = isGated(s.kind) && s.status === 'Pending';

  const submit = () => {
    if (needComment) return;
    onDecision(actAs, decision, comment.trim());
    setComment('');
  };

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={cn('font-semibold', KIND_BADGE[s.kind])}>{s.kind}</Badge>
          <Badge variant="outline" className={cn('font-semibold', STATUS_BADGE[s.status])}>{statusLabel(s)}</Badge>
          <span className="text-xs text-muted-foreground">#{s.id}</span>
        </div>
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <FileSpreadsheet className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="break-all">{s.filename}</span>
          {s.file_url && <a href={s.file_url} className="inline-flex items-center gap-1 text-xs text-primary"><Download className="h-3 w-3" />Download</a>}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span><span className="text-foreground/70">Period:</span> {s.period_date}</span>
          <span><span className="text-foreground/70">Plants:</span> {s.plants.join(', ') || '—'}</span>
          <span><span className="text-foreground/70">Uploaded:</span> {fmt(s.created_at)}</span>
          <span><span className="text-foreground/70">By:</span> {s.uploader_name}</span>
        </div>
      </div>

      <Separator />

      {/* lifecycle */}
      <div>
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Lifecycle</div>
        <Stepper steps={buildTimeline(s)} />
      </div>

      {/* direct import summary */}
      {!isGated(s.kind) && s.summary && (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
          Imported <span className="font-semibold text-foreground">{s.summary.rows.toLocaleString()}</span> {s.summary.label}. No approval required for {s.kind} imports.
        </div>
      )}

      {/* approvals (gated only) */}
      {isGated(s.kind) && (
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Approvals</span>
            <span className="text-xs text-muted-foreground">{approvedRoles.size} of {req.length} approved</span>
          </div>
          <div className="rounded-lg border border-border divide-y divide-border">
            {s.approvals.length === 0 && <div className="px-3 py-3 text-sm text-muted-foreground">No approvals yet.</div>}
            {s.approvals.map((a, i) => (
              <div key={i} className="px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={cn('text-[10px]', a.decision === 'Approved' ? STATUS_BADGE.Approved : STATUS_BADGE.Rejected)}>{a.decision}</Badge>
                  <span className="text-foreground">{a.role}</span>
                  <span className="text-xs text-muted-foreground">· {a.approver_id} · {fmt(a.decided_at)}</span>
                </div>
                {a.comment && <div className="mt-1 text-xs text-muted-foreground">“{a.comment}”</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* actions */}
      {canAct && (
        <>
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              Signed in as <span className="font-medium text-foreground">{currentUser.name}</span>
              <span className="rounded bg-muted px-1.5 py-0.5">mock auth</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">Acting as</Label>
                <Select value={actAs} onValueChange={v => setActAs(v as UserRole)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {req.map(r => <SelectItem key={r} value={r} className="text-sm">{r}{approvedRoles.has(r) ? ' ✓' : ''}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Decision</Label>
                <RadioGroup value={decision} onValueChange={v => setDecision(v as 'Approved' | 'Rejected')} className="flex items-center gap-4 h-9">
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer"><RadioGroupItem value="Approved" id="d-app" />Approve</label>
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer"><RadioGroupItem value="Rejected" id="d-rej" />Reject</label>
                </RadioGroup>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Comment {decision === 'Rejected' && <span className="text-red-400">*</span>}</Label>
              <Textarea value={comment} onChange={e => setComment(e.target.value)} rows={2}
                placeholder={decision === 'Rejected' ? 'Reason for rejecting…' : 'Optional notes…'}
                className={cn('text-sm', needComment && 'border-red-500/60')} />
              {needComment && <span className="text-xs text-red-400">A comment is required to reject.</span>}
            </div>
            <Button onClick={submit} disabled={needComment}
              className={cn(decision === 'Rejected' && 'bg-red-600 hover:bg-red-600/90')}>
              {decision === 'Approved' ? `Approve as ${actAs}` : `Reject as ${actAs}`}
            </Button>
            <p className="text-xs text-muted-foreground">When all {req.length} required roles approve, the batch auto-promotes to live.</p>
          </div>
        </>
      )}

      {/* reset */}
      {(s.status === 'Pending' || s.status === 'Rejected') && isGated(s.kind) && (
        <>
          <Separator />
          <Button variant="outline" size="sm" onClick={onReset} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" /> Reset batch
          </Button>
        </>
      )}
    </div>
  );
}
