/**
 * PlantRunnerDashboard.tsx
 * ────────────────────────
 * Cross-plant runner dashboard, two collapsible layers:
 *   • "Overall Penang" (default open) — all plants combined, one top-50 list.
 *   • "By Plant" (default collapsed) — one column per plant (3 biggest by units),
 *     each a top-50 list. Clicking a runner row here opens that workcell's
 *     dedicated page on the "Report" tab.
 *
 * Data: eBuild/MES plant-runners mart (re-exported at /cycle-time/plant-runners).
 * Route: /cycle-time/plant-runners
 */

import { SortHeader } from '@/components/shared/SortHeader';
import { useSortable } from '@/hooks/shared/useSortable';
import { useCycleTimePlantRunners, useCycleTimeCompletion } from '@/hooks/cycle_time/useCycleTimeData';
import type { CompletionModel, CompletionStatus, CycleTimePlant, CycleTimePlantRunner } from '@/lib/cycle_time/cycleTimeApi';
import { exportPlantRunnersXlsx } from '@/lib/cycle_time/cycleTimeExport';
import { CompletionBadge } from './CompletionBadge';
import { RouteComparisonDrawer } from './RouteComparisonDrawer';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight, Download, ExternalLink, Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/** Completion lookup key — runner customer is UPPERCASE ('NOKIA OPTICS'), completion
 *  uses the config name ('Nokia Optics'); normalise both. Assembly matches exactly. */
const compKey = (customer: string, assembly: string) =>
  customer.toLowerCase().replace(/[^a-z0-9]/g, '') + '|' + assembly;
type CompMap = Map<string, CompletionModel>;
type CompareFn = (customer: string, assembly: string, tab: 'route' | 'lbr' | 'ipk') => void;

/** Collapse the raw status strings into the 4 user-facing buckets (+ pending = not computed). */
type StatusBucket = 'complete' | 'incomplete' | 'no_data' | 'unverified' | 'na' | 'pending';
const bucketOf = (status: CompletionStatus | undefined): StatusBucket =>
  !status ? 'pending'
    : status === 'unavailable' ? 'no_data'      // not in IEDB → "No data"
    : status === 'no_data' ? 'incomplete'       // legacy zero-CT rows fold into Incomplete
    : status === 'non_mes' ? 'na'               // different shopfloor → N/A
    : status === 'complete' || status === 'incomplete' || status === 'unverified' ? status
    : 'pending';                                // any unknown status → safe fallback

/** Status counts over a set of runners, via the completion lookup. */
function countStatuses(runners: CycleTimePlantRunner[], compMap?: CompMap) {
  const c = { complete: 0, incomplete: 0, no_data: 0, unverified: 0, na: 0, pending: 0 };
  for (const r of runners) c[bucketOf(compMap?.get(compKey(r.customer, r.assembly))?.status)]++;
  return c;
}

// Sortable columns for the runner tables. Default = rank (units desc, backend order).
type RunnerSortKey = 'jobs' | 'last' | 'units' | 'data';
const RUNNER_ACCESSORS: Record<RunnerSortKey, (r: CycleTimePlantRunner) => string | number | null> = {
  jobs: (r) => r.jobs,
  // ISO strings sort chronologically. Projection has no last_completed — sort by
  // its earliest start instead so the "Planned" column sorts by when demand begins.
  last: (r) => r.first_start ?? r.last_completed,
  units: (r) => r.units,
  data: (r) => (r.has_data ? 1 : 0),
};

const TOP_N = 100;

/** MES plant codes → friendly names (matches the league table). */
const PLANT_LABELS: Record<string, string> = { JPE: 'Plant 2', JBK: 'Batu Kawan' };
const plantLabel = (p: string) => PLANT_LABELS[p] ?? p;

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toISOString().slice(0, 10);
}

type RunnerMode = 'historical' | 'projection' | 'planner';
const MODE_LABEL: Record<RunnerMode, string> = {
  historical: 'Historical', projection: 'Projection', planner: 'Planner Demand',
};

export default function PlantRunnerDashboard() {
  const navigate = useNavigate();
  // Fetch all three datasets once — each layer picks which one it renders.
  const hist = useCycleTimePlantRunners(TOP_N, 3, 'historical');
  const proj = useCycleTimePlantRunners(TOP_N, 3, 'projection');
  const plan = useCycleTimePlantRunners(TOP_N, 3, 'planner');

  const [overallOpen, setOverallOpen] = useState(true);
  const [regionOpen, setRegionOpen] = useState(true);
  const [byPlantOpen, setByPlantOpen] = useState(true);

  // Each layer independently toggles historical (built) vs projection (demand).
  const [overallMode, setOverallMode] = useState<RunnerMode>('planner');
  const [regionMode, setRegionMode] = useState<RunnerMode>('planner');
  const [byPlantMode, setByPlantMode] = useState<RunnerMode>('planner');

  const [exporting, setExporting] = useState(false);

  // Completion status (5-state) — one fetch, keyed by customer+assembly for O(1) row lookup.
  const completion = useCycleTimeCompletion();
  const compMap: CompMap = useMemo(() => {
    const m: CompMap = new Map();
    for (const md of completion.data?.models ?? []) m.set(compKey(md.customer, md.assembly), md);
    return m;
  }, [completion.data]);
  const [compare, setCompare] = useState<{ customer: string; assembly: string; tab: 'route' | 'lbr' | 'ipk' } | null>(null);

  const dataFor = (m: RunnerMode) => (m === 'planner' ? plan.data : m === 'projection' ? proj.data : hist.data);

  const openReport = (customer: string, assembly?: string) =>
    navigate(`/cycle-time/${encodeURIComponent(customer)}?tab=report`
      + (assembly ? `&assembly=${encodeURIComponent(assembly)}` : ''));

  const handleExport = async () => {
    if (!hist.data) return;
    setExporting(true);
    try {
      await exportPlantRunnersXlsx(hist.data, proj.data);
    } finally {
      setExporting(false);
    }
  };

  const isLoading = hist.isLoading || proj.isLoading || plan.isLoading;
  const isError = hist.isError || !hist.data;

  const overallData = dataFor(overallMode);
  const regionData = dataFor(regionMode);
  const byPlantData = dataFor(byPlantMode);

  return (
    <div className="flex h-full flex-col">
      {/* ─── Page header ──────────────────────────────────────────────── */}
      <div className="border-b border-border">
        <div className="flex items-center justify-between gap-4 px-6 pt-4 pb-3">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-foreground">Incompletion Report</h1>
            <p className="text-[11px] text-muted-foreground">
              Top {TOP_N} runners per plant, flagged for cycle-time data gaps · Historical = units built (24 mo) ·
              Planner Demand = planners' forecast (next 13 wk, partial coverage)
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={!hist.data || exporting}
            className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Export to XLSX
          </button>
        </div>
      </div>

      {/* ─── Content ──────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-auto p-5 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-60 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center h-60 text-sm text-muted-foreground gap-1">
            <span className="text-red-500">Plant runner data not available.</span>
            <span>Build the mart: POST /api/ebuild/refresh</span>
          </div>
        ) : (
          <>
            {/* ── Overall Penang — full width, with Plant column ── */}
            <Section
              title="Overall Penang" open={overallOpen} onToggle={() => setOverallOpen((v) => !v)}
              right={<ModeToggle mode={overallMode} onChange={setOverallMode} />}
            >
              {overallData ? (
                <RunnerCard
                  section={overallData.overall}
                  showTitle={false}
                  showPlant
                  size="lg"
                  mode={overallMode}
                  extraHeader={<WorkcellStatusBars compMap={compMap} runners={overallData.overall.runners} topN={TOP_N} />}
                  onRowClick={openReport}
                  compMap={compMap}
                  onCompare={(c, a, t) => setCompare({ customer: c, assembly: a, tab: t })}
                />
              ) : <Unavailable />}
            </Section>

            {/* ── Region (Batu Kawan vs Penang Island) ── */}
            <Section
              title="Region" open={regionOpen} onToggle={() => setRegionOpen((v) => !v)}
              right={<ModeToggle mode={regionMode} onChange={setRegionMode} />}
            >
              {regionData ? (
                <div className={cn(
                  'grid grid-cols-1 gap-4',
                  // ponytail: literal classes — Tailwind purges dynamic strings
                  (regionData.regions ?? []).length <= 1 ? 'lg:grid-cols-1' : 'lg:grid-cols-2',
                )}>
                  {(regionData.regions ?? []).map((reg) => (
                    <RunnerCard
                      key={reg.plant}
                      section={reg}
                      showTitle
                      showPlant
                      size="md"
                      mode={regionMode}
                      extraHeader={<WorkcellStatusBars compMap={compMap} runners={reg.runners} topN={TOP_N} />}
                      onRowClick={openReport}
                      compMap={compMap}
                      onCompare={(c, a, t) => setCompare({ customer: c, assembly: a, tab: t })}
                    />
                  ))}
                </div>
              ) : <Unavailable />}
            </Section>

            {/* ── By Plant — rows navigate to workcell Report tab ── */}
            <Section
              title="By Plant" open={byPlantOpen} onToggle={() => setByPlantOpen((v) => !v)}
              right={<ModeToggle mode={byPlantMode} onChange={setByPlantMode} />}
            >
              {byPlantData ? (
                <div className={cn(
                  'grid grid-cols-1 gap-4',
                  // ponytail: literal classes — Tailwind purges dynamic strings
                  byPlantData.plants.length === 1 ? 'lg:grid-cols-1'
                    : byPlantData.plants.length === 2 ? 'lg:grid-cols-2'
                    : 'lg:grid-cols-3',
                )}>
                  {byPlantData.plants.map((p) => (
                    <RunnerCard
                      key={p.plant}
                      section={p}
                      showTitle
                      size="sm"
                      mode={byPlantMode}
                      extraHeader={<WorkcellStatusBars compMap={compMap} runners={p.runners} topN={TOP_N} />}
                      onRowClick={openReport}
                      compMap={compMap}
                      onCompare={(c, a, t) => setCompare({ customer: c, assembly: a, tab: t })}
                    />
                  ))}
                </div>
              ) : <Unavailable />}
            </Section>
          </>
        )}
      </div>

      {compare && (
        <RouteComparisonDrawer
          customer={compare.customer}
          assembly={compare.assembly}
          tab={compare.tab}
          onClose={() => setCompare(null)}
        />
      )}
    </div>
  );
}

/** Historical (built units) vs Projection (planned demand) segmented toggle. */
function ModeToggle({ mode, onChange }: { mode: RunnerMode; onChange: (m: RunnerMode) => void }) {
  return (
    <div className="inline-flex flex-shrink-0 rounded-lg border border-border bg-card p-0.5">
      {(['planner', 'historical'] as RunnerMode[]).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={cn(
            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap',
            mode === m ? 'bg-emerald-500/15 text-emerald-600' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {MODE_LABEL[m]}
        </button>
      ))}
    </div>
  );
}

function Unavailable() {
  return <p className="py-6 text-center text-xs text-muted-foreground">Data unavailable for this view — build the mart.</p>;
}

/** Collapsible section: clickable title (chevron) on the left, actions on the right. */
function Section({ title, open, onToggle, right, children }: {
  title: string; open: boolean; onToggle: () => void; right?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 py-2">
        <button
          onClick={onToggle}
          className="flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-emerald-600 transition-colors"
        >
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          {title}
        </button>
        {right}
      </div>
      {open && <div className="pt-1">{children}</div>}
    </div>
  );
}

// Three size tiers so the layers shrink: Overall (lg) → Region (md) → By Plant (sm).
type Size = 'lg' | 'md' | 'sm';
const SIZE: Record<Size, { row: string; rank: string; asm: string; sub: string; meta: string; units: string; badge: string; head: string }> = {
  lg: { row: 'h-11', rank: 'text-xs',    asm: 'text-[13px]', sub: 'text-[10px]', meta: 'text-xs',    units: 'text-sm',    badge: 'text-[9px] px-1.5 py-0.5', head: 'text-[10px]' },
  md: { row: 'h-10', rank: 'text-[10px]', asm: 'text-[11px]', sub: 'text-[9px]',  meta: 'text-[10px]', units: 'text-[11px]', badge: 'text-[8px] px-1 py-px',    head: 'text-[9px]' },
  sm: { row: 'h-9',  rank: 'text-[9px]',  asm: 'text-[10px]', sub: 'text-[8px]',  meta: 'text-[9px]',  units: 'text-[10px]', badge: 'text-[8px] px-1 py-px',    head: 'text-[9px]' },
};

function RunnerCard({ section, showTitle, showPlant, size = 'md', extraHeader, onRowClick, mode = 'historical', compMap, onCompare }: {
  section: CycleTimePlant; showTitle: boolean; showPlant?: boolean; size?: Size;
  extraHeader?: React.ReactNode; onRowClick?: (customer: string, assembly: string) => void;
  mode?: RunnerMode; compMap?: CompMap; onCompare?: CompareFn;
}) {
  const s = SIZE[size];
  // KPIs reflect only the top-N runners shown below, not the whole plant.
  const counts = countStatuses(section.runners, compMap);
  const total = section.runners.length;
  const pctOf = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  // Sortable within the shown top-N (population stays "top-N by units"; this just
  // re-orders it — e.g. sort by Jobs = the by-jobs view of the same list).
  const { sorted, sort, toggle } = useSortable(section.runners, RUNNER_ACCESSORS, { key: 'units', dir: 'desc' });
  // Columns: # · Assembly/Workcell · [Plant] · Jobs · Last built · Units · Data.
  // Every column equal 1fr + all LEFT-aligned so they read as evenly-spaced columns.
  const gridClass = showPlant
    ? 'grid-cols-[2rem_minmax(7rem,1.5fr)_1fr_0.9fr_1fr_0.9fr_0.8fr_0.8fr_1.1fr]'
    : 'grid-cols-[2rem_minmax(7rem,1.5fr)_1fr_1fr_0.9fr_0.8fr_0.8fr_1.1fr]';
  return (
    // h-full + max-h: siblings in a grid row stretch to the tallest card (equal
    // heights), capped so a 100-row card scrolls instead of running off-screen.
    <div className="flex h-full max-h-[75vh] flex-col rounded-xl border border-border bg-card overflow-hidden">
      {/* Header + KPI summary (of the shown runners) */}
      <div className="border-b border-border px-4 py-3">
        {showTitle && <h2 className="text-base font-bold text-foreground">{plantLabel(section.plant)}</h2>}
        <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]', showTitle && 'mt-2')}>
          <StatusKpi label="Complete"   n={counts.complete}   pct={pctOf(counts.complete)}   tone="text-emerald-600" />
          <StatusKpi label="Incomplete" n={counts.incomplete} pct={pctOf(counts.incomplete)} tone="text-amber-600" />
          <StatusKpi label="No data"    n={counts.no_data}    pct={pctOf(counts.no_data)}    tone="text-red-500" />
          <StatusKpi label="Unverified" n={counts.unverified} pct={pctOf(counts.unverified)} tone="text-muted-foreground" />
          {counts.na > 0 && <StatusKpi label="N/A" n={counts.na} pct={pctOf(counts.na)} tone="text-muted-foreground" />}
          {counts.pending > 0 && <StatusKpi label="Pending" n={counts.pending} pct={pctOf(counts.pending)} tone="text-muted-foreground" />}
        </div>
        {extraHeader && <div className="mt-3">{extraHeader}</div>}
      </div>

      {/* Column headers — Jobs/Last built/Units/Data are sortable */}
      <div className={cn('grid items-center gap-2 bg-muted/50 px-3 py-1.5 uppercase tracking-wider text-muted-foreground', s.head, gridClass)}>
        <span>#</span>
        <span>Assembly / Workcell</span>
        {showPlant && <span>Plant</span>}
        <SortHeader label="Jobs" active={sort?.key === 'jobs'} dir={sort?.dir} onClick={() => toggle('jobs')} className="!py-0" />
        <SortHeader label={mode !== 'historical' ? 'Planned' : 'Last built'} active={sort?.key === 'last'} dir={sort?.dir} onClick={() => toggle('last')} className="!py-0" />
        <SortHeader label={mode !== 'historical' ? 'Demand' : 'Units'} active={sort?.key === 'units'} dir={sort?.dir} onClick={() => toggle('units')} className="!py-0" />
        <span>LBR</span>
        <span>IPK</span>
        <SortHeader label="Data" active={sort?.key === 'data'} dir={sort?.dir} onClick={() => toggle('data')} className="!py-0" />
      </div>

      {/* Runner rows — flex-1 so the list fills the equalised card height */}
      <div className="flex-1 min-h-0 overflow-auto">
        {sorted.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">No runners.</div>
        ) : (
          sorted.map((r, i) => (
            <RunnerRow
              key={`${r.assembly}-${i}`}
              r={r}
              gridClass={gridClass}
              showPlant={showPlant}
              s={s}
              size={size}
              mode={mode}
              comp={compMap?.get(compKey(r.customer, r.assembly))}
              onCompare={onCompare}
              onNav={onRowClick && (() => onRowClick(r.customer, r.assembly))}
            />
          ))
        )}
      </div>
    </div>
  );
}

function RunnerRow({ r, gridClass, showPlant, s, size, mode = 'historical', comp, onCompare, onNav }: {
  r: CycleTimePlantRunner; gridClass: string; showPlant?: boolean; s: (typeof SIZE)[Size]; size?: Size; mode?: RunnerMode;
  comp?: CompletionModel; onCompare?: CompareFn; onNav?: () => void;
}) {
  const md = (iso: string | null | undefined) => (iso ? iso.slice(5, 10) : '—'); // MM-DD
  const status = comp?.status;
  // Row click opens the drawer (any status → shows whatever data is available).
  const rowOpen = onCompare ? () => onCompare(r.customer, r.assembly, 'route') : undefined;
  const openTab = (tab: 'route' | 'lbr' | 'ipk') => (e: React.MouseEvent) => { e.stopPropagation(); onCompare?.(r.customer, r.assembly, tab); };
  const Tag = rowOpen ? 'button' : 'div';
  return (
    <Tag
      onClick={rowOpen}
      className={cn(
        'grid items-center gap-2 px-3 w-full text-left border-b border-border last:border-0',
        s.row,
        gridClass,
        rowOpen ? 'hover:bg-emerald-500/5 cursor-pointer' : 'hover:bg-muted/40',
        !r.has_data && 'bg-red-500/5',
      )}
    >
      <span className={cn('text-muted-foreground tabular-nums', s.rank)}>{r.rank}</span>
      <div className="min-w-0 leading-tight">
        <p className={cn('font-medium text-foreground truncate', s.asm)}>{r.assembly}</p>
        <p className={cn('text-muted-foreground truncate', s.sub)}>{r.customer}</p>
      </div>
      {showPlant && (
        <span className={cn('text-foreground truncate', s.meta)}>{r.plant ? plantLabel(r.plant) : '—'}</span>
      )}
      <span className={cn('text-muted-foreground tabular-nums whitespace-nowrap', s.meta)}>{r.jobs.toLocaleString()}</span>
      {mode !== 'historical' ? (
        <span
          title={`Demand starts ${fmtDate(r.first_start ?? null)} · due done ${fmtDate(r.planned_finish ?? null)}`}
          className={cn('text-muted-foreground tabular-nums whitespace-nowrap', s.meta)}
        >
          {md(r.first_start)} → {md(r.planned_finish)}
        </span>
      ) : (
        <span className={cn('text-muted-foreground tabular-nums whitespace-nowrap', s.meta)}>{fmtDate(r.last_completed)}</span>
      )}
      <span className={cn('ct-num font-bold tabular-nums text-foreground whitespace-nowrap', s.units)}>{r.units.toLocaleString()}</span>

      {/* LBR — shown for any model with cycle-time data (complete or partial); click opens the Yamazumi. */}
      <MetricCell
        value={comp?.lbr != null ? `${comp.lbr}%` : '—'}
        tone={comp?.lbr != null ? lbrTone(comp.lbr) : 'text-muted-foreground'}
        s={s}
        onClick={onCompare ? openTab('lbr') : undefined}
      />
      {/* IPK — trolley need; click opens the buffer flow. */}
      <MetricCell
        value={comp?.ipk_trolleys != null ? String(comp.ipk_trolleys) : '—'}
        tone={comp?.ipk_trolleys != null ? 'text-foreground' : 'text-muted-foreground'}
        s={s}
        onClick={onCompare ? openTab('ipk') : undefined}
      />

      <span className="flex items-center gap-1.5">
        {status ? (
          <CompletionBadge status={status} size={size === 'lg' ? 'md' : 'sm'} />
        ) : (
          // not computed yet (completion mart still rebuilding) — pending, NOT the old flag
          <span className={cn('text-muted-foreground', s.meta)} title="Completion not computed yet">—</span>
        )}
        {/* Open the workcell's dedicated page (row click opens the drawer). */}
        {onNav && (
          <span
            role="button"
            tabIndex={0}
            title="Open workcell page"
            onClick={(e) => { e.stopPropagation(); onNav(); }}
            className="flex-shrink-0 cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-emerald-600"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </span>
        )}
      </span>
    </Tag>
  );
}

function lbrTone(lbr: number): string {
  return lbr >= 85 ? 'text-emerald-600' : lbr >= 70 ? 'text-amber-600' : 'text-red-500';
}

/** A clickable LBR/IPK value cell. A <span> (not button) — it sits inside the
 *  row button, and the click stops propagation via the openTab handler. */
function MetricCell({ value, tone, s, onClick }: {
  value: string; tone: string; s: (typeof SIZE)[Size]; onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <span
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      className={cn('tabular-nums whitespace-nowrap', tone, s.meta,
        onClick && 'cursor-pointer underline-offset-2 hover:underline decoration-dotted')}
    >
      {value}
    </span>
  );
}

/** Per-workcell STACKED status bar: each workcell's slice of the top-N, segmented
 *  by status (complete / incomplete / no-data / unverified). Segment width = that
 *  status's count as a share of the whole list, so e.g. workcell A = 20% complete
 *  + 5% incomplete + 10% no-data of the top-N. Ranked by total contribution. */
function WorkcellStatusBars({ runners, compMap, topN }: { runners: CycleTimePlantRunner[]; compMap?: CompMap; topN: number }) {
  type WC = { complete: number; incomplete: number; no_data: number; unverified: number; na: number; total: number };
  const byWc = new Map<string, WC>();
  for (const r of runners) {
    const b = bucketOf(compMap?.get(compKey(r.customer, r.assembly))?.status);
    if (b === 'pending') continue;
    const e = byWc.get(r.customer) ?? { complete: 0, incomplete: 0, no_data: 0, unverified: 0, na: 0, total: 0 };
    e[b] += 1; e.total += 1;
    byWc.set(r.customer, e);
  }
  const denom = runners.length || 1;                       // share of the whole list
  const top = [...byWc.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 6);
  if (top.length === 0) return <p className="text-[11px] text-muted-foreground">No status computed yet.</p>;

  const w = (n: number) => `${(n / denom) * 100}%`;
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Status by workcell — share of top {topN}
      </p>
      <div className="space-y-1.5">
        {top.map(([customer, c]) => (
          <div key={customer} className="grid grid-cols-[minmax(5rem,8rem)_1fr_2.5rem] items-center gap-2 text-[11px]">
            <span className="truncate font-medium text-foreground">{customer}</span>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-muted/40" title={`${c.complete} complete · ${c.incomplete} incomplete · ${c.no_data} no data · ${c.unverified} unverified · ${c.na} N/A`}>
              <div className="bg-emerald-500" style={{ width: w(c.complete) }} />
              <div className="bg-amber-500"   style={{ width: w(c.incomplete) }} />
              <div className="bg-red-500"     style={{ width: w(c.no_data) }} />
              <div className="bg-slate-400"   style={{ width: w(c.unverified) }} />
              <div className="bg-slate-300"   style={{ width: w(c.na) }} />
            </div>
            <span className="text-right tabular-nums text-muted-foreground">{c.total}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-muted-foreground">
        <Legend color="bg-emerald-500" label="complete" />
        <Legend color="bg-amber-500" label="incomplete" />
        <Legend color="bg-red-500" label="no data" />
        <Legend color="bg-slate-400" label="unverified" />
        <Legend color="bg-slate-300" label="N/A" />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={cn('h-2 w-2 rounded-sm', color)} /> {label}
    </span>
  );
}

/** KPI tile: "N (P%) Label" — used for the per-section status breakdown. */
function StatusKpi({ label, n, pct, tone }: { label: string; n: number; pct: number; tone?: string }) {
  return (
    <span className="flex items-baseline gap-1 whitespace-nowrap">
      <span className={cn('ct-num font-bold tabular-nums', tone ?? 'text-foreground')}>{n.toLocaleString()}</span>
      <span className="tabular-nums text-muted-foreground">({pct}%)</span>
      <span className="uppercase tracking-wider text-muted-foreground">{label}</span>
    </span>
  );
}
