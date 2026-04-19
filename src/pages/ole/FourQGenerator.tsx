import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Eye, Plus, Printer, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

type TrendData = { id: string; label: string; value: number };
type ParetoData = { id: string; issue: string; count: number };
type RawData = { id: string; metric: string; lastWeek: string; thisWeek: string; target: string };
type ActionItem = { id: string; issue: string; rootCause: string; action: string; owner: string; targetDate: string; status: string };

const genId = () => Math.random().toString(36).substr(2, 9);

// ─── Initial State ────────────────────────────────────────────────────────────

const INIT_TREND: TrendData[] = [
  { id: genId(), label: 'W10', value: 72 },
  { id: genId(), label: 'W11', value: 75 },
  { id: genId(), label: 'W12', value: 68 },
  { id: genId(), label: 'W13', value: 79 },
  { id: genId(), label: 'W14', value: 82 },
];

const INIT_PARETO: ParetoData[] = [
  { id: genId(), issue: 'Machine Breakdown', count: 45 },
  { id: genId(), issue: 'Material Shortage', count: 30 },
  { id: genId(), issue: 'Quality Reject', count: 15 },
  { id: genId(), issue: 'Changeover', count: 10 },
];

const INIT_RAW: RawData[] = [
  { id: genId(), metric: 'Total Units Produced', lastWeek: '15,200', thisWeek: '16,500', target: '18,000' },
  { id: genId(), metric: 'Total Input Hours', lastWeek: '420', thisWeek: '410', target: '400' },
  { id: genId(), metric: 'Avg OLE %', lastWeek: '79.2%', thisWeek: '82.0%', target: '80.0%' },
];

const INIT_ACTIONS: ActionItem[] = [
  { id: genId(), issue: 'Machine Breakdown', rootCause: 'Worn out belt on conveyer B', action: 'Replace belt and update PM schedule', owner: 'John D.', targetDate: '2026-04-25', status: 'In Progress' },
  { id: genId(), issue: 'Material Shortage', rootCause: 'Supplier delayed shipment', action: 'Expedite next batch, source backup supplier', owner: 'Sarah M.', targetDate: '2026-04-22', status: 'Open' },
];

const TT = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  fontSize: 11,
  color: 'hsl(var(--foreground))',
};

// ═══════════════════════════════════════════════════════════════════════════════

export default function FourQGenerator() {
  const [title, setTitle] = useState('Weekly OLE Performance Review');
  const [trend, setTrend] = useState(INIT_TREND);
  const [pareto, setPareto] = useState(INIT_PARETO);
  const [raw, setRaw] = useState(INIT_RAW);
  const [actions, setActions] = useState(INIT_ACTIONS);
  const [rightOpen, setRightOpen] = useState(true);

  // Pareto computation: cumulative percentage
  const paretoDataComputed = useMemo(() => {
    const sorted = [...pareto].sort((a, b) => b.count - a.count);
    const total = sorted.reduce((sum, item) => sum + item.count, 0);
    let cumSum = 0;
    return sorted.map(item => {
      cumSum += item.count;
      return { ...item, cumPct: total > 0 ? (cumSum / total) * 100 : 0 };
    });
  }, [pareto]);

  // Shared Renderers for Quadrants (used in both main stack and modal)
  const renderQ1 = () => (
    <div className="flex-1 min-h-0 w-full h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={TT} />
          <Bar dataKey="value" name="Value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
            {trend.map((_, i) => <Cell key={`cell-${i}`} fill="hsl(var(--primary))" />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  const renderQ2 = () => (
    <div className="flex-1 min-h-0 w-full h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={paretoDataComputed} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="issue" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={0} angle={-25} textAnchor="end" height={50} />
          <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis yAxisId="right" orientation="right" tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} domain={[0, 100]} />
          <Tooltip contentStyle={TT} />
          <Bar yAxisId="left" dataKey="count" name="Frequency" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={40} />
          <Line yAxisId="right" type="monotone" dataKey="cumPct" name="Cumulative %" stroke="#ef4444" strokeWidth={2} dot={{ r: 3, fill: '#ef4444' }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );

  const renderQ3 = (isPrint = false) => (
    <div className="overflow-x-auto border border-border print:border-gray-300 rounded w-full">
      <table className={cn("w-full text-left", isPrint ? "text-[10px]" : "text-xs")}>
        <thead className="bg-muted/50 print:bg-gray-100 text-muted-foreground print:text-gray-800 uppercase">
          <tr>
            <th className="px-3 py-2 border-b border-border print:border-gray-300">Metric</th>
            <th className="px-3 py-2 border-b border-border print:border-gray-300 text-right">Target</th>
            <th className="px-3 py-2 border-b border-border print:border-gray-300 text-right">Last Wk</th>
            <th className="px-3 py-2 border-b border-border print:border-gray-300 text-right">This Wk</th>
          </tr>
        </thead>
        <tbody>
          {raw.length === 0 ? (
            <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground text-xs">No data added</td></tr>
          ) : raw.map((r) => (
            <tr key={r.id} className="border-b border-border print:border-gray-300 last:border-0 print:text-black">
              <td className="px-3 py-2 font-semibold">{r.metric}</td>
              <td className="px-3 py-2 text-right">{r.target}</td>
              <td className="px-3 py-2 text-right text-muted-foreground print:text-gray-600">{r.lastWeek}</td>
              <td className="px-3 py-2 text-right font-mono">{r.thisWeek}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderQ4 = (isPrint = false) => (
    <div className="overflow-x-auto border border-border print:border-gray-300 rounded w-full">
      <table className={cn("w-full text-left", isPrint ? "text-[10px]" : "text-xs")}>
        <thead className="bg-muted/50 print:bg-gray-100 text-muted-foreground print:text-gray-800 uppercase">
          <tr>
            <th className="px-2 py-2 border-b border-border print:border-gray-300">Issue</th>
            <th className="px-2 py-2 border-b border-border print:border-gray-300">Root Cause</th>
            <th className="px-2 py-2 border-b border-border print:border-gray-300">Action</th>
            <th className="px-2 py-2 border-b border-border print:border-gray-300">Owner</th>
            <th className="px-2 py-2 border-b border-border print:border-gray-300">Date</th>
            <th className="px-2 py-2 border-b border-border print:border-gray-300">Status</th>
          </tr>
        </thead>
        <tbody>
          {actions.length === 0 ? (
            <tr><td colSpan={6} className="px-2 py-6 text-center text-muted-foreground text-xs">No actions added</td></tr>
          ) : actions.map((a) => (
            <tr key={a.id} className="border-b border-border print:border-gray-300 last:border-0 print:text-black">
              <td className="px-2 py-2 font-medium max-w-[150px] truncate" title={a.issue}>{a.issue}</td>
              <td className="px-2 py-2 max-w-[200px] truncate" title={a.rootCause}>{a.rootCause}</td>
              <td className="px-2 py-2 max-w-[200px] truncate" title={a.action}>{a.action}</td>
              <td className="px-2 py-2">{a.owner}</td>
              <td className="px-2 py-2 whitespace-nowrap">{a.targetDate}</td>
              <td className="px-2 py-2 font-medium whitespace-nowrap">{a.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );


  return (
    <div className="flex flex-col h-full w-full bg-background overflow-hidden relative">
      
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0 bg-card">
        <div>
          <h1 className="text-xl font-semibold text-foreground">4Q Generator</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Edit quadrants, then preview your 4-blocker report.</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="default" size="sm" className="gap-2">
              <Eye className="w-4 h-4" /> Preview Report
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[1200px] w-[95vw] h-[90vh] p-0 flex flex-col gap-0 border-none bg-transparent shadow-none">
            
            {/* Modal Header (Hidden on print) */}
            <div className="bg-card border border-border rounded-t-xl px-6 py-4 flex items-center justify-between print:hidden shadow-md z-10">
              <div>
                <h2 className="font-semibold text-lg">Report Preview</h2>
                <p className="text-xs text-muted-foreground">This is how your final report will look when printed.</p>
              </div>
              <Button onClick={() => window.print()} className="gap-2">
                <Printer className="w-4 h-4" /> Print PDF
              </Button>
            </div>

            {/* Modal Body / Print Area */}
            <div className="bg-muted p-8 flex-1 overflow-y-auto rounded-b-xl border border-t-0 border-border print:p-0 print:border-none print:bg-white print:overflow-visible">
              <div className="max-w-[1100px] mx-auto bg-card border border-border print:border-none shadow-sm print:shadow-none p-6 print:p-0 h-full flex flex-col">
                
                {/* 4Q Title */}
                <div className="border-b-2 border-primary pb-3 mb-6 flex items-center justify-between flex-shrink-0">
                  <h1 className="text-2xl font-bold text-foreground print:text-black uppercase">{title}</h1>
                  <div className="text-sm font-semibold text-muted-foreground print:text-gray-600 uppercase tracking-widest">
                    JABIL 4Q REPORT
                  </div>
                </div>

                {/* 2x2 Grid */}
                <div className="grid grid-cols-2 gap-6 flex-1" style={{ gridTemplateRows: '1fr 1fr' }}>
                  
                  {/* Q1 */}
                  <div className="border border-border print:border-gray-300 rounded-lg p-4 flex flex-col h-full overflow-hidden">
                    <h2 className="text-sm font-bold uppercase mb-4 text-primary print:text-black flex items-center gap-2 flex-shrink-0">
                      <span className="bg-primary text-primary-foreground print:bg-black print:text-white w-5 h-5 rounded flex items-center justify-center">1</span>
                      Performance Trend
                    </h2>
                    {renderQ1()}
                  </div>

                  {/* Q2 */}
                  <div className="border border-border print:border-gray-300 rounded-lg p-4 flex flex-col h-full overflow-hidden">
                    <h2 className="text-sm font-bold uppercase mb-4 text-orange-500 print:text-black flex items-center gap-2 flex-shrink-0">
                      <span className="bg-orange-500 text-white print:bg-black w-5 h-5 rounded flex items-center justify-center">2</span>
                      Top Drivers / Pareto
                    </h2>
                    {renderQ2()}
                  </div>

                  {/* Q3 */}
                  <div className="border border-border print:border-gray-300 rounded-lg p-4 flex flex-col h-full overflow-hidden">
                    <h2 className="text-sm font-bold uppercase mb-4 text-blue-500 print:text-black flex items-center gap-2 flex-shrink-0">
                      <span className="bg-blue-500 text-white print:bg-black w-5 h-5 rounded flex items-center justify-center">3</span>
                      Data Summary
                    </h2>
                    <div className="flex-1 min-h-0 overflow-auto">
                      {renderQ3(true)}
                    </div>
                  </div>

                  {/* Q4 */}
                  <div className="border border-border print:border-gray-300 rounded-lg p-4 flex flex-col h-full overflow-hidden">
                    <h2 className="text-sm font-bold uppercase mb-4 text-emerald-500 print:text-black flex items-center gap-2 flex-shrink-0">
                      <span className="bg-emerald-500 text-white print:bg-black w-5 h-5 rounded flex items-center justify-center">4</span>
                      Action Plan
                    </h2>
                    <div className="flex-1 min-h-0 overflow-auto">
                      {renderQ4(true)}
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* ─── Main Body (Row) ─── */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        
        {/* ─── Main Content (Vertical Stack) ─── */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-5xl mx-auto space-y-12 pb-16">
            
            <div className="space-y-4">
              <h2 className="text-xl font-bold uppercase text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-7 h-7 rounded flex items-center justify-center">1</span> Performance Trend
              </h2>
              <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                {renderQ1()}
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-bold uppercase text-orange-500 flex items-center gap-2">
                <span className="bg-orange-500 text-white w-7 h-7 rounded flex items-center justify-center">2</span> Top Drivers / Pareto
              </h2>
              <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                {renderQ2()}
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-bold uppercase text-blue-500 flex items-center gap-2">
                <span className="bg-blue-500 text-white w-7 h-7 rounded flex items-center justify-center">3</span> Data Summary
              </h2>
              <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                {renderQ3()}
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-bold uppercase text-emerald-500 flex items-center gap-2">
                <span className="bg-emerald-500 text-white w-7 h-7 rounded flex items-center justify-center">4</span> Action Plan
              </h2>
              <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                {renderQ4()}
              </div>
            </div>

          </div>
        </div>

        {/* ─── Right Editor Panel ─── */}
        <div className={cn(
          "border-l border-border bg-card/95 backdrop-blur-md transition-all duration-300 ease-in-out shadow-2xl flex flex-col flex-shrink-0 z-10",
          rightOpen ? "w-[450px]" : "w-12"
        )}>
          {/* Panel Header */}
          <div
            className={cn("flex items-center cursor-pointer hover:bg-muted/50 transition-colors border-b border-border flex-shrink-0", rightOpen ? "justify-between px-6 h-14" : "justify-center h-14")}
            onClick={() => setRightOpen(!rightOpen)}
          >
            {rightOpen ? (
              <>
                <span className="text-sm font-bold text-foreground">Data Editor</span>
                <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                  <ChevronRight className="h-4 w-4" />
                </div>
              </>
            ) : (
              <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                <ChevronLeft className="h-4 w-4" />
              </div>
            )}
          </div>

          {/* Panel Content (Tabs) */}
          {rightOpen && (
            <div className="flex-1 overflow-hidden p-4 flex flex-col min-h-0">
              <Tabs defaultValue="q1" className="h-full flex flex-col min-h-0">
                <TabsList className="w-full flex-wrap justify-start rounded-none border-b border-border bg-transparent h-auto p-0 gap-x-4 gap-y-2 pb-2">
                  <TabsTrigger value="q1" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 py-1 shadow-none text-xs">Q1 Trend</TabsTrigger>
                  <TabsTrigger value="q2" className="rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:bg-transparent px-1 py-1 shadow-none text-xs">Q2 Pareto</TabsTrigger>
                  <TabsTrigger value="q3" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent px-1 py-1 shadow-none text-xs">Q3 Data</TabsTrigger>
                  <TabsTrigger value="q4" className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent px-1 py-1 shadow-none text-xs">Q4 Actions</TabsTrigger>
                  <TabsTrigger value="settings" className="rounded-none border-b-2 border-transparent data-[state=active]:border-muted-foreground data-[state=active]:bg-transparent px-1 py-1 shadow-none text-xs ml-auto">Settings</TabsTrigger>
                </TabsList>
                
                <div className="flex-1 overflow-y-auto mt-4 pr-2">
                  
                  <TabsContent value="q1" className="m-0 space-y-3">
                    <div className="flex justify-between items-center">
                      <p className="text-[11px] text-muted-foreground">Add data points for the trend chart.</p>
                      <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => setTrend([...trend, { id: genId(), label: '', value: 0 }])}>
                        <Plus className="w-3 h-3 mr-1" /> Add Row
                      </Button>
                    </div>
                    {trend.map((t, i) => (
                      <div key={t.id} className="flex items-center gap-2 bg-muted/30 p-2 rounded border border-border">
                        <Input value={t.label} onChange={e => { const n = [...trend]; n[i].label = e.target.value; setTrend(n); }} placeholder="Label" className="h-7 text-xs flex-1" />
                        <Input type="number" value={t.value} onChange={e => { const n = [...trend]; n[i].value = Number(e.target.value); setTrend(n); }} placeholder="Value" className="h-7 text-xs w-24" />
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setTrend(trend.filter(x => x.id !== t.id))}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    ))}
                  </TabsContent>

                  <TabsContent value="q2" className="m-0 space-y-3">
                    <div className="flex justify-between items-center">
                      <p className="text-[11px] text-muted-foreground">Add issues and frequencies.</p>
                      <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => setPareto([...pareto, { id: genId(), issue: '', count: 0 }])}>
                        <Plus className="w-3 h-3 mr-1" /> Add Row
                      </Button>
                    </div>
                    {pareto.map((p, i) => (
                      <div key={p.id} className="flex items-center gap-2 bg-muted/30 p-2 rounded border border-border">
                        <Input value={p.issue} onChange={e => { const n = [...pareto]; n[i].issue = e.target.value; setPareto(n); }} placeholder="Issue" className="h-7 text-xs flex-1" />
                        <Input type="number" value={p.count} onChange={e => { const n = [...pareto]; n[i].count = Number(e.target.value); setPareto(n); }} placeholder="Freq" className="h-7 text-xs w-24" />
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setPareto(pareto.filter(x => x.id !== p.id))}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    ))}
                  </TabsContent>

                  <TabsContent value="q3" className="m-0 space-y-3">
                    <div className="flex justify-between items-center">
                      <p className="text-[11px] text-muted-foreground">Add raw metrics and goals.</p>
                      <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => setRaw([...raw, { id: genId(), metric: '', lastWeek: '', thisWeek: '', target: '' }])}>
                        <Plus className="w-3 h-3 mr-1" /> Add Metric
                      </Button>
                    </div>
                    {raw.map((r, i) => (
                      <div key={r.id} className="flex flex-col gap-2 bg-muted/30 p-2 rounded border border-border">
                        <div className="flex gap-2">
                          <Input value={r.metric} onChange={e => { const n = [...raw]; n[i].metric = e.target.value; setRaw(n); }} placeholder="Metric" className="h-7 text-xs flex-1 font-semibold" />
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={() => setRaw(raw.filter(x => x.id !== r.id))}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input value={r.target} onChange={e => { const n = [...raw]; n[i].target = e.target.value; setRaw(n); }} placeholder="Target" className="h-7 text-xs w-1/3" />
                          <Input value={r.lastWeek} onChange={e => { const n = [...raw]; n[i].lastWeek = e.target.value; setRaw(n); }} placeholder="Last Wk" className="h-7 text-xs w-1/3" />
                          <Input value={r.thisWeek} onChange={e => { const n = [...raw]; n[i].thisWeek = e.target.value; setRaw(n); }} placeholder="This Wk" className="h-7 text-xs w-1/3 font-mono" />
                        </div>
                      </div>
                    ))}
                  </TabsContent>

                  <TabsContent value="q4" className="m-0 space-y-3">
                    <div className="flex justify-between items-center">
                      <p className="text-[11px] text-muted-foreground">Track corrective actions.</p>
                      <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => setActions([...actions, { id: genId(), issue: '', rootCause: '', action: '', owner: '', targetDate: '', status: 'Open' }])}>
                        <Plus className="w-3 h-3 mr-1" /> Add Action
                      </Button>
                    </div>
                    {actions.map((a, i) => (
                      <div key={a.id} className="flex flex-col gap-2 bg-muted/30 p-2 rounded border border-border">
                        <div className="flex items-center gap-2">
                          <Input value={a.issue} onChange={e => { const n = [...actions]; n[i].issue = e.target.value; setActions(n); }} placeholder="Issue" className="h-7 text-xs flex-1" />
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={() => setActions(actions.filter(x => x.id !== a.id))}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                        <Input value={a.rootCause} onChange={e => { const n = [...actions]; n[i].rootCause = e.target.value; setActions(n); }} placeholder="Root Cause" className="h-7 text-xs" />
                        <Input value={a.action} onChange={e => { const n = [...actions]; n[i].action = e.target.value; setActions(n); }} placeholder="Corrective Action" className="h-7 text-xs" />
                        <div className="flex items-center gap-2">
                          <Input value={a.owner} onChange={e => { const n = [...actions]; n[i].owner = e.target.value; setActions(n); }} placeholder="Owner" className="h-7 text-xs w-1/3" />
                          <Input value={a.targetDate} type="date" onChange={e => { const n = [...actions]; n[i].targetDate = e.target.value; setActions(n); }} className="h-7 text-xs w-1/3" />
                          <Input value={a.status} onChange={e => { const n = [...actions]; n[i].status = e.target.value; setActions(n); }} placeholder="Status" className="h-7 text-xs w-1/3" />
                        </div>
                      </div>
                    ))}
                  </TabsContent>

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
      </div>

      {/* Global Print Styles */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white; }
          /* Hide everything outside the modal content */
          body > :not([role="dialog"]) { display: none !important; }
          nav, aside, header { display: none !important; }
        }
      `}} />
    </div>
  );
}
