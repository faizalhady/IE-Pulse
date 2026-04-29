import { cn } from '@/lib/utils';
import { SHIFTS, shiftLabel } from '@/lib/oleConstants';
import { useOleWorkcells } from '@/hooks/useOleData';
import {
  ArrowRightLeft, CalendarIcon,
  Clock, Plus, Trash2, X, Activity,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerField } from './OLEFilters';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TransferLog {
  id:         number;
  created_at: string;
  date:       string;
  shift:      number;
  from_wc:    string;
  to_wc:      string;
  va_hc:      number;
  va_hrs:     number;
  nva_hc:     number;
  nva_hrs:    number;
}

// ─── Log Transfer Dialog ──────────────────────────────────────────────────────

function LogDialog({
  workcellOptions,
  onClose,
  onSubmit,
}: {
  workcellOptions: string[];
  onClose: () => void;
  onSubmit: (log: Omit<TransferLog, 'id' | 'created_at'>) => void;
}) {
  const [fromWc,      setFromWc]      = useState(workcellOptions[0] ?? '');
  const [toWc,        setToWc]        = useState(workcellOptions[1] ?? '');
  const [tdate,       setTdate]       = useState(new Date().toISOString().slice(0, 10));
  const [shift,       setShift]       = useState('1');
  const [vaHc,        setVaHc]        = useState('');
  const [vaHrs,       setVaHrs]       = useState('');
  const [nvaHc,       setNvaHc]       = useState('');
  const [nvaHrs,      setNvaHrs]      = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const sameWc = fromWc === toWc;
  const canSubmit = fromWc && toWc && !sameWc && tdate && shift &&
    vaHc !== '' && vaHrs !== '' && nvaHc !== '' && nvaHrs !== '' && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        date:    tdate,
        shift:   Number(shift),
        from_wc: fromWc,
        to_wc:   toWc,
        va_hc:   Number(vaHc),
        va_hrs:  Number(vaHrs),
        nva_hc:  Number(nvaHc),
        nva_hrs: Number(nvaHrs),
      });
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Submission failed');
      setSubmitting(false);
    }
  }

  const inputCls = 'w-full rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary';
  const labelCls = 'text-right pr-4 text-sm font-semibold text-foreground whitespace-nowrap min-w-[140px]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl rounded-2xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden">

        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
          <p className="font-bold text-foreground text-lg">WC Transfer Man-Hour Data Management</p>
          <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* body */}
        <div className="px-8 py-6 space-y-4">
          <p className="font-bold text-sm text-foreground mb-4">All form fields are required.</p>

          <div className="flex items-center">
            <label className={labelCls}>WorkCell From:</label>
            <select className={inputCls} value={fromWc} onChange={e => setFromWc(e.target.value)}>
              {workcellOptions.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>

          <div className="flex items-center">
            <label className={labelCls}>WorkCell To:</label>
            <select className={cn(inputCls, sameWc && 'border-red-500/50')} value={toWc} onChange={e => setToWc(e.target.value)}>
              {workcellOptions.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
          {sameWc && <p className="text-xs text-red-400 text-right">From and To cannot be the same workcell</p>}

          <div className="flex items-center">
            <label className={labelCls}>Date:</label>
            <div className="flex items-center gap-2">
              <input type="date" className={cn(inputCls, 'w-40')} value={tdate} onChange={e => setTdate(e.target.value)} />
              <CalendarIcon className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>

          <div className="flex items-center">
            <label className={labelCls}>Shift:</label>
            <div className="flex gap-2 flex-1">
              {SHIFTS.map(s => (
                <button key={s.value} onClick={() => setShift(s.value)}
                  className={cn('flex-1 py-1.5 rounded-lg border text-xs font-medium transition-colors',
                    shift === s.value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:border-foreground/30')}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center">
            <label className={labelCls}>VA HeadCount:</label>
            <input type="number" min="0" className={inputCls} value={vaHc} onChange={e => setVaHc(e.target.value)} />
          </div>

          <div className="flex items-center">
            <label className={labelCls}>VA Work Hours:</label>
            <input type="number" min="0" step="0.5" className={inputCls} value={vaHrs} onChange={e => setVaHrs(e.target.value)} />
          </div>

          <div className="flex items-center">
            <label className={labelCls}>NVA HeadCount:</label>
            <input type="number" min="0" className={inputCls} value={nvaHc} onChange={e => setNvaHc(e.target.value)} />
          </div>

          <div className="flex items-center">
            <label className={labelCls}>NVA Work Hours:</label>
            <input type="number" min="0" step="0.5" className={inputCls} value={nvaHrs} onChange={e => setNvaHrs(e.target.value)} />
          </div>

          {/* live preview */}
          {vaHrs && nvaHrs && (
            <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-xs space-y-1">
              <p className="text-muted-foreground font-semibold">Transfer summary</p>
              <p className="font-mono text-foreground">{fromWc} → {toWc} · {shiftLabel(shift)} shift</p>
              <p className="font-mono text-emerald-400">VA: {vaHc} pax · {vaHrs} hrs</p>
              <p className="font-mono text-orange-400">NVA: {nvaHc} pax · {nvaHrs} hrs</p>
            </div>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        {/* footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/10">
          <button onClick={handleSubmit} disabled={!canSubmit}
            className="px-6 py-1.5 rounded border border-border bg-card text-foreground text-sm font-medium hover:bg-muted disabled:opacity-40 transition-colors shadow-sm">
            {submitting ? 'Saving…' : 'Apply'}
          </button>
          <button onClick={onClose}
            className="px-6 py-1.5 rounded border border-border bg-card text-foreground text-sm font-medium hover:bg-muted transition-colors shadow-sm">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

export default function TransferManHour() {
  const [tab,         setTab]         = useState<'overview' | 'logs'>('overview');
  const [logs,        setLogs]        = useState<TransferLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [showDialog,  setShowDialog]  = useState(false);

  // filters
  const [filterWc,    setFilterWc]    = useState('');
  const [filterShift, setFilterShift] = useState('');
  const [filterDate,  setFilterDate]  = useState('');

  const { data: workcellData } = useOleWorkcells();
  const workcellOptions = useMemo(() => (workcellData ?? []).map(w => w.workcell), [workcellData]);

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const data = await fetch('/api/transfers').then(r => r.json());
      setLogs(data);
    } catch {
      setLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => { fetchLogs(); }, []);

  const filteredLogs = useMemo(() => logs.filter(l =>
    (!filterWc    || l.from_wc === filterWc || l.to_wc === filterWc) &&
    (!filterShift || String(l.shift) === filterShift) &&
    (!filterDate  || l.date === filterDate)
  ), [logs, filterWc, filterShift, filterDate]);

  // Stats
  const totalTransfers = logs.length;
  const totalVaHrs     = logs.reduce((s, l) => s + l.va_hrs, 0);
  const totalNvaHrs    = logs.reduce((s, l) => s + l.nva_hrs, 0);

  async function handleSubmit(log: Omit<TransferLog, 'id' | 'created_at'>) {
    const res = await fetch('/api/transfers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(log),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.detail ?? 'Server error');
    }
    await fetchLogs();
  }

  async function handleDelete(id: number) {
    await fetch(`/api/transfers/${id}`, { method: 'DELETE' });
    setLogs(prev => prev.filter(l => l.id !== id));
  }

  const tabCls = (t: string) => cn(
    'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
    tab === t ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
  );

  return (
    <div className="space-y-0">

      {/* sticky header */}
      <div className="sticky top-0 z-20 bg-background border-b border-border px-6">
        <div className="pt-4 pb-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">WC Transfer Man-Hour Management</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Track and manage cross-workcell headcounts</p>
          </div>
          <button onClick={() => setShowDialog(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
            <Plus className="h-4 w-4" /> Log Transfer
          </button>
        </div>
        <div className="flex items-center gap-0 -mb-px">
          <button className={tabCls('overview')} onClick={() => setTab('overview')}>Overview</button>
          <button className={tabCls('logs')} onClick={() => setTab('logs')}>
            Transfer Logs
            <span className="ml-2 text-[10px] font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{logs.length}</span>
          </button>
        </div>
      </div>

      {/* OVERVIEW tab */}
      {tab === 'overview' && (
        <div className="px-6 py-6 space-y-6">

          {/* KPI strip */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Total Transfers', value: String(totalTransfers), icon: ArrowRightLeft, accent: 'bg-blue-500/15 text-blue-400' },
              { label: 'Total VA Hours',  value: String(totalVaHrs),     icon: Clock,          accent: 'bg-emerald-500/15 text-emerald-400' },
              { label: 'Total NVA Hours', value: String(totalNvaHrs),    icon: Activity,       accent: 'bg-orange-500/15 text-orange-400' },
            ].map(({ label, value, icon: Icon, accent }) => (
              <div key={label} className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3">
                <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0', accent)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">{label}</p>
                  <p className="text-3xl font-mono font-bold text-foreground mt-1 leading-none">{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Recent logs */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Recent Transfers</p>
                <p className="text-xs text-muted-foreground mt-0.5">Latest 5 man-hour transfers</p>
              </div>
              <button onClick={() => setTab('logs')} className="text-xs text-primary hover:underline">View all →</button>
            </div>
            {logs.length === 0 ? (
              <div className="py-10 text-center text-xs text-muted-foreground">No transfer entries yet. Click "Log Transfer" to add one.</div>
            ) : (
              <div className="divide-y divide-border">
                {logs.slice(0, 5).map(l => (
                  <div key={l.id} className="grid items-center px-5 py-3 gap-4 border-b border-border last:border-0 hover:bg-muted/40 transition-colors"
                    style={{ gridTemplateColumns: '6rem 5rem 1fr 1fr 7rem 7rem' }}>
                    <span className="text-xs font-mono text-muted-foreground">{l.date}</span>
                    <span className="text-xs text-muted-foreground">{shiftLabel(l.shift)}</span>
                    <span className="text-xs font-semibold text-foreground">{l.from_wc}</span>
                    <span className="text-xs font-semibold text-foreground">{l.to_wc}</span>
                    <span className="text-xs font-mono text-emerald-400 text-right">{l.va_hrs} VA hrs</span>
                    <span className="text-xs font-mono text-orange-400 text-right">{l.nva_hrs} NVA hrs</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* LOGS tab */}
      {tab === 'logs' && (
        <div className="px-6 py-5 space-y-4">

          {/* filters */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[180px]">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Workcell</Label>
              <Select value={filterWc || '__all__'} onValueChange={v => setFilterWc(v === '__all__' ? '' : v)}>
                <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="All workcells" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All workcells</SelectItem>
                  {workcellOptions.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[140px]">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Shift</Label>
              <Select value={filterShift || '__all__'} onValueChange={v => setFilterShift(v === '__all__' ? '' : v)}>
                <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="All shifts" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All shifts</SelectItem>
                  {SHIFTS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <DatePickerField id="tmh-date" label="Date" value={filterDate} onChange={setFilterDate} />
            {(filterWc || filterShift || filterDate) && (
              <button onClick={() => { setFilterWc(''); setFilterShift(''); setFilterDate(''); }}
                className="h-9 px-3 rounded-lg border border-red-500/30 text-xs text-red-500 hover:bg-red-500/10 transition-colors">
                Clear
              </button>
            )}
            <span className="ml-auto text-xs text-muted-foreground mb-2">{filteredLogs.length} records</span>
          </div>

          {/* table */}
          <div className="rounded-xl border border-border overflow-hidden bg-card">
            <div className="grid bg-muted/50 border-b border-border text-xs text-muted-foreground font-medium uppercase tracking-wider px-4 py-3 gap-3"
              style={{ gridTemplateColumns: '6rem 5rem 1fr 1fr 5rem 6rem 5rem 6rem 2.5rem' }}>
              <span>Date</span><span>Shift</span><span>From</span><span>To</span>
              <span className="text-right">VA HC</span><span className="text-right">VA Hrs</span>
              <span className="text-right">NVA HC</span><span className="text-right">NVA Hrs</span>
              <span />
            </div>
            {loadingLogs ? (
              <div className="py-12 text-center text-xs text-muted-foreground">Loading…</div>
            ) : filteredLogs.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">No records match the current filters</div>
            ) : filteredLogs.map(l => (
              <div key={l.id} className="grid items-center px-4 py-3 text-sm border-b border-border last:border-0 hover:bg-muted/40 transition-colors gap-3"
                style={{ gridTemplateColumns: '6rem 5rem 1fr 1fr 5rem 6rem 5rem 6rem 2.5rem' }}>
                <span className="font-mono text-xs text-muted-foreground">{l.date}</span>
                <span className="text-xs text-muted-foreground">{shiftLabel(l.shift)}</span>
                <span className="text-xs font-semibold text-foreground">{l.from_wc}</span>
                <span className="text-xs font-semibold text-foreground">{l.to_wc}</span>
                <span className="text-xs font-mono text-foreground text-right">{l.va_hc}</span>
                <span className="text-xs font-mono font-semibold text-emerald-400 text-right">{l.va_hrs}</span>
                <span className="text-xs font-mono text-foreground text-right">{l.nva_hc}</span>
                <span className="text-xs font-mono font-semibold text-orange-400 text-right">{l.nva_hrs}</span>
                <button onClick={() => handleDelete(l.id)}
                  className="flex items-center justify-center text-muted-foreground hover:text-red-400 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showDialog && (
        <LogDialog
          workcellOptions={workcellOptions}
          onClose={() => setShowDialog(false)}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
