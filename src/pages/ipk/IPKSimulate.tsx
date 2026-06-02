/**
 * IPKSimulate.tsx  ← THE TOOL
 * ────────────────────────────
 * Three input modes for running an IPK simulation, all producing the same
 * results view:
 *   Tab A — Upload Excel (drag-drop, 5 source slots)
 *   Tab B — Step-by-Step Wizard (4 steps)
 *   Tab C — Manual Config (live client-side calculator)
 *
 * Route: /ipk/:workcell/simulate
 */

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { calcIPK } from '@/lib/ipk/ipkCalc';
import { IPK_CALC_TYPES, IPK_CALC_TYPE_LABEL, type IPKCalcType } from '@/lib/ipk/ipkConstants';
import { MOCK_SUMMARY_ROWS } from './mockIpkData';
import IPKWorkcellHeader from './IPKWorkcellHeader';
import {
  Check, ChevronLeft, ChevronRight, FileSpreadsheet, Loader2,
  Play, Plus, Trash2, Upload,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

type Mode = 'upload' | 'wizard' | 'manual';

export default function IPKSimulate() {
  const { workcell = '' } = useParams();

  return (
    <div className="relative">
      <IPKWorkcellHeader workcellId={workcell} subtitle="Run a simulation — choose an input mode below" />

      <div className="p-5">
        <Tabs defaultValue={'manual' as Mode} className="w-full">
          <TabsList className="mb-5">
            <TabsTrigger value="upload"><Upload className="h-3.5 w-3.5 mr-1.5" /> Upload Excel</TabsTrigger>
            <TabsTrigger value="wizard"><FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" /> Step-by-Step Wizard</TabsTrigger>
            <TabsTrigger value="manual"><Play className="h-3.5 w-3.5 mr-1.5" /> Manual Config</TabsTrigger>
          </TabsList>

          <TabsContent value="upload"><UploadTab workcell={workcell} /></TabsContent>
          <TabsContent value="wizard"><WizardTab workcell={workcell} /></TabsContent>
          <TabsContent value="manual"><ManualTab workcell={workcell} /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TAB A — Upload Excel
// ════════════════════════════════════════════════════════════════════════════

const FILE_SLOTS = [
  { key: 'ct',       label: 'Cycle Time Matrix',       required: true },
  { key: 'machine',  label: 'Available Machine Matrix', required: false },
  { key: 'trolley',  label: 'Trolley Type Matrix',      required: false },
  { key: 'grouping', label: 'Process Grouping',         required: false },
  { key: 'loading',  label: 'Loading Plan',             required: true },
] as const;

function UploadTab({ workcell }: { workcell: string }) {
  const navigate = useNavigate();
  const [files, setFiles] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);

  const canRun = Boolean(files.ct && files.loading);

  const pick = (key: string) => {
    // Mock: stamp a fake filename. Real version opens a file dialog + parses.
    setFiles(prev => ({ ...prev, [key]: `${key}_matrix.xlsx` }));
  };

  const run = () => {
    if (!canRun || running) return;
    setRunning(true);
    setTimeout(() => navigate(`/ipk/${encodeURIComponent(workcell)}/results/run-latest`), 1500);
  };

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-5">
      {/* Drop zone */}
      <div className="rounded-xl border-2 border-dashed border-border hover:border-emerald-500/40 transition-colors bg-card p-10 flex flex-col items-center justify-center text-center">
        <div className="w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center mb-3">
          <Upload className="h-6 w-6 text-emerald-400" />
        </div>
        <p className="text-sm font-semibold text-foreground">Drop your IPK Excel file here</p>
        <p className="text-[11px] text-muted-foreground mt-1">
          Upload all 5 sources as one multi-sheet workbook, or as separate files below
        </p>
        <button
          onClick={() => pick('ct')}
          className="mt-3 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 transition-colors underline underline-offset-2"
        >
          or browse files
        </button>
      </div>

      {/* File slots */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border">
          <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Expected Source Files</p>
        </div>
        {FILE_SLOTS.map((slot, i) => {
          const uploaded = files[slot.key];
          return (
            <div key={slot.key}
              className={cn('flex items-center gap-3 px-4 py-3', i < FILE_SLOTS.length - 1 && 'border-b border-border')}>
              <div className={cn('w-6 h-6 rounded flex items-center justify-center flex-shrink-0',
                uploaded ? 'bg-emerald-500/15' : 'bg-muted')}>
                {uploaded
                  ? <Check className="h-3.5 w-3.5 text-emerald-400" />
                  : <FileSpreadsheet className="h-3.5 w-3.5 text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground">
                  {slot.label}
                  {slot.required && <span className="text-red-400 ml-1">*</span>}
                </p>
                {uploaded && <p className="text-[10px] text-muted-foreground font-mono truncate">{uploaded}</p>}
              </div>
              <Button size="sm" variant={uploaded ? 'outline' : 'secondary'} onClick={() => pick(slot.key)}>
                {uploaded ? 'Replace' : 'Upload'}
              </Button>
            </div>
          );
        })}
      </div>

      <Button size="lg" disabled={!canRun || running} onClick={run} className="bg-emerald-500 hover:bg-emerald-600">
        {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
        {running ? 'Running simulation…' : 'Run Simulation'}
      </Button>
      {!canRun && (
        <p className="text-[10px] text-muted-foreground text-center -mt-3">
          Requires at least the Cycle Time Matrix and Loading Plan
        </p>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TAB B — Step-by-Step Wizard
// ════════════════════════════════════════════════════════════════════════════

const WIZARD_STEPS = ['Workcell Settings', 'Process Groups', 'Loading Plan', 'Review & Run'];

interface WizardGroup { id: string; name: string; processes: string; calcType: IPKCalcType; upstream: string }
interface WizardProduct { id: string; pn: string; model: string; loadingQty: string; lotSize: string }

const RUN_STAGES = ['Calculating UPH…', 'Computing IPK…', 'Converting to Trolleys…', 'Done'];

function WizardTab({ workcell }: { workcell: string }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  // Step 1 — settings
  const [daysPerPeriod, setDays] = useState('20');
  const [hoursPerShift, setHours] = useState('10.5');
  const [shifts, setShifts] = useState('2');
  const [periodType, setPeriodType] = useState('Monthly');
  const [buffer, setBuffer] = useState('15');

  // Step 2 — process groups
  const [groups, setGroups] = useState<WizardGroup[]>([
    { id: 'g1', name: 'SMT Bot',     processes: 'Solder Print, Koh Young, SMT, Reflow', calcType: 'normal',      upstream: '' },
    { id: 'g2', name: 'SMT Top',     processes: 'Solder Print, Koh Young, SMT, Reflow', calcType: 'double_pass', upstream: 'SMT Bot' },
    { id: 'g3', name: 'LF Wave Top', processes: 'Manual Insert, Wave, PWTU, TSTH',      calcType: 'normal',      upstream: 'SMT Top' },
  ]);

  // Step 3 — loading plan
  const [products, setProducts] = useState<WizardProduct[]>([
    { id: 'p1', pn: '00-27000-0-001F', model: 'Alaris Pump PCA',  loadingQty: '1800', lotSize: '60' },
    { id: 'p2', pn: '00-27000-0-002F', model: 'Alaris Pump PCA R2', loadingQty: '1000', lotSize: '40' },
  ]);
  const [periodLabel, setPeriodLabel] = useState('Jun 2024');

  // Step 4 — run
  const [runStage, setRunStage] = useState<number | null>(null);

  const totalLoading = useMemo(
    () => products.reduce((s, p) => s + (Number(p.loadingQty) || 0), 0),
    [products],
  );
  const incompleteWarning =
    groups.some(g => !g.name.trim()) || products.some(p => !p.pn.trim() || !p.loadingQty.trim());

  const runWizard = () => {
    setRunStage(0);
    let i = 0;
    const tick = () => {
      i++;
      if (i < RUN_STAGES.length) { setRunStage(i); setTimeout(tick, 600); }
      else navigate(`/ipk/${encodeURIComponent(workcell)}/results/run-wizard`);
    };
    setTimeout(tick, 600);
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Step indicator */}
      <div className="flex items-center justify-between mb-6">
        {WIZARD_STEPS.map((label, i) => (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex items-center gap-2">
              <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0',
                i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-muted text-muted-foreground')}>
                {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span className={cn('text-[11px] font-medium whitespace-nowrap', i === step ? 'text-foreground' : 'text-muted-foreground')}>
                {label}
              </span>
            </div>
            {i < WIZARD_STEPS.length - 1 && <div className={cn('flex-1 h-px mx-3', i < step ? 'bg-emerald-500/40' : 'bg-border')} />}
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        {/* STEP 1 */}
        {step === 0 && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Days per period"><Input type="number" value={daysPerPeriod} onChange={e => setDays(e.target.value)} /></Field>
            <Field label="Hours per shift"><Input type="number" step="0.5" value={hoursPerShift} onChange={e => setHours(e.target.value)} /></Field>
            <Field label="Number of shifts">
              <Select value={shifts} onValueChange={setShifts}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{['1', '2', '3'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Period type">
              <Select value={periodType} onValueChange={setPeriodType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{['Monthly', 'Weekly'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Non-occupancy buffer (%)"><Input type="number" value={buffer} onChange={e => setBuffer(e.target.value)} /></Field>
          </div>
        )}

        {/* STEP 2 */}
        {step === 1 && (
          <div className="flex flex-col gap-3">
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="grid bg-muted/50 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold"
                style={{ gridTemplateColumns: '1fr 1.5fr 8rem 8rem 2rem' }}>
                {['Group Name', 'Processes', 'Calc Type', 'Upstream', ''].map((h, i) => <div key={i} className="px-2 py-2">{h}</div>)}
              </div>
              {groups.map(g => (
                <div key={g.id} className="grid items-center border-t border-border" style={{ gridTemplateColumns: '1fr 1.5fr 8rem 8rem 2rem' }}>
                  <div className="p-1.5"><Input className="h-8 text-xs" value={g.name} onChange={e => setGroups(gs => gs.map(x => x.id === g.id ? { ...x, name: e.target.value } : x))} /></div>
                  <div className="p-1.5"><Input className="h-8 text-xs" value={g.processes} onChange={e => setGroups(gs => gs.map(x => x.id === g.id ? { ...x, processes: e.target.value } : x))} /></div>
                  <div className="p-1.5">
                    <Select value={g.calcType} onValueChange={(v) => setGroups(gs => gs.map(x => x.id === g.id ? { ...x, calcType: v as IPKCalcType } : x))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{IPK_CALC_TYPES.map(t => <SelectItem key={t} value={t}>{IPK_CALC_TYPE_LABEL[t]}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="p-1.5"><Input className="h-8 text-xs" value={g.upstream} onChange={e => setGroups(gs => gs.map(x => x.id === g.id ? { ...x, upstream: e.target.value } : x))} /></div>
                  <div className="p-1.5 flex justify-center">
                    <button onClick={() => setGroups(gs => gs.filter(x => x.id !== g.id))} className="text-muted-foreground hover:text-red-400 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="self-start"
              onClick={() => setGroups(gs => [...gs, { id: `g${gs.length + 1}-${gs.length}`, name: '', processes: '', calcType: 'normal', upstream: '' }])}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Process Group
            </Button>
          </div>
        )}

        {/* STEP 3 */}
        {step === 2 && (
          <div className="flex flex-col gap-3">
            <Field label="Period label"><Input className="max-w-[200px]" value={periodLabel} onChange={e => setPeriodLabel(e.target.value)} /></Field>
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="grid bg-muted/50 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold"
                style={{ gridTemplateColumns: '1.5fr 2fr 7rem 7rem 2rem' }}>
                {['Assembly PN', 'Model Description', 'Loading Qty', 'Lot Size', ''].map((h, i) => <div key={i} className="px-2 py-2">{h}</div>)}
              </div>
              {products.map(p => (
                <div key={p.id} className="grid items-center border-t border-border" style={{ gridTemplateColumns: '1.5fr 2fr 7rem 7rem 2rem' }}>
                  <div className="p-1.5"><Input className="h-8 text-xs font-mono" value={p.pn} onChange={e => setProducts(ps => ps.map(x => x.id === p.id ? { ...x, pn: e.target.value } : x))} /></div>
                  <div className="p-1.5"><Input className="h-8 text-xs" value={p.model} onChange={e => setProducts(ps => ps.map(x => x.id === p.id ? { ...x, model: e.target.value } : x))} /></div>
                  <div className="p-1.5"><Input className="h-8 text-xs font-mono" type="number" value={p.loadingQty} onChange={e => setProducts(ps => ps.map(x => x.id === p.id ? { ...x, loadingQty: e.target.value } : x))} /></div>
                  <div className="p-1.5"><Input className="h-8 text-xs font-mono" type="number" value={p.lotSize} onChange={e => setProducts(ps => ps.map(x => x.id === p.id ? { ...x, lotSize: e.target.value } : x))} /></div>
                  <div className="p-1.5 flex justify-center">
                    <button onClick={() => setProducts(ps => ps.filter(x => x.id !== p.id))} className="text-muted-foreground hover:text-red-400 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="self-start"
              onClick={() => setProducts(ps => [...ps, { id: `p${ps.length + 1}-${ps.length}`, pn: '', model: '', loadingQty: '', lotSize: '' }])}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Product
            </Button>
          </div>
        )}

        {/* STEP 4 */}
        {step === 3 && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <ReviewStat label="Process groups" value={groups.length} />
              <ReviewStat label="Products" value={products.length} />
              <ReviewStat label="Total loading qty" value={totalLoading.toLocaleString()} />
              <ReviewStat label="Period" value={periodLabel} />
              <ReviewStat label="Days / shifts / hrs" value={`${daysPerPeriod} · ${shifts} · ${hoursPerShift}`} />
              <ReviewStat label="Buffer" value={`${buffer}%`} />
            </div>
            {incompleteWarning && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                <span className="text-[11px] text-amber-400">⚠ Some required fields are empty — review process groups and the loading plan before running.</span>
              </div>
            )}
            {runStage !== null && (
              <div className="rounded-lg border border-border bg-muted/20 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                  <span className="text-xs font-semibold text-foreground">{RUN_STAGES[runStage]}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${((runStage + 1) / RUN_STAGES.length) * 100}%` }} />
                </div>
              </div>
            )}
            <Button size="lg" className="bg-emerald-500 hover:bg-emerald-600" disabled={runStage !== null} onClick={runWizard}>
              {runStage !== null ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              Run Simulation
            </Button>
          </div>
        )}
      </div>

      {/* Nav buttons */}
      <div className="flex items-center justify-between mt-4">
        <Button variant="outline" size="sm" disabled={step === 0} onClick={() => setStep(s => Math.max(0, s - 1))}>
          <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Back
        </Button>
        {step < WIZARD_STEPS.length - 1 && (
          <Button size="sm" onClick={() => setStep(s => Math.min(WIZARD_STEPS.length - 1, s + 1))}>
            Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TAB C — Manual Config (live calculator)
// ════════════════════════════════════════════════════════════════════════════

interface ManualGroup {
  id: string;
  name: string;
  bottleneckCtSec: number;
  fpy: number;
  efficiency: number;
  qtyEquipment: number;
  changeoverMin: number;
  uphUpstream: number;
  uphDownstream: number;
  conversionPct: number;
}

function ManualTab({ workcell }: { workcell: string }) {
  const navigate = useNavigate();

  // Seed from the mock summary so the live panel shows meaningful numbers.
  const [groups, setGroups] = useState<ManualGroup[]>(() =>
    MOCK_SUMMARY_ROWS.slice(0, 5).map((r, i) => ({
      id: `mg-${i}`,
      name: r.processGroup,
      bottleneckCtSec: r.bottleneckCtSec,
      fpy: r.fpy,
      efficiency: r.efficiency,
      qtyEquipment: r.qtyEquipment,
      changeoverMin: 0,
      uphUpstream: r.uphUpstream,
      uphDownstream: r.uphDownstream,
      conversionPct: r.conversionPct,
    })),
  );
  const [days, setDays] = useState('20');
  const [hours, setHours] = useState('10.5');
  const [shifts, setShifts] = useState('2');
  const [buffer, setBuffer] = useState('15');
  const [loadingQty, setLoadingQty] = useState('2800');
  const [boardsPerTrolley, setBoards] = useState('20');

  const bufferPct = (Number(buffer) || 0) / 100;
  const loading = Number(loadingQty) || 0;
  const boards = Number(boardsPerTrolley) || 1;

  const results = useMemo(() => groups.map(g => {
    const res = calcIPK({
      bottleneckCtSec: g.bottleneckCtSec,
      fpy: g.fpy,
      efficiency: g.efficiency,
      conversionPct: g.conversionPct,
      qtyEquipment: g.qtyEquipment,
      loadingQty: loading,
      uphUpstream: g.uphUpstream,
      uphDownstream: g.uphDownstream,
      bufferPct,
      boardsPerTrolley: boards,
    });
    return { g, ...res };
  }), [groups, loading, bufferPct, boards]);

  const totalTrolleys = results.reduce((s, r) => s + r.ipkTrolleys, 0);

  const setG = (id: string, patch: Partial<ManualGroup>) =>
    setGroups(gs => gs.map(g => g.id === id ? { ...g, ...patch } : g));

  return (
    <div className="flex gap-5">
      {/* LEFT — inputs */}
      <div className="w-[400px] flex-shrink-0 flex flex-col gap-4">
        {/* Settings */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border">
            <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Settings</p>
          </div>
          <div className="grid grid-cols-2 gap-3 p-4">
            <Field label="Days / period"><Input className="h-8" type="number" value={days} onChange={e => setDays(e.target.value)} /></Field>
            <Field label="Hours / shift"><Input className="h-8" type="number" step="0.5" value={hours} onChange={e => setHours(e.target.value)} /></Field>
            <Field label="Shifts">
              <Select value={shifts} onValueChange={setShifts}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>{['1', '2', '3'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Buffer (%)"><Input className="h-8" type="number" value={buffer} onChange={e => setBuffer(e.target.value)} /></Field>
          </div>
        </div>

        {/* Process groups */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
            <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Process Groups</p>
            <span className="text-[10px] text-muted-foreground font-mono">{groups.length}</span>
          </div>
          <div className="divide-y divide-border">
            {groups.map(g => (
              <div key={g.id} className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Input className="h-7 text-xs font-semibold" value={g.name} onChange={e => setG(g.id, { name: e.target.value })} />
                  <button onClick={() => setGroups(gs => gs.filter(x => x.id !== g.id))} className="text-muted-foreground hover:text-red-400 transition-colors flex-shrink-0">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <MiniField label="CT (s)"><Input className="h-7 text-xs font-mono" type="number" value={g.bottleneckCtSec} onChange={e => setG(g.id, { bottleneckCtSec: Number(e.target.value) || 0 })} /></MiniField>
                  <MiniField label="FPY"><Input className="h-7 text-xs font-mono" type="number" step="0.01" value={g.fpy} onChange={e => setG(g.id, { fpy: Number(e.target.value) || 0 })} /></MiniField>
                  <MiniField label="Eff"><Input className="h-7 text-xs font-mono" type="number" step="0.01" value={g.efficiency} onChange={e => setG(g.id, { efficiency: Number(e.target.value) || 0 })} /></MiniField>
                  <MiniField label="Qty Eqp"><Input className="h-7 text-xs font-mono" type="number" value={g.qtyEquipment} onChange={e => setG(g.id, { qtyEquipment: Number(e.target.value) || 0 })} /></MiniField>
                  <MiniField label="C/O (min)"><Input className="h-7 text-xs font-mono" type="number" value={g.changeoverMin} onChange={e => setG(g.id, { changeoverMin: Number(e.target.value) || 0 })} /></MiniField>
                  <MiniField label="UPH↓"><Input className="h-7 text-xs font-mono" type="number" value={g.uphDownstream} onChange={e => setG(g.id, { uphDownstream: Number(e.target.value) || 0 })} /></MiniField>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => setGroups(gs => [...gs, { id: `mg-${gs.length}-${Date.now() % 1000}`, name: `Group ${gs.length + 1}`, bottleneckCtSec: 60, fpy: 0.99, efficiency: 0.85, qtyEquipment: 1, changeoverMin: 0, uphUpstream: 60, uphDownstream: 45, conversionPct: 1 }])}
            className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-[11px] font-semibold text-emerald-400 hover:bg-muted/30 transition-colors border-t border-border"
          >
            <Plus className="h-3.5 w-3.5" /> Add Group
          </button>
        </div>

        {/* Demand */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border">
            <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Demand</p>
          </div>
          <div className="grid grid-cols-2 gap-3 p-4">
            <Field label="Total loading qty"><Input className="h-8 font-mono" type="number" value={loadingQty} onChange={e => setLoadingQty(e.target.value)} /></Field>
            <Field label="Boards / trolley"><Input className="h-8 font-mono" type="number" value={boardsPerTrolley} onChange={e => setBoards(e.target.value)} /></Field>
          </div>
        </div>
      </div>

      {/* RIGHT — live results */}
      <div className="flex-1 min-w-0">
        <div className="rounded-xl border border-border bg-card overflow-hidden sticky top-[88px]">
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
            <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live IPK Results
            </p>
            <span className="text-[9px] text-muted-foreground">updates as you type</span>
          </div>

          <div className="p-4 grid grid-cols-2 gap-3 max-h-[calc(100vh-280px)] overflow-y-auto">
            {results.map(({ g, effectiveUph, ipkUnits, wipWithBuffer, ipkTrolleys }) => (
              <div key={g.id} className="rounded-lg border border-border bg-muted/10 p-3">
                <p className="text-xs font-bold text-foreground truncate">{g.name}</p>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <Metric label="Eff. UPH" value={effectiveUph} />
                  <Metric label="IPK units" value={ipkUnits} />
                  <Metric label="WIP+buf" value={wipWithBuffer} />
                </div>
                <div className="mt-2 pt-2 border-t border-border flex items-baseline justify-between">
                  <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Trolleys</span>
                  <span className="text-2xl font-mono font-black text-emerald-400 tabular-nums leading-none">{ipkTrolleys}</span>
                </div>
                <div className="mt-2 text-[9px] font-mono text-muted-foreground leading-relaxed">
                  3600/{g.bottleneckCtSec} × {g.fpy} × {g.efficiency} × {g.conversionPct} = {effectiveUph}
                  <br />
                  ({g.uphUpstream} − {g.uphDownstream}) × ({loading}/{g.uphUpstream}) = {ipkUnits}
                </div>
              </div>
            ))}
          </div>

          <div className="px-4 py-3 border-t border-border flex items-center justify-between bg-muted/20">
            <div>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Total trolleys required</p>
              <p className="text-3xl font-mono font-black text-foreground tabular-nums leading-none mt-0.5">{totalTrolleys}</p>
            </div>
            <Button className="bg-emerald-500 hover:bg-emerald-600"
              onClick={() => navigate(`/ipk/${encodeURIComponent(workcell)}/results/run-manual`)}>
              <Play className="h-4 w-4 mr-2" /> Save as Run
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Small helpers ──────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
      {children}
    </label>
  );
}
function MiniField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[9px] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[9px] text-muted-foreground">{label}</p>
      <p className="text-sm font-mono font-bold text-foreground tabular-nums">{value}</p>
    </div>
  );
}
function ReviewStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-muted/10 px-3 py-2.5">
      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-sm font-mono font-bold text-foreground mt-0.5 tabular-nums">{value}</p>
    </div>
  );
}
