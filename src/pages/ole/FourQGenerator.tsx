import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { oleApi } from '@/lib/oleApi';
import type { OleWorkcellConfig, OleWeeklyResult } from '@/lib/oleApi';
import { ChevronLeft, ChevronRight, Eye, GripVertical, Plus, Printer, Settings, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Bar, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

type SetupMode  = 'plant' | 'workcell';
type ParetoData = { id: string; issue: string; count: number };
type RawData    = { id: string; metric: string; lastWeek: string; thisWeek: string; target: string };
type ActionItem = { id: string; issue: string; rootCause: string; action: string; owner: string; targetDate: string; status: string };
type TrendPoint = { label: string; ole: number; target: number };

const genId = () => Math.random().toString(36).substr(2, 9);

const TT = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8, fontSize: 11,
  color: 'hsl(var(--foreground))',
};

const INIT_PARETO: ParetoData[] = [
  { id: genId(), issue: 'Machine Breakdown', count: 45 },
  { id: genId(), issue: 'Material Shortage', count: 30 },
  { id: genId(), issue: 'Quality Reject',    count: 15 },
  { id: genId(), issue: 'Changeover',        count: 10 },
];

const INIT_RAW: RawData[] = [
  { id: genId(), metric: 'Total Units Produced', lastWeek: '', thisWeek: '', target: '' },
  { id: genId(), metric: 'Total Input Hours',    lastWeek: '', thisWeek: '', target: '' },
  { id: genId(), metric: 'Avg OLE %',           lastWeek: '', thisWeek: '', target: '80%' },
];

// ─── Setup Step ───────────────────────────────────────────────────────────────

function SetupStep({
  workcellConfigs, mode, setMode,
  selectedPlant, setSelectedPlant,
  selectedWorkcells, setSelectedWorkcells,
  onGenerate, generating,
}: {
  workcellConfigs: OleWorkcellConfig[];
  mode: SetupMode; setMode: (m: SetupMode) => void;
  selectedPlant: string; setSelectedPlant: (p: string) => void;
  selectedWorkcells: string[]; setSelectedWorkcells: (w: string[]) => void;
  onGenerate: () => void; generating: boolean;
}) {
  const plants = useMemo(() =>
    Array.from(new Set(workcellConfigs.map(w => w.plant))).sort()
  , [workcellConfigs]);

  const workcellsByPlant = useMemo(() => {
    const map: Record<string, string[]> = {};
    workcellConfigs.forEach(w => {
      if (!map[w.plant]) map[w.plant] = [];
      map[w.plant].push(w.workcell);
    });
    return map;
  }, [workcellConfigs]);

  const canGenerate = (mode === 'plant' && !!selectedPlant) || (mode === 'workcell' && selectedWorkcells.length > 0);

  const toggleWorkcell = (wc: string) =>
    setSelectedWorkcells(selectedWorkcells.includes(wc)
      ? selectedWorkcells.filter(x => x !== wc)
      : [...selectedWorkcells, wc]);

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center">
          <div className="h-12 w-12 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto mb-4">
            <Settings className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Setup 4Q Report</h2>
          <p className="text-sm text-muted-foreground mt-1">Choose the scope for your trend data</p>
        </div>

        <div className="flex rounded-xl border border-border overflow-hidden">
          {(['plant', 'workcell'] as SetupMode[]).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={cn('flex-1 py-3 text-sm font-medium transition-colors',
                mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50')}>
              {m === 'plant' ? 'By Plant' : 'By Workcell'}
            </button>
          ))}
        </div>

        {mode === 'plant' && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Select Plant</Label>
            <div className="flex gap-3">
              {plants.map(p => (
                <button key={p} onClick={() => setSelectedPlant(p)}
                  className={cn('flex-1 py-3 px-4 rounded-xl border text-sm font-semibold transition-all',
                    selectedPlant === p ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground')}>
                  {p}
                  <p className="text-[10px] font-normal mt-0.5 opacity-70">{workcellsByPlant[p]?.length ?? 0} workcells</p>
                </button>
              ))}
            </div>
            {selectedPlant && (
              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Included workcells</p>
                <div className="flex flex-wrap gap-1.5">
                  {workcellsByPlant[selectedPlant]?.map(wc => (
                    <span key={wc} className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">{wc}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {mode === 'workcell' && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">
              Select Workcells <span className="text-primary">({selectedWorkcells.length} selected)</span>
            </Label>
            <div className="space-y-3">
              {plants.map(p => (
                <div key={p}>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-1.5">{p}</p>
                  <div className="flex flex-wrap gap-2">
                    {workcellsByPlant[p]?.map(wc => (
                      <button key={wc} onClick={() => toggleWorkcell(wc)}
                        className={cn('px-3 py-1.5 rounded-lg border text-xs font-medium transition-all',
                          selectedWorkcells.includes(wc) ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground')}>
                        {wc}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground flex items-start gap-2">
          <span className="text-primary font-bold mt-0.5">i</span>
          <span>Trend data will use up to the latest 13 weeks of OLE data. If fewer weeks are available, all existing weeks will be used.</span>
        </div>

        <button onClick={onGenerate} disabled={!canGenerate || generating}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          {generating ? 'Loading data…' : 'Generate 4Q Report →'}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

export default function FourQGenerator() {
  const [title,      setTitle]      = useState('Weekly OLE Performance Review');
  const [tab,        setTab]        = useState<'setup' | 'editor'>('setup');
  const [rightOpen,  setRightOpen]  = useState(true);

  // Setup
  const [workcellConfigs,    setWorkcellConfigs]    = useState<OleWorkcellConfig[]>([]);
  const [mode,               setMode]               = useState<SetupMode>('plant');
  const [selectedPlant,      setSelectedPlant]      = useState('');
  const [selectedWorkcells,  setSelectedWorkcells]  = useState<string[]>([]);
  const [generating,         setGenerating]         = useState(false);

  // Q1 trend
  const [trendData,  setTrendData]  = useState<TrendPoint[]>([]);
  const [trendScope, setTrendScope] = useState('');

  // Q2–Q4
  const [pareto,  setPareto]  = useState(INIT_PARETO);
  const [raw,     setRaw]     = useState(INIT_RAW);
  const [actions, setActions] = useState<ActionItem[]>([]);

  useEffect(() => { oleApi.workcells.list().then(setWorkcellConfigs).catch(() => {}); }, []);

  const paretoComputed = useMemo(() => {
    const sorted = [...pareto].sort((a, b) => b.count - a.count);
    const total = sorted.reduce((s, x) => s + x.count, 0);
    const maxCount = sorted[0]?.count ?? 1;
    let cum = 0;
    return sorted.map(x => {
      cum += x.count;
      const cumActual = total > 0 ? (cum / total) * 100 : 0;
      return { ...x, cumActual, cumScaled: (cumActual / 100) * maxCount };
    });
  }, [pareto]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      let weeklyRows: OleWeeklyResult[] = [];
      let scopeLabel = '';

      if (mode === 'plant') {
        weeklyRows = await oleApi.ole.weekly({ plant: selectedPlant });
        scopeLabel = selectedPlant;
      } else {
        const results = await Promise.all(selectedWorkcells.map(wc => oleApi.ole.weekly({ workcell: wc })));
        weeklyRows = results.flat();
        scopeLabel = selectedWorkcells.join(', ');
      }

      // Aggregate per week across workcells
      const byWeek: Record<string, { smh: number; hrs: number; year: number; week: number }> = {};
      weeklyRows.forEach(r => {
        if (!byWeek[r.week_label]) byWeek[r.week_label] = { smh: 0, hrs: 0, year: r.iso_year, week: r.iso_week };
        byWeek[r.week_label].smh += r.total_output_smh;
        byWeek[r.week_label].hrs += r.total_input_hours;
      });

      const sorted = Object.values(byWeek)
        .sort((a, b) => a.year !== b.year ? a.year - b.year : a.week - b.week)
        .slice(-13);

      setTrendData(sorted.map((w, i) => ({
        label:  `WW${String(w.week).padStart(2, '0')}`,
        ole:    w.hrs > 0 ? Math.round((w.smh / w.hrs) * 10000) / 100 : 0,
        target: 80,
      })));
      setTrendScope(scopeLabel);
      setTab('editor');
    } catch (e) {
      console.error('Failed to fetch OLE data', e);
    } finally {
      setGenerating(false);
    }
  }

  // ── Q1 ────────────────────────────────────────────────────────────────────
  const renderQ1 = () => (
    <div style={{ height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis domain={[0, 120]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={TT} formatter={(v: number, n: string) => [`${v.toFixed(1)}%`, n]} />
          <Bar dataKey="ole" name="OLE %" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
            {trendData.map((_, i) => <Cell key={i} fill="hsl(var(--primary))" />)}
          </Bar>
          <Line type="monotone" dataKey="target" name="Target 80%" stroke="#22c55e"
            strokeWidth={1.5} strokeDasharray="5 4" dot={false} activeDot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );

  // ── Q2 ────────────────────────────────────────────────────────────────────
  const renderQ2 = () => (
    <div style={{ height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={paretoComputed} margin={{ top: 10, right: 10, left: -20, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="issue" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={0} angle={-30} textAnchor="end" height={50} />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={TT} formatter={(v: number, n: string, p: any) => [
            n === 'Cumulative %' ? `${p.payload.cumActual.toFixed(1)}%` : String(v), n
          ]} />
          <Bar dataKey="count" name="Frequency" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={40} />
          <Line type="monotone" dataKey="cumScaled" name="Cumulative %" stroke="#ef4444"
            strokeWidth={2} dot={{ r: 3, fill: '#ef4444' }} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );

  // ── Q3 ────────────────────────────────────────────────────────────────────
  const renderQ3 = (isPrint = false) => (
    <div className="overflow-x-auto border border-border rounded w-full">
      <table className={cn('w-full text-left', isPrint ? 'text-[10px]' : 'text-xs')}>
        <thead className="bg-muted/50 text-muted-foreground uppercase">
          <tr>
            <th className="px-3 py-2 border-b border-border">Metric</th>
            <th className="px-3 py-2 border-b border-border text-right">Target</th>
            <th className="px-3 py-2 border-b border-border text-right">Last Wk</th>
            <th className="px-3 py-2 border-b border-border text-right">This Wk</th>
          </tr>
        </thead>
        <tbody>
          {raw.length === 0
            ? <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground text-xs">No data added</td></tr>
            : raw.map(r => (
              <tr key={r.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2 font-semibold">{r.metric}</td>
                <td className="px-3 py-2 text-right">{r.target}</td>
                <td className="px-3 py-2 text-right text-muted-foreground">{r.lastWeek}</td>
                <td className="px-3 py-2 text-right font-mono">{r.thisWeek}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );

  // ── Q4 ────────────────────────────────────────────────────────────────────
  const renderQ4 = (isPrint = false) => (
    <div className="overflow-x-auto border border-border rounded w-full">
      <table className={cn('w-full text-left', isPrint ? 'text-[10px]' : 'text-xs')}>
        <thead className="bg-muted/50 text-muted-foreground uppercase">
          <tr>
            <th className="px-2 py-2 border-b border-border">Issue</th>
            <th className="px-2 py-2 border-b border-border">Root Cause</th>
            <th className="px-2 py-2 border-b border-border">Action</th>
            <th className="px-2 py-2 border-b border-border">Owner</th>
            <th className="px-2 py-2 border-b border-border">Date</th>
            <th className="px-2 py-2 border-b border-border">Status</th>
          </tr>
        </thead>
        <tbody>
          {actions.length === 0
            ? <tr><td colSpan={6} className="px-2 py-6 text-center text-muted-foreground text-xs">No actions added</td></tr>
            : actions.map(a => (
              <tr key={a.id} className="border-b border-border last:border-0">
                <td className="px-2 py-2 font-medium max-w-[120px] truncate">{a.issue}</td>
                <td className="px-2 py-2 max-w-[160px] truncate">{a.rootCause}</td>
                <td className="px-2 py-2 max-w-[160px] truncate">{a.action}</td>
                <td className="px-2 py-2">{a.owner}</td>
                <td className="px-2 py-2 whitespace-nowrap">{a.targetDate}</td>
                <td className="px-2 py-2 font-medium whitespace-nowrap">{a.status}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );

  const PreviewModal = () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="default" size="sm" className="gap-2"><Eye className="w-4 h-4" /> Preview Report</Button>
      </DialogTrigger>
      <DialogContent className="max-w-[1200px] w-[95vw] h-[90vh] p-0 flex flex-col gap-0 border-none bg-transparent shadow-none">
        <div className="bg-card border border-border rounded-t-xl px-6 py-4 flex items-center justify-between print:hidden shadow-md z-10">
          <div><h2 className="font-semibold text-lg">Report Preview</h2><p className="text-xs text-muted-foreground">This is how your final report will look when printed.</p></div>
          <Button onClick={() => window.print()} className="gap-2"><Printer className="w-4 h-4" /> Print PDF</Button>
        </div>
        <div className="bg-muted p-8 flex-1 overflow-y-auto rounded-b-xl border border-t-0 border-border">
          <div className="max-w-[1100px] mx-auto bg-card border border-border shadow-sm p-6 h-full flex flex-col">
            <div className="border-b-2 border-primary pb-3 mb-6 flex items-center justify-between flex-shrink-0">
              <h1 className="text-2xl font-bold text-foreground uppercase">{title}</h1>
              <div className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">JABIL 4Q REPORT</div>
            </div>
            <div className="grid grid-cols-2 gap-6 flex-1" style={{ gridTemplateRows: '1fr 1fr' }}>
              {[
                { label: 'Performance Trend', color: 'text-primary', bg: 'bg-primary', n: '1', content: renderQ1() },
                { label: 'Top Drivers / Pareto', color: 'text-orange-500', bg: 'bg-orange-500', n: '2', content: renderQ2() },
                { label: 'Data Summary', color: 'text-blue-500', bg: 'bg-blue-500', n: '3', content: <div className="flex-1 min-h-0 overflow-auto">{renderQ3(true)}</div> },
                { label: 'Action Plan', color: 'text-emerald-500', bg: 'bg-emerald-500', n: '4', content: <div className="flex-1 min-h-0 overflow-auto">{renderQ4(true)}</div> },
              ].map(q => (
                <div key={q.n} className="border border-border rounded-lg p-4 flex flex-col h-full overflow-hidden">
                  <h2 className={cn('text-sm font-bold uppercase mb-2 flex items-center gap-2 flex-shrink-0', q.color)}>
                    <span className={cn('text-white w-5 h-5 rounded flex items-center justify-center text-xs', q.bg)}>{q.n}</span>
                    {q.label}{q.n === '1' ? ` · ${trendScope}` : ''}
                  </h2>
                  {q.content}
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="flex flex-col h-full w-full bg-background overflow-hidden relative">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0 bg-card">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">4Q Generator</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {tab === 'setup' ? 'Set up your scope to generate the trend data' : `Scope: ${trendScope} · ${trendData.length} weeks`}
            </p>
          </div>
          {tab === 'editor' && (
            <button onClick={() => setTab('setup')}
              className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 transition-colors">
              ← Change Scope
            </button>
          )}
        </div>
        {tab === 'editor' && <PreviewModal />}
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {tab === 'setup' && (
          <SetupStep
            workcellConfigs={workcellConfigs}
            mode={mode} setMode={setMode}
            selectedPlant={selectedPlant} setSelectedPlant={setSelectedPlant}
            selectedWorkcells={selectedWorkcells} setSelectedWorkcells={setSelectedWorkcells}
            onGenerate={handleGenerate} generating={generating}
          />
        )}

        {tab === 'editor' && (
          <>
            {/* Main content */}
            <div className="flex-1 overflow-y-auto p-8">
              <div className="max-w-5xl mx-auto space-y-12 pb-16">

                {[
                  { n: '1', label: 'Performance Trend', color: 'text-primary', bg: 'bg-primary', sub: `— ${trendScope} · ${trendData.length} weeks`, content: trendData.length === 0 ? <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No data — go back to setup</div> : renderQ1() },
                  { n: '2', label: 'Top Drivers / Pareto', color: 'text-orange-500', bg: 'bg-orange-500', sub: '', content: renderQ2() },
                  { n: '3', label: 'Data Summary', color: 'text-blue-500', bg: 'bg-blue-500', sub: '', content: renderQ3() },
                  { n: '4', label: 'Action Plan', color: 'text-emerald-500', bg: 'bg-emerald-500', sub: '', content: renderQ4() },
                ].map(q => (
                  <div key={q.n} className="space-y-4">
                    <h2 className={cn('text-xl font-bold uppercase flex items-center gap-2', q.color)}>
                      <span className={cn('text-primary-foreground w-7 h-7 rounded flex items-center justify-center text-sm', q.bg)}>{q.n}</span>
                      {q.label}
                      {q.sub && <span className="text-sm font-normal text-muted-foreground normal-case ml-2">{q.sub}</span>}
                    </h2>
                    <div className="bg-card border border-border rounded-xl p-6 shadow-sm">{q.content}</div>
                  </div>
                ))}

              </div>
            </div>

            {/* Right editor panel */}
            <div className={cn('border-l border-border bg-card/95 backdrop-blur-md transition-all duration-300 ease-in-out shadow-2xl flex flex-col flex-shrink-0 z-10', rightOpen ? 'w-[440px]' : 'w-12')}>
              <div
                className={cn('flex items-center cursor-pointer hover:bg-muted/50 transition-colors border-b border-border flex-shrink-0', rightOpen ? 'justify-between px-6 h-14' : 'justify-center h-14')}
                onClick={() => setRightOpen(!rightOpen)}>
                {rightOpen
                  ? <><span className="text-sm font-bold text-foreground">Data Editor</span><div className="p-1.5 rounded-md bg-primary/10 text-primary"><ChevronRight className="h-4 w-4" /></div></>
                  : <div className="p-1.5 rounded-md bg-primary/10 text-primary"><ChevronLeft className="h-4 w-4" /></div>}
              </div>

              {rightOpen && (
                <div className="flex-1 overflow-hidden p-4 flex flex-col min-h-0">
                  <Tabs defaultValue="q1" className="h-full flex flex-col min-h-0">
                    <TabsList className="w-full flex-wrap justify-start rounded-none border-b border-border bg-transparent h-auto p-0 gap-x-4 gap-y-2 pb-2">
                      {[
                        { v: 'q1', label: 'Q1 Trend',    active: 'border-primary' },
                        { v: 'q2', label: 'Q2 Pareto',   active: 'border-orange-500' },
                        { v: 'q3', label: 'Q3 Data',     active: 'border-blue-500' },
                        { v: 'q4', label: 'Q4 Actions',  active: 'border-emerald-500' },
                        { v: 'settings', label: 'Settings', active: 'border-muted-foreground' },
                      ].map(t => (
                        <TabsTrigger key={t.v} value={t.v}
                          className={cn('rounded-none border-b-2 border-transparent data-[state=active]:bg-transparent px-1 py-1 shadow-none text-xs', `data-[state=active]:${t.active}`, t.v === 'settings' && 'ml-auto')}>
                          {t.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>

                    <div className="flex-1 overflow-y-auto mt-4 pr-2">

                      {/* Q1 Editor */}
                      <TabsContent value="q1" className="m-0 space-y-3">
                        <div className="flex justify-between items-center">
                          <p className="text-[11px] text-muted-foreground">Auto-populated from API. Edit manually if needed.</p>
                          <Button variant="outline" size="sm" className="h-7 text-[11px]"
                            onClick={() => setTrendData([...trendData, { label: `WW${String(trendData.length + 1).padStart(2, '0')}`, ole: 0, target: 80 }])}>
                            <Plus className="w-3 h-3 mr-1" /> Add
                          </Button>
                        </div>
                        <div className="grid gap-1 px-7 text-[10px] text-muted-foreground uppercase tracking-wider" style={{ gridTemplateColumns: '1fr 1fr 3.5rem' }}>
                          <span>Label</span><span>OLE %</span><span>Target</span>
                        </div>
                        {trendData.map((t, i) => (
                          <div key={i}
                            draggable
                            onDragStart={e => e.dataTransfer.setData('text/plain', String(i))}
                            onDragOver={e => e.preventDefault()}
                            onDrop={e => {
                              e.preventDefault();
                              const from = Number(e.dataTransfer.getData('text/plain'));
                              if (from === i) return;
                              const n = [...trendData];
                              const [moved] = n.splice(from, 1);
                              n.splice(i, 0, moved);
                              setTrendData(n);
                            }}
                            className="flex items-center gap-2 bg-muted/30 p-2 rounded border border-border cursor-grab active:cursor-grabbing active:opacity-60 transition-opacity">
                            <GripVertical className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
                            <div className="flex items-center gap-2 flex-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 3.5rem' }}>
                              <Input value={t.label} onChange={e => { const n = [...trendData]; n[i] = { ...n[i], label: e.target.value }; setTrendData(n); }} placeholder="Label" className="h-7 text-xs" />
                              <Input type="number" value={t.ole} onChange={e => { const n = [...trendData]; n[i] = { ...n[i], ole: Number(e.target.value) }; setTrendData(n); }} className="h-7 text-xs" />
                              <Input type="number" value={t.target} onChange={e => { const n = [...trendData]; n[i] = { ...n[i], target: Number(e.target.value) }; setTrendData(n); }} className="h-7 text-xs" />
                            </div>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive flex-shrink-0" onClick={() => setTrendData(trendData.filter((_, j) => j !== i))}><Trash2 className="w-3.5 h-3.5" /></Button>
                          </div>
                        ))}
                      </TabsContent>

                      {/* Q2 Editor */}
                      <TabsContent value="q2" className="m-0 space-y-3">
                        <div className="flex justify-between items-center">
                          <p className="text-[11px] text-muted-foreground">Add issues and frequencies for the Pareto chart.</p>
                          <Button variant="outline" size="sm" className="h-7 text-[11px]"
                            onClick={() => setPareto([...pareto, { id: genId(), issue: '', count: 0 }])}>
                            <Plus className="w-3 h-3 mr-1" /> Add
                          </Button>
                        </div>
                        {pareto.map((p, i) => (
                          <div key={p.id} className="flex items-center gap-2 bg-muted/30 p-2 rounded border border-border">
                            <Input value={p.issue} onChange={e => { const n = [...pareto]; n[i].issue = e.target.value; setPareto(n); }} placeholder="Issue" className="h-7 text-xs flex-1" />
                            <Input type="number" value={p.count} onChange={e => { const n = [...pareto]; n[i].count = Number(e.target.value); setPareto(n); }} placeholder="Freq" className="h-7 text-xs w-20" />
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setPareto(pareto.filter(x => x.id !== p.id))}><Trash2 className="w-3.5 h-3.5" /></Button>
                          </div>
                        ))}
                      </TabsContent>

                      {/* Q3 Editor */}
                      <TabsContent value="q3" className="m-0 space-y-3">
                        <div className="flex justify-between items-center">
                          <p className="text-[11px] text-muted-foreground">Add raw metrics and targets.</p>
                          <Button variant="outline" size="sm" className="h-7 text-[11px]"
                            onClick={() => setRaw([...raw, { id: genId(), metric: '', lastWeek: '', thisWeek: '', target: '' }])}>
                            <Plus className="w-3 h-3 mr-1" /> Add
                          </Button>
                        </div>
                        {raw.map((r, i) => (
                          <div key={r.id} className="flex flex-col gap-2 bg-muted/30 p-2 rounded border border-border">
                            <div className="flex gap-2">
                              <Input value={r.metric} onChange={e => { const n = [...raw]; n[i].metric = e.target.value; setRaw(n); }} placeholder="Metric" className="h-7 text-xs flex-1 font-semibold" />
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={() => setRaw(raw.filter(x => x.id !== r.id))}><Trash2 className="w-3.5 h-3.5" /></Button>
                            </div>
                            <div className="flex gap-2">
                              <Input value={r.target}   onChange={e => { const n = [...raw]; n[i].target   = e.target.value; setRaw(n); }} placeholder="Target"  className="h-7 text-xs w-1/3" />
                              <Input value={r.lastWeek} onChange={e => { const n = [...raw]; n[i].lastWeek = e.target.value; setRaw(n); }} placeholder="Last Wk" className="h-7 text-xs w-1/3" />
                              <Input value={r.thisWeek} onChange={e => { const n = [...raw]; n[i].thisWeek = e.target.value; setRaw(n); }} placeholder="This Wk" className="h-7 text-xs w-1/3 font-mono" />
                            </div>
                          </div>
                        ))}
                      </TabsContent>

                      {/* Q4 Editor */}
                      <TabsContent value="q4" className="m-0 space-y-3">
                        <div className="flex justify-between items-center">
                          <p className="text-[11px] text-muted-foreground">Track corrective actions.</p>
                          <Button variant="outline" size="sm" className="h-7 text-[11px]"
                            onClick={() => setActions([...actions, { id: genId(), issue: '', rootCause: '', action: '', owner: '', targetDate: '', status: 'Open' }])}>
                            <Plus className="w-3 h-3 mr-1" /> Add
                          </Button>
                        </div>
                        {actions.map((a, i) => (
                          <div key={a.id} className="flex flex-col gap-2 bg-muted/30 p-2 rounded border border-border">
                            <div className="flex gap-2">
                              <Input value={a.issue} onChange={e => { const n = [...actions]; n[i].issue = e.target.value; setActions(n); }} placeholder="Issue" className="h-7 text-xs flex-1" />
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={() => setActions(actions.filter(x => x.id !== a.id))}><Trash2 className="w-3.5 h-3.5" /></Button>
                            </div>
                            <Input value={a.rootCause} onChange={e => { const n = [...actions]; n[i].rootCause = e.target.value; setActions(n); }} placeholder="Root Cause" className="h-7 text-xs" />
                            <Input value={a.action}    onChange={e => { const n = [...actions]; n[i].action    = e.target.value; setActions(n); }} placeholder="Corrective Action" className="h-7 text-xs" />
                            <div className="flex gap-2">
                              <Input value={a.owner}      onChange={e => { const n = [...actions]; n[i].owner      = e.target.value; setActions(n); }} placeholder="Owner"  className="h-7 text-xs w-1/3" />
                              <Input value={a.targetDate} onChange={e => { const n = [...actions]; n[i].targetDate = e.target.value; setActions(n); }} type="date" className="h-7 text-xs w-1/3" />
                              <Input value={a.status}     onChange={e => { const n = [...actions]; n[i].status     = e.target.value; setActions(n); }} placeholder="Status" className="h-7 text-xs w-1/3" />
                            </div>
                          </div>
                        ))}
                      </TabsContent>

                      {/* Settings */}
                      <TabsContent value="settings" className="m-0 space-y-4 max-w-sm">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Report Title</Label>
                          <Input value={title} onChange={e => setTitle(e.target.value)} className="h-8 text-xs" />
                        </div>
                      </TabsContent>

                    </div>
                  </Tabs>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white; }
          body > :not([role="dialog"]) { display: none !important; }
        }
      `}} />
    </div>
  );
}
