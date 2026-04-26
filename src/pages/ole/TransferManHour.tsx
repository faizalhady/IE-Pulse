import { cn } from '@/lib/utils';
import {
  ArrowRightLeft, BarChart2, CalendarIcon,
  Clock, Plus, Users, X, Activity
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerField } from './OLEFilters';

// ─── types & mock data ────────────────────────────────────────────────────────

export interface TransferLog {
  id: string;
  date: string;
  shift: string;
  fromWc: string;
  toWc: string;
  vaHc: number;
  vaHrs: number;
  nvaHc: number;
  nvaHrs: number;
}

const WORKCELLS = ['ADVA', 'AEROFLEX', 'ARISTA', 'KEYSIGHT', 'MICRON', 'DYSON', 'AOP1', 'MSI', 'PHOTONICS'];

const MOCK_LOGS: TransferLog[] = [
  { id: '1', date: '2026-04-26', shift: '1', fromWc: 'ADVA', toWc: 'AEROFLEX', vaHc: 2, vaHrs: 16, nvaHc: 0, nvaHrs: 0 },
  { id: '2', date: '2026-04-25', shift: '2', fromWc: 'ARISTA', toWc: 'MICRON', vaHc: 4, vaHrs: 32, nvaHc: 1, nvaHrs: 8 },
  { id: '3', date: '2026-04-25', shift: '1', fromWc: 'KEYSIGHT', toWc: 'MSI', vaHc: 1, vaHrs: 8, nvaHc: 0, nvaHrs: 0 },
  { id: '4', date: '2026-04-24', shift: '3', fromWc: 'DYSON', toWc: 'AOP1', vaHc: 5, vaHrs: 40, nvaHc: 2, nvaHrs: 16 },
];

// ─── Log Transfer Dialog ───────────────────────────────────────────────────────

function LogDialog({ onClose, onSubmit }: { onClose: () => void; onSubmit: (log: Omit<TransferLog, 'id'>) => void }) {
  const [fromWc, setFromWc] = useState(WORKCELLS[0]);
  const [toWc, setToWc] = useState(WORKCELLS[1]);
  const [tdate, setTdate] = useState(new Date().toISOString().slice(0, 10));
  const [shift, setShift] = useState('1');
  const [vaHc, setVaHc] = useState('');
  const [vaHrs, setVaHrs] = useState('');
  const [nvaHc, setNvaHc] = useState('');
  const [nvaHrs, setNvaHrs] = useState('');

  const canSubmit = fromWc && toWc && tdate && shift && vaHc && vaHrs && nvaHc && nvaHrs;

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit({
      date: tdate, shift, fromWc, toWc,
      vaHc: Number(vaHc), vaHrs: Number(vaHrs),
      nvaHc: Number(nvaHc), nvaHrs: Number(nvaHrs),
    });
    onClose();
  }

  const inputCls = 'w-full rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary';
  const labelCls = 'text-right pr-4 text-sm font-semibold text-foreground whitespace-nowrap min-w-[140px]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl rounded-2xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden">
        
        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
          <div>
            <p className="font-bold text-foreground text-lg">WC Transfer Man-Hour Data Management</p>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* body form exactly like screenshot */}
        <div className="px-8 py-6 space-y-4">
          <p className="font-bold text-sm text-foreground mb-4">All form fields are required.</p>

          <div className="flex items-center">
            <label className={labelCls}>WorkCell From:</label>
            <select className={inputCls} value={fromWc} onChange={e => setFromWc(e.target.value)}>
              {WORKCELLS.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>

          <div className="flex items-center">
            <label className={labelCls}>WorkCell to:</label>
            <select className={inputCls} value={toWc} onChange={e => setToWc(e.target.value)}>
              {WORKCELLS.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>

          <div className="flex items-center">
            <label className={labelCls}>Tdate:</label>
            <div className="flex items-center gap-2">
              <input type="date" className={cn(inputCls, 'w-40')} value={tdate} onChange={e => setTdate(e.target.value)} />
              <CalendarIcon className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>

          <div className="flex items-center">
            <label className={labelCls}>Shift:</label>
            <select className={cn(inputCls, 'w-24')} value={shift} onChange={e => setShift(e.target.value)}>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
            </select>
          </div>

          <div className="flex items-center">
            <label className={labelCls}>VA HeadCount:</label>
            <input type="number" min="0" className={inputCls} value={vaHc} onChange={e => setVaHc(e.target.value)} />
          </div>

          <div className="flex items-center">
            <label className={labelCls}>VA Workhours:</label>
            <input type="number" min="0" className={inputCls} value={vaHrs} onChange={e => setVaHrs(e.target.value)} />
          </div>

          <div className="flex items-center">
            <label className={labelCls}>NVA HeadCount:</label>
            <input type="number" min="0" className={inputCls} value={nvaHc} onChange={e => setNvaHc(e.target.value)} />
          </div>

          <div className="flex items-center">
            <label className={labelCls}>NVA Workhours:</label>
            <input type="number" min="0" className={inputCls} value={nvaHrs} onChange={e => setNvaHrs(e.target.value)} />
          </div>

        </div>

        {/* footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border flex-shrink-0 bg-muted/10">
          <button onClick={handleSubmit} disabled={!canSubmit}
            className="px-6 py-1.5 rounded border border-border bg-card text-foreground text-sm font-medium hover:bg-muted disabled:opacity-40 transition-colors shadow-sm">
            Apply
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
  const [tab, setTab] = useState<'overview' | 'logs'>('overview');
  const [logs, setLogs] = useState<TransferLog[]>(MOCK_LOGS);
  const [showDialog, setShowDialog] = useState(false);

  // logs tab filters
  const [filterWc, setFilterWc] = useState('');
  const [filterShift, setFilterShift] = useState('');
  const [filterDate, setFilterDate] = useState('');

  const filteredLogs = useMemo(() => logs.filter(l =>
    (!filterWc || l.fromWc === filterWc || l.toWc === filterWc) &&
    (!filterShift || l.shift === filterShift) &&
    (!filterDate || l.date === filterDate)
  ), [logs, filterWc, filterShift, filterDate]);

  // dashboard stats
  const totalTransfers = logs.length;
  const totalVaHrs = logs.reduce((s, l) => s + l.vaHrs, 0);
  const totalNvaHrs = logs.reduce((s, l) => s + l.nvaHrs, 0);

  const tabCls = (t: string) => cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
    tab === t ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border');

  const selectCls = 'h-9 rounded-lg border border-border bg-muted/30 px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary';

  return (
    <div className="space-y-0">

      {/* ── sticky header ── */}
      <div className="sticky top-0 z-20 bg-background border-b border-border px-6">
        <div className="pt-4 pb-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">WC Transfer Man-Hour Data Management</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Track and manage cross-workcell headcounts</p>
          </div>
          <button onClick={() => setShowDialog(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
            <Plus className="h-4 w-4" /> Log Transfer
          </button>
        </div>

        {/* tabs */}
        <div className="flex items-center gap-0 -mb-px">
          <button className={tabCls('overview')} onClick={() => setTab('overview')}>Overview</button>
          <button className={tabCls('logs')} onClick={() => setTab('logs')}>
            Transfer Logs
            <span className="ml-2 text-[10px] font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{logs.length}</span>
          </button>
        </div>
      </div>

      {/* ── OVERVIEW tab ── */}
      {tab === 'overview' && (
        <div className="px-6 py-6 space-y-6">

          {/* KPI strip */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Total Transfers', value: String(totalTransfers), icon: ArrowRightLeft, accent: 'bg-blue-500/15 text-blue-400' },
              { label: 'Total VA Hours', value: String(totalVaHrs), icon: Clock, accent: 'bg-emerald-500/15 text-emerald-400' },
              { label: 'Total NVA Hours', value: String(totalNvaHrs), icon: Activity, accent: 'bg-orange-500/15 text-orange-400' },
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

          {/* recent logs */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Recent Transfers</p>
                <p className="text-xs text-muted-foreground mt-0.5">Latest 5 man-hour transfers</p>
              </div>
              <button onClick={() => setTab('logs')} className="text-xs text-primary hover:underline">View all →</button>
            </div>
            <div className="divide-y divide-border">
              {logs.slice(0, 5).map(l => (
                <div key={l.id} className="grid items-center px-5 py-3 text-sm gap-4" style={{ gridTemplateColumns: '6rem 4rem 1fr 1fr 6rem 6rem' }}>
                  <span className="text-xs font-mono text-muted-foreground">{l.date}</span>
                  <span className="text-xs text-muted-foreground text-center">S{l.shift}</span>
                  <span className="text-xs font-semibold text-foreground">{l.fromWc}</span>
                  <span className="text-xs font-semibold text-foreground">{l.toWc}</span>
                  <span className="text-xs font-mono text-emerald-400 text-right">{l.vaHrs} VA Hrs</span>
                  <span className="text-xs font-mono text-orange-400 text-right">{l.nvaHrs} NVA Hrs</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── LOGS tab ── */}
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
                  {WORKCELLS.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-[140px]">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Shift</Label>
              <Select value={filterShift || '__all__'} onValueChange={v => setFilterShift(v === '__all__' ? '' : v)}>
                <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="All shifts" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All shifts</SelectItem>
                  <SelectItem value="1">Shift 1</SelectItem>
                  <SelectItem value="2">Shift 2</SelectItem>
                  <SelectItem value="3">Shift 3</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DatePickerField id="tmh-date" label="Date" value={filterDate} onChange={setFilterDate} />

            {(filterWc || filterShift || filterDate) && (
              <button onClick={() => { setFilterWc(''); setFilterShift(''); setFilterDate(''); }}
                className="h-9 px-3 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground transition-colors">
                Clear
              </button>
            )}
            <span className="ml-auto text-xs text-muted-foreground mb-2">{filteredLogs.length} records</span>
          </div>

          {/* table */}
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="grid bg-muted/50 border-b border-border text-xs text-muted-foreground font-medium uppercase tracking-wider px-4 py-3 gap-4"
              style={{ gridTemplateColumns: '6rem 4rem 1fr 1fr 5rem 6rem 5rem 6rem' }}>
              <span>Date</span>
              <span className="text-center">Shift</span>
              <span>From</span>
              <span>To</span>
              <span className="text-right">VA HC</span>
              <span className="text-right">VA Hrs</span>
              <span className="text-right">NVA HC</span>
              <span className="text-right">NVA Hrs</span>
            </div>
            {filteredLogs.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">No records match the current filters</div>
            ) : filteredLogs.map(l => (
              <div key={l.id} className="grid items-center px-4 py-3 text-sm border-b border-border last:border-0 hover:bg-muted/30 transition-colors gap-4"
                style={{ gridTemplateColumns: '6rem 4rem 1fr 1fr 5rem 6rem 5rem 6rem' }}>
                <span className="font-mono text-xs text-muted-foreground">{l.date}</span>
                <span className="text-xs text-muted-foreground text-center">S{l.shift}</span>
                <span className="text-xs font-semibold text-foreground">{l.fromWc}</span>
                <span className="text-xs font-semibold text-foreground">{l.toWc}</span>
                <span className="text-xs font-mono text-foreground text-right">{l.vaHc}</span>
                <span className="text-xs font-mono font-semibold text-emerald-400 text-right">{l.vaHrs}</span>
                <span className="text-xs font-mono text-foreground text-right">{l.nvaHc}</span>
                <span className="text-xs font-mono font-semibold text-orange-400 text-right">{l.nvaHrs}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showDialog && (
        <LogDialog onClose={() => setShowDialog(false)}
          onSubmit={log => setLogs(prev => [{ ...log, id: String(Date.now()) }, ...prev])} />
      )}
    </div>
  );
}
