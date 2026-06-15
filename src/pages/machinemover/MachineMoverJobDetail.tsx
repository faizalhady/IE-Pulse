/**
 * MachineMoverJobDetail.tsx — right-drawer body for one move Job.
 * Shows the lifecycle timeline (Created → Approved → Ongoing → Completed, or
 * Rejected), the full move details (route, doors, booking, logistics,
 * reservation, machines, attachments), the two PIC approvals, and — for
 * approvers — the accept/reject and advance actions.
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  fmtDate, fmtDateTime, LIFECYCLE, STATUS_BADGE, STATUS_DOT,
  type ApproverRole, type JobStatus,
} from '@/lib/machine_mover/machineMoverConstants';
import { cn } from '@/lib/utils';
import type { CurrentUser, MoveJob } from '@/pages/machinemover/mockMachineMoverData';
import {
  ArrowRight, Check, DoorOpen, FileText, LogOut, MapPin, Play, X,
} from 'lucide-react';
import { useState } from 'react';

const APPROVAL_BADGE: Record<'Approved' | 'Rejected' | 'Pending', string> = {
  Approved: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Rejected: 'bg-red-500/15 text-red-400 border-red-500/30',
  Pending:  'bg-muted text-muted-foreground border-border',
};

function Row({ icon, label, children }: { icon?: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-border last:border-0">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">{icon}{label}</span>
      <span className="text-sm text-foreground text-right">{children}</span>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="px-4 py-1">{children}</div>
    </div>
  );
}

// ─── Lifecycle timeline ────────────────────────────────────────────────────────
function Timeline({ status }: { status: JobStatus }) {
  const rejected = status === 'Rejected';
  const curIdx = rejected ? 0 : LIFECYCLE.indexOf(status);
  const nodes: { label: string; color: string; state: 'done' | 'current' | 'todo' }[] = LIFECYCLE.map((s, i) => ({
    label: s,
    color: STATUS_DOT[s],
    state: i < curIdx ? 'done' : i === curIdx ? 'current' : 'todo',
  }));
  if (rejected) nodes.splice(1, nodes.length, { label: 'Rejected', color: STATUS_DOT.Rejected, state: 'current' });

  return (
    <div className="flex items-center gap-1 px-1 py-1">
      {nodes.map((n, i) => (
        <div key={n.label} className="flex items-center gap-1 flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1">
            <span className={cn('size-3 rounded-full border-2 transition-colors', n.state === 'todo' && 'border-border bg-transparent')}
              style={n.state !== 'todo' ? { background: n.color, borderColor: n.color } : undefined} />
            <span className={cn('text-[9px] font-medium whitespace-nowrap', n.state === 'todo' ? 'text-muted-foreground' : 'text-foreground')}>{n.label}</span>
          </div>
          {i < nodes.length - 1 && <span className={cn('h-0.5 flex-1 rounded', n.state === 'done' ? 'bg-foreground/30' : 'bg-border')} />}
        </div>
      ))}
    </div>
  );
}

export default function MachineMoverJobDetail({ job, currentUser, onDecide, onAdvance }: {
  job: MoveJob;
  currentUser: CurrentUser;
  onDecide: (role: ApproverRole, decision: 'Approved' | 'Rejected', comment: string) => void;
  onAdvance: (status: JobStatus) => void;
}) {
  const [comment, setComment] = useState('');
  const canApprove = currentUser.isApprover && job.status === 'Created';
  const pendingRoles = job.approvals.filter((a) => a.decision === 'Pending');

  return (
    <div className="space-y-4">
      {/* status + timeline */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className={cn('text-[11px] font-semibold', STATUS_BADGE[job.status])}>{job.status}</Badge>
          <span className="text-[11px] text-muted-foreground">Updated {fmtDateTime(job.status_at)}</span>
        </div>
        <Timeline status={job.status} />
      </div>

      {/* route */}
      <Card title="Route">
        <Row icon={<MapPin className="h-3.5 w-3.5" />} label="Move">
          <span className="flex items-center gap-1.5 font-medium">
            {job.fromLocation} <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" /> {job.toLocation}
          </span>
        </Row>
        <Row icon={<LogOut className="h-3.5 w-3.5" />} label="Exit door">{job.exitDoor}</Row>
        <Row icon={<DoorOpen className="h-3.5 w-3.5" />} label="Entrance door">{job.entranceDoor}</Row>
      </Card>

      {/* booking + details */}
      <Card title="Booking & details">
        <Row label="Date">{fmtDate(job.date)}</Row>
        <Row label="Time">{job.timeStart} – {job.timeEnd}</Row>
        <Row label="Department">{job.department}</Row>
        <Row label="PIC">{job.pic}</Row>
        <Row label="Logistics">{job.logistics}</Row>
        <Row label="Machine(s)">
          <span className="flex flex-col items-end gap-0.5">{job.machines.map((m) => <span key={m}>{m}</span>)}</span>
        </Row>
        <Row label="Reservation"><span className="text-muted-foreground">{job.reservation}</span></Row>
      </Card>

      {/* attachments */}
      {job.attachments.length > 0 && (
        <Card title="Attachments">
          <div className="py-2 space-y-1">
            {job.attachments.map((f) => (
              <div key={f.name} className="flex items-center gap-2 text-sm">
                <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="truncate flex-1 text-foreground">{f.name}</span>
                <span className="text-xs text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* approvals */}
      <Card title="Approvals (2 PIC)">
        <div className="py-2 space-y-2">
          {job.approvals.map((a) => (
            <div key={a.role} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-foreground">{a.role}</p>
                {a.approver && <p className="text-[11px] text-muted-foreground">{a.approver} · {a.decided_at ? fmtDateTime(a.decided_at) : ''}</p>}
                {a.comment && <p className="text-[11px] text-muted-foreground italic mt-0.5">“{a.comment}”</p>}
              </div>
              <Badge variant="outline" className={cn('text-[10px] font-semibold shrink-0', APPROVAL_BADGE[a.decision])}>{a.decision}</Badge>
            </div>
          ))}
        </div>
      </Card>

      {/* actions — approvers only */}
      {canApprove && pendingRoles.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Your decision</p>
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2}
            placeholder="Optional comment (required context on reject)…" className="text-sm resize-none" />
          {pendingRoles.map((a) => (
            <div key={a.role} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground flex-1">As {a.role}</span>
              <Button size="sm" onClick={() => { onDecide(a.role, 'Approved', comment); setComment(''); }}
                className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"><Check className="h-3.5 w-3.5" /> Approve</Button>
              <Button size="sm" variant="outline" onClick={() => { onDecide(a.role, 'Rejected', comment); setComment(''); }}
                className="h-8 gap-1 border-red-500/40 text-red-400 hover:bg-red-500/10"><X className="h-3.5 w-3.5" /> Reject</Button>
            </div>
          ))}
        </div>
      )}

      {/* advance — approvers move an approved job through its lifecycle */}
      {currentUser.isApprover && (job.status === 'Approved' || job.status === 'Ongoing') && (
        <Button onClick={() => onAdvance(job.status === 'Approved' ? 'Ongoing' : 'Completed')}
          className="w-full gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">
          {job.status === 'Approved' ? <><Play className="h-4 w-4" /> Start move (mark Ongoing)</> : <><Check className="h-4 w-4" /> Mark completed</>}
        </Button>
      )}
    </div>
  );
}
