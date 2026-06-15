/**
 * MachineMoverReports.tsx — reporting surface.
 * ──────────────────────────────────────────────────────────────────────────────
 * Summary KPIs + a filter bar (department · status · move-date range) over the
 * job log, with a live preview and two outputs: download CSV or print. All
 * client-side over the mock store — no backend. Swap the filtered set for a
 * server query later; the CSV/print stay as-is.
 *
 * Route: /machine-mover/reports
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMoveJobs } from '@/hooks/machine_mover/useMoveJobs';
import {
  DEPARTMENTS, fmtDate, JOB_STATUSES, STATUS_BADGE, STATUS_DOT, type JobStatus,
} from '@/lib/machine_mover/machineMoverConstants';
import { cn } from '@/lib/utils';
import type { MoveJob } from '@/pages/machinemover/mockMachineMoverData';
import { Download, Printer } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

const ALL = 'all';

function toCsv(jobs: MoveJob[]): string {
  const head = ['Job', 'Title', 'Status', 'Department', 'PIC', 'From', 'To', 'Exit door', 'Entrance door', 'Date', 'Start', 'End', 'Logistics', 'Machines', 'Reservation'];
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = jobs.map((j) => [
    j.id, j.title, j.status, j.department, j.pic, j.fromLocation, j.toLocation, j.exitDoor, j.entranceDoor,
    j.date, j.timeStart, j.timeEnd, j.logistics, j.machines.join('; '), j.reservation,
  ].map(esc).join(','));
  return [head.map(esc).join(','), ...lines].join('\r\n');
}

function Kpi({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-2xl font-bold tabular-nums" style={color ? { color } : undefined}>{value}</p>
      <p className="text-[11px] text-muted-foreground uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  );
}

export default function MachineMoverReports() {
  const jobs = useMoveJobs();
  const [dept, setDept] = useState(ALL);
  const [status, setStatus] = useState<string>(ALL);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const filtered = useMemo(() => jobs.filter((j) => {
    if (dept !== ALL && j.department !== dept) return false;
    if (status !== ALL && j.status !== status) return false;
    if (from && j.date < from) return false;
    if (to && j.date > to) return false;
    return true;
  }), [jobs, dept, status, from, to]);

  const counts = useMemo(() => {
    const c: Record<JobStatus, number> = { Created: 0, Approved: 0, Ongoing: 0, Completed: 0, Rejected: 0 };
    for (const j of filtered) c[j.status]++;
    return c;
  }, [filtered]);

  const exportCsv = () => {
    if (!filtered.length) { toast.error('No jobs match the current filters.'); return; }
    const blob = new Blob([toCsv(filtered)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `machine-mover_report_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} job${filtered.length > 1 ? 's' : ''} to CSV.`);
  };

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-20 bg-background border-b border-border px-5 pt-4 pb-3 flex items-start justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Reports</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Summarise and export the move log by department, status and date.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => window.print()} className="gap-1.5"><Printer className="h-4 w-4" /> Print</Button>
          <Button onClick={exportCsv} className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"><Download className="h-4 w-4" /> Export CSV</Button>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Kpi label="Total" value={filtered.length} />
          {JOB_STATUSES.map((s) => <Kpi key={s} label={s} value={counts[s]} color={STATUS_DOT[s]} />)}
        </div>

        {/* filter bar */}
        <div className="rounded-xl border border-border bg-card p-4 flex flex-wrap items-end gap-3 print:hidden">
          <div className="flex flex-col gap-1 min-w-[150px]">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Department</label>
            <Select value={dept} onValueChange={setDept}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL} className="text-sm">All departments</SelectItem>
                {DEPARTMENTS.map((d) => <SelectItem key={d} value={d} className="text-sm">{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1 min-w-[150px]">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL} className="text-sm">All statuses</SelectItem>
                {JOB_STATUSES.map((s) => <SelectItem key={s} value={s} className="text-sm">{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">From date</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-[150px]" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">To date</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-[150px]" />
          </div>
          {(dept !== ALL || status !== ALL || from || to) && (
            <Button variant="ghost" onClick={() => { setDept(ALL); setStatus(ALL); setFrom(''); setTo(''); }} className="h-9 text-xs">Clear</Button>
          )}
        </div>

        {/* preview table */}
        <div className="rounded-xl border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead>
              <tr className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wider">
                <th className="text-left font-medium px-4 py-3">Job</th>
                <th className="text-left font-medium px-4 py-3">Route</th>
                <th className="text-left font-medium px-4 py-3">Dept · PIC</th>
                <th className="text-left font-medium px-4 py-3">Date</th>
                <th className="text-center font-medium px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((j) => (
                <tr key={j.id} className="h-12 border-b border-border last:border-0">
                  <td className="px-4"><span className="font-medium text-foreground">{j.title}</span> <span className="text-xs text-muted-foreground">{j.id}</span></td>
                  <td className="px-4 text-xs text-muted-foreground">{j.fromLocation} → {j.toLocation}</td>
                  <td className="px-4 text-xs text-muted-foreground">{j.department} · {j.pic}</td>
                  <td className="px-4 text-xs text-muted-foreground">{fmtDate(j.date)}</td>
                  <td className="px-4 text-center"><Badge variant="outline" className={cn('text-[10px] font-semibold', STATUS_BADGE[j.status])}>{j.status}</Badge></td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">No jobs match these filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
