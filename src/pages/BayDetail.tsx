import { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useProductionSummary } from '@/hooks/useMesData';
import { generateMachines, generateHourlyData, generateDowntimeLog, operators } from '@/mocks/data';
import MachineCard from '@/components/dashboard/MachineCard';
import { statusText, statusBg } from '@/components/StatusIndicator';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { ArrowLeft, Maximize2, ChevronUp, ChevronDown, Search } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import type { Machine, StatusLevel } from '@/types';

const WORKCELL_LOGOS: Record<string, string> = {
  arista:   '/workcell logo/Arista.png',
  keysight: '/workcell logo/keyisght.png',
  aop:      '/workcell logo/aop.png',
  micron:   '/workcell logo/micron.png',
};

function WorkcellLogo({ workcellId }: { workcellId: string }) {
  const [err, setErr] = useState(false);
  const src = WORKCELL_LOGOS[workcellId];
  if (!src || err) return null;
  return (
    <div
      className="w-24 h-12 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center ring-1 ring-border"
      style={{ background: '#ffffff' }}
    >
      <img src={src} alt={workcellId} onError={() => setErr(true)} className="w-full h-full object-contain p-1.5" />
    </div>
  );
}

const STATUS_PILL: Record<StatusLevel, { label: string; cls: string }> = {
  optimal: { label: 'Active', cls: 'bg-status-optimal text-white' },
  warning: { label: 'Warn', cls: 'bg-status-warning text-white' },
  critical: { label: 'Crit', cls: 'bg-status-critical text-white animate-pulse' },
  idle: { label: 'Idle', cls: 'bg-status-idle text-white' },
};

type SortKey = 'name' | 'uph' | 'wipCount';
type SortDir = 'asc' | 'desc';

function FormSquares({ data }: { data: number[] }) {
  const last5 = data.slice(-5);
  return (
    <div className="flex gap-0.5">
      {last5.map((v, i) => {
        let bg = 'bg-status-idle';
        if (v > 75) bg = 'bg-status-optimal';
        else if (v > 40) bg = 'bg-status-warning';
        else if (v > 0) bg = 'bg-status-critical';
        return <span key={i} className={cn('h-3 w-3 rounded-sm', bg)} />;
      })}
    </div>
  );
}

function PlanActualBar({ plan, actual, status }: { plan: number; actual: number; status: StatusLevel }) {
  const pct = plan > 0 ? Math.min((actual / plan) * 100, 100) : 0;
  const barColor = {
    optimal: 'bg-status-optimal',
    warning: 'bg-status-warning',
    critical: 'bg-status-critical',
    idle: 'bg-status-idle',
  }[status];
  return (
    <div className="flex items-center gap-1.5 min-w-[120px]">
      <span className="text-xs font-mono text-card-foreground w-6 text-right">{actual}</span>
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full', barColor)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-muted-foreground w-6">{plan}</span>
    </div>
  );
}

export default function BayDetail() {
  const { id } = useParams<{ id: string }>();   // format: WORKCELL__BAY
  const navigate = useNavigate();

  // Parse workcell + bay from compound ID
  const [workcellName, bayName] = useMemo(() => {
    if (!id) return ['', ''];
    const parts = decodeURIComponent(id).split('__');
    return [parts[0] ?? '', parts[1] ?? ''];
  }, [id]);

  const { data: apiProduction, loading: apiLoading } = useProductionSummary();

  // Find matching production row
  const apiRow = useMemo(
    () => apiProduction?.find(p => p.workcell_name === workcellName && p.bay === bayName) ?? null,
    [apiProduction, workcellName, bayName]
  );

  // Build a synthetic bay object:
  // ─ Real API data: productivity, plan, cumm, delta, overallWip, pendingWip
  // ─ Mock generators (seeded by bayName so same bay = same data every visit):
  //   machines, hourlyData, downtimeLog, operatorOnDuty
  const bay = useMemo(() => {
    if (!apiRow) return null;
    const pct = apiRow.total_steps
      ? Math.min(100, Math.round((apiRow.total_output / apiRow.total_steps) * 100))
      : 0;
    const seed = `${workcellName}__${bayName}`;
    // Hash seed to a stable operator index
    let opHash = 0;
    for (let i = 0; i < seed.length; i++) opHash = (opHash * 31 + seed.charCodeAt(i)) & 0xffff;
    return {
      id,
      name:           bayName,
      workcellId:     workcellName.toLowerCase(),
      plant:          (apiRow as any).plant ?? 'P1',
      area:           bayName,
      model:          'SMT Line',
      productivity:   pct,
      status:         pct > 85 ? 'optimal' : pct >= 50 ? 'warning' : pct > 0 ? 'critical' : 'idle',
      // ─ Real numbers from API ─
      plan:           apiRow.total_steps   ?? 0,
      cumm:           apiRow.total_output  ?? 0,
      delta:          (apiRow.total_output ?? 0) - (apiRow.total_steps ?? 0),
      overallWip:     apiRow.total_assemblies ?? 0,
      pendingWip:     apiRow.total_batches    ?? 0,
      // ─ Mock-generated but deterministic per bay ─
      operatorOnDuty: operators[opHash % operators.length],
      hourlyData:     generateHourlyData(seed),
      downtimeLog:    generateDowntimeLog(seed),
      machines:       generateMachines(seed),
    };
  }, [apiRow, id, bayName, workcellName]);

  const isLoading = apiLoading && !bay;
  const machines = (bay as any)?.machines ?? [];

  const [activeTab, setActiveTab] = useState<'overview' | 'downtime' | 'history' | 'machines'>('overview');
  const [search, setSearch] = useState('');
  const [hideIdle, setHideIdle] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const filteredMachines = useMemo(() => {
    let list = [...machines];
    if (search) list = list.filter(m => m.name.toLowerCase().includes(search.toLowerCase()));
    if (hideIdle) list = list.filter(m => m.status !== 'idle');
    list.sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1;
      if (sortKey === 'name') return mul * a.name.localeCompare(b.name);
      return mul * ((a[sortKey] as number) - (b[sortKey] as number));
    });
    return list;
  }, [machines, search, hideIdle, sortKey, sortDir]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-96 w-full rounded-lg" />
      </div>
    );
  }

  if (!bay) return <p className="text-muted-foreground">Bay not found.</p>;

  const activeMachines = machines.filter(m => m.status !== 'idle').length;
  const tabs = [
    { key: 'overview' as const, label: 'Overview' },
    { key: 'downtime' as const, label: 'Downtime Log' },
    { key: 'history' as const, label: 'History' },
    { key: 'machines' as const, label: 'Machines' },
  ];

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ChevronUp className="h-3 w-3 opacity-30" />;
    return sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  };

  // derive plan for each machine row from bay hourly avg
  const avgPlan = bay.hourlyData.length > 0
    ? Math.round(bay.hourlyData.reduce((s, h) => s + h.plan, 0) / bay.hourlyData.length)
    : 0;

  return (
    <div className="space-y-0">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-background border-b border-border pb-0 px-6">
        {/* Top row */}
        <div className="flex items-center justify-between px-1 py-2">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <button onClick={() => navigate(-1)} className="flex items-center gap-1 hover:text-foreground transition-colors mr-1">
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
            <span className="text-border">|</span>
            <Link to="/pulse/workcells" className="hover:text-foreground transition-colors">Workcells</Link>
            <span>/</span>
            {workcellName && (
              <><Link to={`/pulse/workcell/${encodeURIComponent(workcellName)}`} className="hover:text-foreground transition-colors">{workcellName}</Link><span>/</span></>
            )}
            <span className="text-foreground font-medium">{bay.name}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate(`/kiosk/${bay.id}`)}>
            <Maximize2 className="h-3.5 w-3.5 mr-1" /> Kiosk
          </Button>
        </div>

        {/* Title row */}
        <div className="flex items-center gap-3 px-1 pb-2">
          <WorkcellLogo workcellId={bay.workcellId} />
          <h1 className="text-xl font-semibold text-foreground">{bay.name}</h1>
          <Badge className={cn('text-xs', statusBg(bay.status) === 'bg-status-optimal' ? 'bg-status-optimal' : '', {
            'bg-status-optimal text-white': bay.status === 'optimal',
            'bg-status-warning text-white': bay.status === 'warning',
            'bg-status-critical text-white': bay.status === 'critical',
            'bg-status-idle text-white': bay.status === 'idle',
          })}>{bay.productivity}%</Badge>
          <span className="text-xs text-muted-foreground">{bay.model} · Operator: {bay.operatorOnDuty}</span>
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-1 pb-3 text-xs font-mono border-b border-border">
          <span className="text-muted-foreground">Active: <span className="text-foreground font-semibold">{activeMachines}/{machines.length}</span></span>
          <span className="text-muted-foreground">Total WIP: <span className="text-foreground font-semibold">{bay.overallWip}</span></span>
          <span className="text-muted-foreground">Pending: <span className="text-foreground font-semibold">{bay.pendingWip}↑</span></span>
          <span className="text-muted-foreground">Plan: <span className="text-foreground font-semibold">{bay.plan}</span></span>
          <span className="text-muted-foreground">CUMM: <span className="text-foreground font-semibold">{bay.cumm}</span></span>
          <span className={cn('text-muted-foreground')}>DELTA: <span className={cn('font-semibold', bay.delta < 0 ? 'text-destructive' : 'text-status-optimal')}>{bay.delta < 0 ? `${bay.delta}↓` : `+${bay.delta}↑`}</span></span>
        </div>

        {/* Tab bar */}
        <div className="flex gap-0 px-1">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium transition-colors border-b-2',
                activeTab === t.key
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="pt-4 px-6 pb-6">
        {activeTab === 'overview' && (
          <div className="space-y-3">
            {/* Controls */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filter machines…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
              <Button
                variant={hideIdle ? 'default' : 'outline'}
                size="sm"
                onClick={() => setHideIdle(!hideIdle)}
              >
                Hide idle
              </Button>
            </div>

            {/* Table */}
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-10">#</TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('name')}>
                      <span className="flex items-center gap-1">Machine <SortIcon k="name" /></span>
                    </TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('uph')}>
                      <span className="flex items-center gap-1">UPH% <SortIcon k="uph" /></span>
                    </TableHead>
                    <TableHead>Plan vs Actual</TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('wipCount')}>
                      <span className="flex items-center gap-1">WIP <SortIcon k="wipCount" /></span>
                    </TableHead>
                    <TableHead>Trend</TableHead>
                    <TableHead>Form</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMachines.map((m, idx) => {
                    const pill = STATUS_PILL[m.status];
                    return (
                      <TableRow
                        key={m.id}
                        className="cursor-pointer hover:bg-muted/40 transition-colors"
                        onClick={() => setSelectedMachine(m)}
                      >
                        <TableCell className="font-mono text-xs text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell>
                          <p className="font-semibold text-sm text-card-foreground">{m.name}</p>
                          <p className="text-xs text-muted-foreground">{bay.model}</p>
                        </TableCell>
                        <TableCell>
                          <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold', pill.cls)}>
                            {pill.label}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={cn('text-lg font-mono font-bold', statusText(m.status))}>{m.uph}%</span>
                          <div className="h-1 w-16 rounded-full bg-muted mt-1 overflow-hidden">
                            <div className={cn('h-full rounded-full', statusBg(m.status))} style={{ width: `${m.uph}%` }} />
                          </div>
                        </TableCell>
                        <TableCell>
                          <PlanActualBar plan={avgPlan} actual={Math.round(avgPlan * m.uph / 100)} status={m.status} />
                        </TableCell>
                        <TableCell>
                          <span className={cn('font-mono text-sm', m.wipCount > 40 ? 'text-destructive font-bold' : 'text-card-foreground')}>
                            {m.wipCount}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="w-[72px] h-6">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={m.sparklineData.slice(-8).map((v, i) => ({ v, i }))}>
                                <Line type="monotone" dataKey="v" stroke="hsl(var(--primary))" strokeWidth={1.5} dot={false} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </TableCell>
                        <TableCell>
                          <FormSquares data={m.sparklineData} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {activeTab === 'downtime' && (
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bay.downtimeLog.map((d, i) => {
                  const mins = parseInt(d.duration);
                  return (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-sm">{d.timestamp}</TableCell>
                      <TableCell className={cn('font-mono text-sm font-semibold', mins > 10 ? 'text-destructive' : 'text-card-foreground')}>{d.duration}</TableCell>
                      <TableCell className="text-sm">{d.reason}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="text-sm font-semibold text-card-foreground mb-3">Plan vs Actual — Last 12h</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bay.hourlyData} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="hour" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '0.5rem', fontSize: 12 }} />
                    <Bar dataKey="plan" fill="hsl(var(--muted-foreground))" radius={[3, 3, 0, 0]} name="Plan" />
                    <Bar dataKey="actual" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} name="Actual" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Avg UPH', value: `${(bay.hourlyData.reduce((s, h) => s + h.actual, 0) / bay.hourlyData.length).toFixed(0)}` },
                { label: 'Plan Cumm', value: bay.plan },
                { label: 'Actual Cumm', value: bay.cumm },
              ].map(s => (
                <div key={s.label} className="rounded-lg border border-border bg-card p-4 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{s.label}</p>
                  <p className="text-2xl font-mono font-bold text-card-foreground">{s.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'machines' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {machines.map(m => (
              <MachineCard key={m.id} machine={m} />
            ))}
          </div>
        )}
      </div>

      {/* Machine detail sheet */}
      <Sheet open={!!selectedMachine} onOpenChange={o => !o && setSelectedMachine(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto bg-card">
          {selectedMachine && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <SheetTitle className="text-card-foreground">{selectedMachine.name}</SheetTitle>
                  <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold', STATUS_PILL[selectedMachine.status].cls)}>
                    {STATUS_PILL[selectedMachine.status].label}
                  </span>
                </div>
                <p className={cn('text-2xl font-mono font-bold', statusText(selectedMachine.status))}>
                  {selectedMachine.uph}%
                </p>
              </SheetHeader>

              <div className="mt-4 space-y-5">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-md bg-muted p-2">
                    <p className="text-[10px] text-muted-foreground uppercase">Model</p>
                    <p className="text-sm font-semibold text-card-foreground">{bay.model}</p>
                  </div>
                  <div className="rounded-md bg-muted p-2">
                    <p className="text-[10px] text-muted-foreground uppercase">Operator</p>
                    <p className="text-sm font-semibold text-card-foreground">{bay.operatorOnDuty}</p>
                  </div>
                  <div className="rounded-md bg-muted p-2">
                    <p className="text-[10px] text-muted-foreground uppercase">WIP</p>
                    <p className={cn('text-sm font-mono font-semibold', selectedMachine.wipCount > 40 ? 'text-destructive' : 'text-card-foreground')}>
                      {selectedMachine.wipCount}
                    </p>
                  </div>
                </div>

                {/* Hourly chart */}
                <div>
                  <h3 className="text-sm font-semibold text-card-foreground mb-2">Hourly UPH — Plan vs Actual</h3>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={bay.hourlyData} barGap={2}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="hour" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                        <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '0.5rem', fontSize: 12 }} />
                        <Bar dataKey="plan" fill="hsl(var(--muted-foreground))" radius={[3, 3, 0, 0]} name="Plan" />
                        <Bar dataKey="actual" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} name="Actual" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Downtime */}
                <div>
                  <h3 className="text-sm font-semibold text-card-foreground mb-2">Downtime Log</h3>
                  <div className="space-y-1.5">
                    {bay.downtimeLog.map((d, i) => (
                      <div key={i} className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
                        <span className="font-mono text-muted-foreground">{d.timestamp}</span>
                        <span className="text-destructive font-medium">{d.duration}</span>
                        <span className="text-card-foreground">{d.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* UPH trend area chart */}
                <div>
                  <h3 className="text-sm font-semibold text-card-foreground mb-2">UPH Trend</h3>
                  <div className="h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={selectedMachine.sparklineData.map((v, i) => ({ v, i }))}>
                        <defs>
                          <linearGradient id="uphGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="v" stroke="hsl(var(--primary))" fill="url(#uphGrad)" strokeWidth={2} dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
