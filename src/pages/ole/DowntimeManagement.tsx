import { cn } from '@/lib/utils';
import {
  AlertTriangle, BarChart2, ChevronDown, ChevronUp,
  Clock, Plus, Users, X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerField } from './OLEFilters';
import { DT_CATEGORIES, MOCK_LOGS, WEEKLY_DT, type DtLog } from './downtime-data';

// ─── helpers ──────────────────────────────────────────────────────────────────

const DEPT_SHORT: Record<string, string> = {
  'Manufacturing (MFG)': 'MFG', 'Manufacturing Engineering (ME)': 'ME',
  'Industrial Engineering (IE)': 'IE', 'Test Engineering (TE)': 'TE',
  'Quality': 'QA', 'Materials': 'MTL', 'Facilities': 'FAC', 'IT': 'IT', 'Other / HR': 'HR',
};

const DEPT_COLOR: Record<string, string> = {
  'Manufacturing (MFG)': 'bg-blue-500/15 text-blue-400',
  'Manufacturing Engineering (ME)': 'bg-violet-500/15 text-violet-400',
  'Industrial Engineering (IE)': 'bg-cyan-500/15 text-cyan-400',
  'Test Engineering (TE)': 'bg-emerald-500/15 text-emerald-400',
  'Quality': 'bg-amber-500/15 text-amber-400',
  'Materials': 'bg-orange-500/15 text-orange-400',
  'Facilities': 'bg-red-500/15 text-red-400',
  'IT': 'bg-slate-500/15 text-slate-400',
  'Other / HR': 'bg-pink-500/15 text-pink-400',
};

// ─── Log Downtime Dialog ───────────────────────────────────────────────────────

function LogDialog({ onClose, onSubmit }: { onClose: () => void; onSubmit: (log: Omit<DtLog, 'id'>) => void }) {
  const [shift, setShift] = useState('Shift A');
  const [bay, setBay] = useState('');
  const [dl, setDl] = useState('');
  const [minutes, setMinutes] = useState('');
  const [commentary, setCommentary] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedCode, setSelectedCode] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const canSubmit = shift && selectedCode && minutes;

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit({
      date: new Date().toISOString().slice(0, 10),
      shift, bay: bay || '—', dl: Number(dl) || 0,
      minutes: Number(minutes), commentary,
      dept: selectedDept, code: selectedCode,
    });
    onClose();
  }

  const inputCls = 'w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary';
  const labelCls = 'block text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl max-h-[90vh] rounded-2xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden">

        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-red-500/15 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-red-400" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Log Downtime Event</p>
              <p className="text-xs text-muted-foreground">Select a category then fill in the details</p>
            </div>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* body */}
        <div className="flex flex-1 overflow-hidden">

          {/* ── Left: form fields ── */}
          <div className="w-80 flex-shrink-0 border-r border-border px-5 py-4 overflow-y-auto space-y-4">

            {/* shift */}
            <div>
              <label className={labelCls}>Shift *</label>
              <div className="flex gap-2">
                {['Shift A', 'Shift B', 'Shift C'].map(s => (
                  <button key={s} onClick={() => setShift(s)}
                    className={cn('flex-1 py-1.5 rounded-lg border text-xs font-medium transition-colors', shift === s ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-foreground/30')}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* selected category display */}
            <div>
              <label className={labelCls}>Category *</label>
              {selectedCode ? (
                <div className={cn('rounded-lg border px-3 py-2 text-xs font-medium', DT_CATEGORIES.find(d => d.dept === selectedDept)?.color ?? '')}>
                  {selectedCode}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                  Select from the right panel →
                </div>
              )}
            </div>

            {/* bay */}
            <div>
              <label className={labelCls}>Bay (optional)</label>
              <input className={inputCls} value={bay} onChange={e => setBay(e.target.value)} placeholder="e.g. B-12" />
            </div>

            {/* DL headcount */}
            <div>
              <label className={labelCls}>Affected VA DL (headcount)</label>
              <input className={inputCls} type="number" min="0" value={dl} onChange={e => setDl(e.target.value)} placeholder="0" />
            </div>

            {/* minutes */}
            <div>
              <label className={labelCls}>Down Time (minutes) *</label>
              <input className={inputCls} type="number" min="1" value={minutes} onChange={e => setMinutes(e.target.value)} placeholder="e.g. 45" />
            </div>

            {/* commentary */}
            <div>
              <label className={labelCls}>Commentary</label>
              <textarea className={cn(inputCls, 'resize-none')} rows={4} value={commentary} onChange={e => setCommentary(e.target.value)} placeholder="Describe what happened…" />
            </div>

            {/* KPI preview */}
            {minutes && dl && (
              <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs space-y-0.5">
                <p className="text-muted-foreground">Lost man-minutes</p>
                <p className="font-mono font-bold text-foreground">{Number(minutes) * Number(dl)} min·person</p>
              </div>
            )}
          </div>

          {/* ── Right: category accordion ── */}
          <div className="flex-1 overflow-y-auto py-3 px-4 space-y-1.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-1 mb-2">Select Downtime Category</p>
            {DT_CATEGORIES.map(dept => (
              <div key={dept.dept} className="rounded-xl border border-border overflow-hidden">
                <button
                  onClick={() => setExpanded(expanded === dept.dept ? null : dept.dept)}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 transition-colors"
                >
                  <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border', dept.color)}>
                    {dept.dept}
                  </span>
                  {expanded === dept.dept ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>
                {expanded === dept.dept && (
                  <div className="px-3 pb-3 pt-1 flex flex-wrap gap-1.5 border-t border-border bg-muted/10">
                    {dept.codes.map(c => {
                      const fullCode = `${c.code} ${c.label}`;
                      const active = selectedCode === fullCode;
                      return (
                        <button key={c.code}
                          onClick={() => { setSelectedCode(fullCode); setSelectedDept(dept.dept); }}
                          className={cn('px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all', active ? 'bg-primary text-primary-foreground border-primary' : cn('border-border text-muted-foreground hover:text-foreground hover:border-foreground/30', dept.color.split(' ').filter(x => x.startsWith('hover') || x.includes('text')).join(' ')))}>
                          <span className="font-mono mr-1 opacity-60">{c.code}</span>{c.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={!canSubmit}
            className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            Submit Log
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Dept badge ───────────────────────────────────────────────────────────────

function DeptBadge({ dept }: { dept: string }) {
  return (
    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap', DEPT_COLOR[dept] ?? 'bg-muted text-muted-foreground')}>
      {DEPT_SHORT[dept] ?? dept}
    </span>
  );
}

// ─── Simple bar chart ─────────────────────────────────────────────────────────

function TrendBar({ data }: { data: typeof WEEKLY_DT }) {
  const maxEvents = Math.max(...data.map(d => d.events));
  return (
    <div className="flex items-end gap-3 h-32">
      {data.map(d => (
        <div key={d.w} className="flex-1 flex flex-col items-center gap-1">
          <span className="text-[10px] font-mono text-muted-foreground">{d.events}</span>
          <div className="w-full rounded-t-md bg-primary/70 transition-all" style={{ height: `${(d.events / maxEvents) * 88}px` }} />
          <span className="text-[10px] text-muted-foreground">{d.w}</span>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

export default function DowntimeManagement() {
  const [tab, setTab] = useState<'overview' | 'logs'>('overview');
  const [logs, setLogs] = useState<DtLog[]>(MOCK_LOGS);
  const [showDialog, setShowDialog] = useState(false);

  // logs tab filters
  const [filterDept, setFilterDept] = useState('');
  const [filterShift, setFilterShift] = useState('');
  const [filterDate, setFilterDate] = useState('');

  const filteredLogs = useMemo(() => logs.filter(l =>
    (!filterDept || l.dept === filterDept) &&
    (!filterShift || l.shift === filterShift) &&
    (!filterDate || l.date === filterDate)
  ), [logs, filterDept, filterShift, filterDate]);

  // dashboard stats
  const totalMins = logs.reduce((s, l) => s + l.minutes, 0);
  const totalEvents = logs.length;
  const totalDL = logs.reduce((s, l) => s + l.dl * l.minutes, 0);

  const tabCls = (t: string) => cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
    tab === t ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border');

  const selectCls = 'h-9 rounded-lg border border-border bg-muted/30 px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary';

  return (
    <div className="space-y-0">

      {/* ── sticky header ── */}
      <div className="sticky top-0 z-20 bg-background border-b border-border px-6">
        <div className="pt-4 pb-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Downtime Management</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Track and analyse production interruptions</p>
          </div>
          <button onClick={() => setShowDialog(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
            <Plus className="h-4 w-4" /> Log Downtime
          </button>
        </div>

        {/* tabs */}
        <div className="flex items-center gap-0 -mb-px">
          <button className={tabCls('overview')} onClick={() => setTab('overview')}>Overview</button>
          <button className={tabCls('logs')} onClick={() => setTab('logs')}>
            Downtime Logs
            <span className="ml-2 text-[10px] font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{logs.length}</span>
          </button>
        </div>
      </div>

      {/* ── OVERVIEW tab ── */}
      {tab === 'overview' && (
        <div className="px-6 py-6 space-y-6">

          {/* KPI strip */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total Events', value: String(totalEvents), icon: AlertTriangle, accent: 'bg-red-500/15 text-red-400' },
              { label: 'Total Downtime', value: `${totalMins} min`, icon: Clock, accent: 'bg-amber-500/15 text-amber-400' },
              { label: 'Lost Man-Minutes', value: `${(totalDL / 1000).toFixed(1)}k`, icon: Users, accent: 'bg-violet-500/15 text-violet-400' },
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

          {/* charts row */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

            {/* trend */}
            <div className="xl:col-span-2 rounded-xl border border-border bg-card p-5">
              <p className="text-sm font-semibold text-foreground mb-0.5">Weekly Event Trend</p>
              <p className="text-xs text-muted-foreground mb-5">Number of downtime events per week</p>
              <TrendBar data={WEEKLY_DT} />
            </div>

            {/* by dept */}
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm font-semibold text-foreground mb-0.5">Top Departments</p>
              <p className="text-xs text-muted-foreground mb-4">Events by responsible dept</p>
              {(() => {
                const counts: Record<string, number> = {};
                logs.forEach(l => { counts[l.dept] = (counts[l.dept] ?? 0) + 1; });
                const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
                const max = sorted[0]?.[1] ?? 1;
                return sorted.map(([dept, count]) => (
                  <div key={dept} className="mb-2.5">
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-muted-foreground">{DEPT_SHORT[dept] ?? dept}</span>
                      <span className="text-xs font-mono font-bold text-foreground">{count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                      <div className="h-full rounded-full bg-primary/70" style={{ width: `${(count / max) * 100}%` }} />
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>

          {/* recent logs */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Recent Logs</p>
                <p className="text-xs text-muted-foreground mt-0.5">Latest 5 downtime entries</p>
              </div>
              <button onClick={() => setTab('logs')} className="text-xs text-primary hover:underline">View all →</button>
            </div>
            <div className="divide-y divide-border">
              {logs.slice(0, 5).map(l => (
                <div key={l.id} className="grid items-center px-5 py-3 text-sm gap-4" style={{ gridTemplateColumns: '6rem 5rem 1fr 5rem 6rem' }}>
                  <span className="text-xs font-mono text-muted-foreground">{l.date}</span>
                  <span className="text-xs text-muted-foreground">{l.shift}</span>
                  <DeptBadge dept={l.dept} />
                  <span className="text-xs font-mono text-foreground text-center">{l.minutes} min</span>
                  <span className="text-xs text-muted-foreground truncate">{l.code.split(' ').slice(0, 2).join(' ')}</span>
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
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Department</Label>
              <Select value={filterDept || '__all__'} onValueChange={v => setFilterDept(v === '__all__' ? '' : v)}>
                <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="All departments" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All departments</SelectItem>
                  {DT_CATEGORIES.map(d => <SelectItem key={d.dept} value={d.dept}>{d.dept}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            
            <div className="min-w-[140px]">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Shift</Label>
              <Select value={filterShift || '__all__'} onValueChange={v => setFilterShift(v === '__all__' ? '' : v)}>
                <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="All shifts" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All shifts</SelectItem>
                  <SelectItem value="Shift A">Shift A</SelectItem>
                  <SelectItem value="Shift B">Shift B</SelectItem>
                  <SelectItem value="Shift C">Shift C</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DatePickerField id="dt-date" label="Date" value={filterDate} onChange={setFilterDate} />

            {(filterDept || filterShift || filterDate) && (
              <button onClick={() => { setFilterDept(''); setFilterShift(''); setFilterDate(''); }}
                className="h-9 px-3 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground transition-colors">
                Clear
              </button>
            )}
            <span className="ml-auto text-xs text-muted-foreground mb-2">{filteredLogs.length} records</span>
          </div>

          {/* table */}
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="grid bg-muted/50 border-b border-border text-xs text-muted-foreground font-medium uppercase tracking-wider px-4 py-3 gap-4"
              style={{ gridTemplateColumns: '6rem 5rem 4rem 1fr 10rem 5rem 5rem' }}>
              <span>Date</span><span>Shift</span><span>Bay</span>
              <span>Category</span><span>Department</span>
              <span className="text-center">DL</span><span className="text-center">Min</span>
            </div>
            {filteredLogs.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">No records match the current filters</div>
            ) : filteredLogs.map(l => (
              <div key={l.id} className="grid items-start px-4 py-3 text-sm border-b border-border last:border-0 hover:bg-muted/30 transition-colors gap-4"
                style={{ gridTemplateColumns: '6rem 5rem 4rem 1fr 10rem 5rem 5rem' }}>
                <span className="font-mono text-xs text-muted-foreground">{l.date}</span>
                <span className="text-xs text-muted-foreground">{l.shift}</span>
                <span className="text-xs font-mono text-foreground">{l.bay}</span>
                <div>
                  <p className="text-xs font-medium text-foreground">{l.code}</p>
                  {l.commentary && <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-xs">{l.commentary}</p>}
                </div>
                <DeptBadge dept={l.dept} />
                <span className="text-xs font-mono text-center text-foreground">{l.dl}</span>
                <span className="text-xs font-mono text-center font-semibold text-amber-400">{l.minutes}</span>
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
