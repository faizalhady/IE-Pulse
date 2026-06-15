/**
 * MachineMoverHome.tsx — Machine Mover landing page.
 * ──────────────────────────────────────────────────────────────────────────────
 * Log of every move request (job) with a status-filter segment. A big blue
 * "New request" button opens the request modal; clicking a row opens the detail
 * drawer (route, booking, approvals, lifecycle). Mock-backed via useMoveJobs.
 *
 * Route: /machine-mover
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  createJob, decideJob, setJobStatus, useMoveJobs, type NewJobInput,
} from '@/hooks/machine_mover/useMoveJobs';
import {
  fmtDate, JOB_STATUSES, STATUS_BADGE, type ApproverRole, type JobStatus,
} from '@/lib/machine_mover/machineMoverConstants';
import { cn } from '@/lib/utils';
import MachineMoverJobDetail from '@/pages/machinemover/MachineMoverJobDetail';
import MachineMoverRequestForm from '@/pages/machinemover/MachineMoverRequestForm';
import { MOCK_CURRENT_USER } from '@/pages/machinemover/mockMachineMoverData';
import { ArrowRight, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

type Filter = 'all' | JobStatus;
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  ...JOB_STATUSES.map((s) => ({ key: s, label: s })),
];

export default function MachineMoverHome() {
  const me = MOCK_CURRENT_USER;
  const jobs = useMoveJobs();
  const [filter, setFilter] = useState<Filter>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rows = useMemo(() => jobs.filter((j) => filter === 'all' || j.status === filter), [jobs, filter]);
  const selected = jobs.find((j) => j.id === selectedId) ?? null;

  const handleCreate = (input: NewJobInput) => {
    const job = createJob(input);
    setFormOpen(false);
    setSelectedId(job.id);
    toast.success(`Request ${job.id} submitted — approval email sent to both PICs.`);
  };
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
      {/* header */}
      <div className="sticky top-0 z-20 bg-background border-b border-border px-5 pt-4 pb-3 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Machine Mover</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Request, approve and track machine moves — point A to point B.</p>
        </div>
        <Button onClick={() => setFormOpen(true)} size="lg" className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
          <Plus className="h-4 w-4" /> New request
        </Button>
      </div>

      <div className="p-5 space-y-4">
        {/* filter segment */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 rounded-lg border border-border p-0.5">
            {FILTERS.map((f) => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  filter === f.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* jobs table */}
        <div className="rounded-xl border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead>
              <tr className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wider">
                <th className="text-left font-medium px-4 py-3">Job</th>
                <th className="text-left font-medium px-4 py-3">Route</th>
                <th className="text-left font-medium px-4 py-3">Dept · PIC</th>
                <th className="text-left font-medium px-4 py-3">Move date</th>
                <th className="text-center font-medium px-4 py-3">Approvals</th>
                <th className="text-center font-medium px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((j) => {
                const approved = j.approvals.filter((a) => a.decision === 'Approved').length;
                return (
                  <tr key={j.id} onClick={() => setSelectedId(j.id)}
                    className="h-14 border-b border-border last:border-0 hover:bg-muted/40 cursor-pointer">
                    <td className="px-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground truncate max-w-[260px]">{j.title}</span>
                        <span className="text-xs text-muted-foreground">{j.id} · {j.machines.length} machine{j.machines.length > 1 ? 's' : ''}</span>
                      </div>
                    </td>
                    <td className="px-4 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">{j.fromLocation} <ArrowRight className="h-3 w-3" /> {j.toLocation}</span>
                    </td>
                    <td className="px-4 text-xs text-muted-foreground">{j.department} · {j.pic}</td>
                    <td className="px-4 text-xs text-muted-foreground">{fmtDate(j.date)}</td>
                    <td className="px-4 text-center font-mono text-xs">
                      <span className={cn(approved === j.approvals.length ? 'text-emerald-400' : 'text-muted-foreground')}>
                        {approved}/{j.approvals.length}
                      </span>
                    </td>
                    <td className="px-4 text-center">
                      <Badge variant="outline" className={cn('text-[10px] font-semibold', STATUS_BADGE[j.status])}>{j.status}</Badge>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">No move requests match this filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* request modal */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New move request</DialogTitle>
            <DialogDescription>Fill in the machine, route, doors and booking. Two PICs must approve before the move can start.</DialogDescription>
          </DialogHeader>
          <MachineMoverRequestForm onSubmit={handleCreate} onClose={() => setFormOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* detail drawer */}
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
