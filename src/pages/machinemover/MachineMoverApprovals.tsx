/**
 * MachineMoverApprovals.tsx — authority/admin queue.
 * ──────────────────────────────────────────────────────────────────────────────
 * Lists jobs still awaiting a PIC decision (status Created with any Pending
 * approval) so authorities can accept or reject from the detail drawer. A
 * secondary "Recently decided" list gives context. Mock-backed via useMoveJobs.
 *
 * Route: /machine-mover/approvals
 */

import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  decideJob, setJobStatus, useMoveJobs,
} from '@/hooks/machine_mover/useMoveJobs';
import {
  fmtDate, STATUS_BADGE, type ApproverRole, type JobStatus,
} from '@/lib/machine_mover/machineMoverConstants';
import { cn } from '@/lib/utils';
import MachineMoverJobDetail from '@/pages/machinemover/MachineMoverJobDetail';
import { MOCK_CURRENT_USER } from '@/pages/machinemover/mockMachineMoverData';
import { ArrowRight, Inbox, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

export default function MachineMoverApprovals() {
  const me = MOCK_CURRENT_USER;
  const jobs = useMoveJobs();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const queue = useMemo(
    () => jobs.filter((j) => j.status === 'Created' && j.approvals.some((a) => a.decision === 'Pending')),
    [jobs],
  );
  const decided = useMemo(
    () => jobs.filter((j) => j.status !== 'Created').slice(0, 8),
    [jobs],
  );
  const selected = jobs.find((j) => j.id === selectedId) ?? null;

  const handleDecide = (role: ApproverRole, decision: 'Approved' | 'Rejected', comment: string) => {
    if (!selected) return;
    decideJob(selected.id, role, decision, me.name, comment);
    toast[decision === 'Approved' ? 'success' : 'error'](`${selected.id} ${decision.toLowerCase()} as ${role}.`);
  };
  const handleAdvance = (status: JobStatus) => {
    if (!selected) return;
    setJobStatus(selected.id, status);
    toast.success(`${selected.id} → ${status}.`);
  };

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-20 bg-background border-b border-border px-5 pt-4 pb-3 flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-blue-500" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">Approvals</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Accept or reject pending machine-move requests. Two PIC sign-offs required.</p>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* awaiting decision */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Inbox className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Awaiting decision</h2>
            <span className="text-xs text-muted-foreground">{queue.length}</span>
          </div>
          {queue.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/10 py-10 text-center text-sm text-muted-foreground">
              Nothing waiting on you — the queue is clear.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {queue.map((j) => {
                const approved = j.approvals.filter((a) => a.decision === 'Approved').length;
                return (
                  <button key={j.id} onClick={() => setSelectedId(j.id)}
                    className="text-left rounded-xl border border-border bg-card p-4 hover:border-blue-500/40 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-foreground leading-tight">{j.title}</span>
                      <Badge variant="outline" className={cn('text-[10px] font-semibold shrink-0', STATUS_BADGE[j.status])}>{j.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{j.id} · {j.department} · {j.pic}</p>
                    <p className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                      {j.fromLocation} <ArrowRight className="h-3 w-3" /> {j.toLocation}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Move {fmtDate(j.date)}</span>
                      <span className="font-mono text-muted-foreground">{approved}/{j.approvals.length} approved</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* recently decided */}
        {decided.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Recently decided</h2>
            <div className="rounded-xl border border-border bg-card overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <tbody>
                  {decided.map((j) => (
                    <tr key={j.id} onClick={() => setSelectedId(j.id)}
                      className="h-12 border-b border-border last:border-0 hover:bg-muted/40 cursor-pointer">
                      <td className="px-4 font-medium text-foreground">{j.title}</td>
                      <td className="px-4 text-xs text-muted-foreground">{j.id}</td>
                      <td className="px-4 text-xs text-muted-foreground">{j.department} · {j.pic}</td>
                      <td className="px-4 text-center">
                        <Badge variant="outline" className={cn('text-[10px] font-semibold', STATUS_BADGE[j.status])}>{j.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {/* decision drawer */}
      <Sheet open={!!selected} onOpenChange={(o) => { if (!o) setSelectedId(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.title}</SheetTitle>
                <SheetDescription>{selected.id} · {selected.department}</SheetDescription>
              </SheetHeader>
              <div className="mt-5">
                <MachineMoverJobDetail key={selected.id} job={selected} currentUser={me} onDecide={handleDecide} onAdvance={handleAdvance} />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
