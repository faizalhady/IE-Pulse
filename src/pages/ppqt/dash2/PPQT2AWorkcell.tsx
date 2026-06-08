/**
 * PPQT2AWorkcell.tsx — Dashboard 2 · the combined dedicated workcell page
 * ────────────────────────────────────────────────────────────────────────
 * One workcell page, three views as underline tabs (house tab idiom —
 * IPKWorkcellHeader / OLEDashboard style):
 *
 *   A (DASH)   →  Excel replica body (PPQT2CWorkcellContent)
 *   B (Report) →  dense capacity grid grouped by line, NEED vs HAVE leading,
 *                 problems-only toggle, StepDrawer on row click (defined here)
 *   C (Triage) →  pain-point feed body (PPQT2BWorkcellContent)
 *
 * The step drawer itself is shared — see StepDrawer.tsx.
 *
 * Route: /ppqt/dash2a/:workcell
 * Data: mock (ppqt2Data.ts derived layer) — all tabs share the same numbers.
 */

import { UnderlineTabs } from '@/components/shared/UnderlineTabs';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { getWorkcellLogo, getWorkcellLogoBg } from '@/lib/ole/oleConstants';
import {
  PPQT_AREA_BADGE,
  PPQT_UTIL_BAR,
  PPQT_UTIL_TEXT,
  PPQT_VERDICT_TEXT,
  gapTextClass,
  getPPQTStatus,
} from '@/lib/ppqt/ppqtConstants';
import { cn } from '@/lib/utils';
import {
  AlertTriangle, ArrowLeft, ChevronDown, ChevronRight, FileSpreadsheet, ListChecks, Search, Table2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PERIOD_OPTIONS } from '../mockPpqtData';
import { PPQTProcess, PPQTSubWorkcenter } from '../types';
import { PPQT2BWorkcellContent } from './PPQT2BWorkcell';
import { PPQT2CWorkcellContent } from './PPQT2CWorkcell';
import { StepDrawer } from './StepDrawer';
import {
  buildWorkcellCapacity,
  getEvidenceForProcess,
} from './ppqt2Data';

const TABS = [
  { key: 'dash',   label: 'A', icon: FileSpreadsheet, tip: 'Excel DASH replica — chart + calculation matrix' },
  { key: 'report', label: 'B', icon: Table2,          tip: 'Capacity grid grouped by line, NEED vs HAVE' },
  { key: 'triage', label: 'C', icon: ListChecks,      tip: 'Pain points only, explained one by one' },
] as const;
type TabKey = typeof TABS[number]['key'];

const GRID_STEPS = 'minmax(11rem,1.4fr) 7rem 5.5rem 5.5rem 4.5rem 4.5rem 5rem minmax(7rem,1fr)';
const STEP_HEADERS = ['Step', 'Demand thru', 'WCT (s)', 'Takt (s)', 'Have', 'Need', 'Gap', 'Load'];

// ─── Page shell: header + tabs ────────────────────────────────────────────────
export default function PPQT2AWorkcell() {
  const { workcell = '' } = useParams();
  const navigate = useNavigate();

  const [tab, setTab] = useState<TabKey>('dash');
  const period = PERIOD_OPTIONS[0];

  const data = useMemo(() => buildWorkcellCapacity(workcell), [workcell]);

  if (!data) {
    return (
      <div className="p-8 text-center text-muted-foreground text-sm">
        Workcell "{workcell}" not found.
        <button onClick={() => navigate('/ppqt/dash2a')} className="block mx-auto mt-3 text-emerald-400 hover:underline text-xs">
          ← Back to capacity verdict
        </button>
      </div>
    );
  }

  const logo = getWorkcellLogo(data.wc.id);

  return (
    <div className="min-h-screen">
      {/* sticky header — Pulse Reports style: title row, then underline tabs */}
      <div className="sticky top-0 z-20 bg-background border-b border-border px-5 pb-0">
        <div className="pt-3 pb-3 flex items-center gap-3">
          <button
            onClick={() => navigate('/ppqt/dash2a')}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors flex-shrink-0"
            title="Back to capacity verdict"
          >
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </button>

          {logo ? (
            <div
              className="w-20 h-8 rounded border border-border flex items-center justify-center overflow-hidden flex-shrink-0"
              style={{ backgroundColor: getWorkcellLogoBg(data.wc.id) ?? '#ffffff' }}
            >
              <img src={logo} alt={data.wc.id} className="w-full h-full object-contain p-0.5" />
            </div>
          ) : null}

          <div className="min-w-0">
            <h1 className="text-base font-bold text-foreground truncate">{data.wc.name}</h1>
            <p className="text-[11px] text-muted-foreground truncate">{data.wc.division} · Capacity report · {period}</p>
          </div>
        </div>

        {/* tabs */}
        <UnderlineTabs tabs={TABS} active={tab} onChange={setTab} />
      </div>

      {/* tab content */}
      {tab === 'report' && <ReportContent workcellId={workcell} period={period} />}
      {tab === 'triage' && <PPQT2BWorkcellContent workcellId={workcell} period={period} />}
      {tab === 'dash'   && <PPQT2CWorkcellContent workcellId={workcell} />}
    </div>
  );
}

// ─── Report tab — the Variant A capacity report ───────────────────────────────
function ReportContent({ workcellId, period }: { workcellId: string; period: string }) {
  const [lineFilter, setLineFilter] = useState<string>('all');
  const [problemsOnly, setProblemsOnly] = useState(true);
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [drawer, setDrawer] = useState<{ process: PPQTProcess; line: PPQTSubWorkcenter } | null>(null);

  const data = useMemo(() => buildWorkcellCapacity(workcellId), [workcellId]);

  // Demand-through-step per process (league of assemblies that route through it)
  const demandThru = useMemo(() => {
    const m = new Map<string, number>();
    if (!data) return m;
    for (const line of data.lines)
      for (const p of line.processes)
        m.set(p.id, getEvidenceForProcess(p.id).demandThruStep);
    return m;
  }, [data]);

  if (!data) return null;

  // Visible lines + steps after filters
  const visibleLines = data.lines
    .filter(l => lineFilter === 'all' || l.swc.id === lineFilter)
    .map(line => {
      const q = search.trim().toLowerCase();
      const steps = line.processes.filter(p => {
        if (q && !p.name.toLowerCase().includes(q)) return false;
        if (problemsOnly && p.gap <= 0 && p.util < 90) return false;
        return true;
      });
      return { line, steps, hidden: line.processes.length - steps.length };
    });

  const scoped = lineFilter === 'all'
    ? data
    : (() => {
        const line = data.lines.find(l => l.swc.id === lineFilter);
        return line
          ? { ...data, lines: [line], stepsTotal: line.processes.length, stepsShort: line.stepsShort, stepsTight: line.stepsTight, machinesShort: line.machinesShort, verdict: line.verdict }
          : data;
      })();

  return (
    <>
      <div className="p-5 space-y-4">
        {/* toolbar — report-specific controls */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* line */}
          <Select value={lineFilter} onValueChange={setLineFilter}>
            <SelectTrigger className="w-[200px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All lines ({data.lines.length})</SelectItem>
              {data.lines.map(l => (
                <SelectItem key={l.swc.id} value={l.swc.id} className="text-xs">{l.swc.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* problems-only toggle */}
          <button
            onClick={() => setProblemsOnly(v => !v)}
            className={cn(
              'h-8 px-3 rounded-lg border text-[11px] font-semibold transition-colors',
              problemsOnly
                ? 'bg-red-500/15 text-red-400 border-red-500/30'
                : 'bg-card text-muted-foreground border-border hover:bg-muted',
            )}
          >
            {problemsOnly ? 'Problems only' : 'All steps'}
          </button>

          {/* search */}
          <div className="relative ml-auto">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search steps…"
              className="h-8 w-[160px] pl-8 text-xs"
            />
          </div>
        </div>

        {/* verdict banner */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className={cn(
            'px-5 py-4 border-b border-border',
            scoped.verdict === 'short' ? 'bg-red-500/10' : scoped.verdict === 'tight' ? 'bg-amber-500/10' : 'bg-emerald-500/10',
          )}>
            <p className={cn('text-sm font-bold', PPQT_VERDICT_TEXT[scoped.verdict])}>
              {scoped.verdict === 'short' ? (
                <>✕ {period}: cannot meet demand — {scoped.stepsShort} step{scoped.stepsShort !== 1 ? 's' : ''} short,
                  {' '}{scoped.machinesShort} machine{scoped.machinesShort !== 1 ? 's' : ''} missing
                  {data.worstStep && lineFilter === 'all' ? ` — worst: ${data.worstStep.process.name} on ${data.worstStep.line.name}` : ''}.</>
              ) : scoped.verdict === 'tight' ? (
                <>⚠ {period}: demand fits, but {scoped.stepsTight} step{scoped.stepsTight !== 1 ? 's are' : ' is'} above
                  90% load — no headroom for upside or downtime.</>
              ) : (
                <>✓ {period}: demand fits with current equipment.</>
              )}
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 divide-x divide-border">
            {[
              { label: 'Demand', value: data.wc.totalDemand.toLocaleString(), unit: 'units' },
              { label: 'Lines', value: String(scoped.lines.length), unit: lineFilter === 'all' ? 'analyzed' : 'selected' },
              { label: 'Steps', value: String(scoped.stepsTotal), unit: 'analyzed' },
              { label: 'Steps short', value: String(scoped.stepsShort), unit: `+ ${scoped.stepsTight} tight`, tone: scoped.stepsShort > 0 ? 'text-red-400' : undefined },
              { label: 'Machines short', value: scoped.machinesShort > 0 ? `−${scoped.machinesShort}` : '0', unit: 'vs available', tone: scoped.machinesShort > 0 ? 'text-red-400' : 'text-emerald-400' },
            ].map(t => (
              <div key={t.label} className="px-4 py-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t.label}</p>
                <p className={cn('text-lg font-mono font-bold mt-0.5', t.tone ?? 'text-foreground')}>{t.value}</p>
                <p className="text-[9px] text-muted-foreground">{t.unit}</p>
              </div>
            ))}
          </div>
        </div>

        {/* capacity grid grouped by line */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div
            className="grid bg-muted/50 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold border-b border-border"
            style={{ gridTemplateColumns: GRID_STEPS }}
          >
            {STEP_HEADERS.map((h, i) => (
              <div key={h} className={cn('px-3 py-2.5', i >= 1 && i <= 6 && 'text-right')}>{h}</div>
            ))}
          </div>

          {visibleLines.map(({ line, steps, hidden }) => {
            const isCollapsed = collapsed.has(line.swc.id);
            return (
              <div key={line.swc.id} className="border-b border-border last:border-0">
                {/* line group header */}
                <button
                  onClick={() => setCollapsed(prev => {
                    const next = new Set(prev);
                    next.has(line.swc.id) ? next.delete(line.swc.id) : next.add(line.swc.id);
                    return next;
                  })}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                >
                  {isCollapsed
                    ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
                  <span className="text-xs font-bold text-foreground">{line.swc.name}</span>
                  <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded-full border', PPQT_AREA_BADGE[line.swc.area])}>
                    {line.swc.area}
                  </span>
                  <span className="text-[10px] text-muted-foreground ml-auto font-mono">
                    {line.swc.shiftHours}h × {line.swc.workingDays}d · FPY {line.swc.fpy}% · Eff {line.swc.efficiency}%
                  </span>
                  <span className={cn(
                    'text-[10px] font-semibold font-mono tabular-nums',
                    line.machinesShort > 0 ? 'text-red-400' : line.stepsTight > 0 ? 'text-amber-400' : 'text-emerald-400',
                  )}>
                    {line.machinesShort > 0
                      ? `${line.stepsShort} short · −${line.machinesShort} machines`
                      : line.stepsTight > 0
                        ? `${line.stepsTight} tight`
                        : 'all steps OK'}
                  </span>
                </button>

                {/* step rows */}
                {!isCollapsed && steps.map(p => {
                  const status = getPPQTStatus(p.util);
                  return (
                    <button
                      key={p.id}
                      onClick={() => setDrawer({ process: p, line: line.swc })}
                      className="grid items-center w-full text-left border-t border-border hover:bg-muted/40 transition-colors"
                      style={{ gridTemplateColumns: GRID_STEPS, height: 48 }}
                    >
                      <div className="px-3 flex items-center gap-2 min-w-0">
                        <span className="text-xs font-medium text-foreground truncate">{p.name}</span>
                        {p.ctSourceCounts.Est > 0 && (
                          <span title={`${p.ctSourceCounts.Est} estimated CTs`}>
                            <AlertTriangle className="h-3 w-3 text-amber-400 flex-shrink-0" />
                          </span>
                        )}
                      </div>
                      <div className="px-3 text-right text-xs font-mono text-muted-foreground tabular-nums">
                        {(demandThru.get(p.id) ?? 0).toLocaleString()}
                      </div>
                      <div className="px-3 text-right text-xs font-mono text-foreground tabular-nums">{p.wct.toFixed(1)}</div>
                      <div className="px-3 text-right text-xs font-mono text-muted-foreground tabular-nums">{p.takt.toFixed(1)}</div>
                      <div className="px-3 text-right text-sm font-mono font-semibold text-foreground tabular-nums">{p.eqAvail}</div>
                      <div className={cn(
                        'px-3 text-right text-sm font-mono font-bold tabular-nums',
                        p.gap > 0 ? 'text-red-400' : 'text-foreground',
                      )}>
                        {p.resNeeded}
                      </div>
                      <div className={cn('px-3 text-right text-xs font-mono tabular-nums', gapTextClass(p.gap))}>
                        {p.gap > 0 ? `−${p.gap}` : '0'}
                      </div>
                      <div className="px-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-muted/40 overflow-hidden">
                            <div
                              className={cn('h-full rounded-full', PPQT_UTIL_BAR[status])}
                              style={{ width: `${Math.min(100, p.util)}%` }}
                            />
                          </div>
                          <span className={cn('text-[10px] font-mono font-semibold tabular-nums w-9 text-right', PPQT_UTIL_TEXT[status])}>
                            {Math.round(p.util)}%
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}

                {/* hidden-steps note (problems-only mode) */}
                {!isCollapsed && hidden > 0 && (
                  <div className="px-10 py-2 border-t border-border text-[10px] text-muted-foreground">
                    {steps.length === 0
                      ? `All ${hidden} steps healthy — `
                      : `${hidden} healthy step${hidden !== 1 ? 's' : ''} hidden — `}
                    <button onClick={() => setProblemsOnly(false)} className="text-emerald-400 hover:underline">
                      show all steps
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-[10px] text-muted-foreground">
          <span className="font-semibold text-foreground/80">Need</span> = machines required to meet {period} demand
          (WCT ÷ Takt ÷ FPY ÷ Efficiency, rounded up). <span className="font-semibold text-foreground/80">Have</span> =
          machines on the floor. Click any step for the math trail and the assemblies driving its load.
          <AlertTriangle className="inline h-3 w-3 text-amber-400 mx-1" />= step contains estimated cycle times.
        </p>
      </div>

      {/* drawer */}
      {drawer && (
        <StepDrawer process={drawer.process} line={drawer.line} onClose={() => setDrawer(null)} />
      )}
    </>
  );
}

