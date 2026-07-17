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
import { useCycleTimePlantRunners } from '@/hooks/cycle_time/useCycleTimeData';
import type { CycleTimePlant, CycleTimePlantRunner } from '@/lib/cycle_time/cycleTimeApi';
import { exportPlantRunnersXlsx } from '@/lib/cycle_time/cycleTimeExport';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight, Download, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

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
  const [overallMode, setOverallMode] = useState<RunnerMode>('historical');
  const [regionMode, setRegionMode] = useState<RunnerMode>('historical');
  const [byPlantMode, setByPlantMode] = useState<RunnerMode>('historical');

  const [exporting, setExporting] = useState(false);

  const dataFor = (m: RunnerMode) => (m === 'planner' ? plan.data : m === 'projection' ? proj.data : hist.data);

  const openReport = (customer: string, assembly?: string) =>
    navigate(`/cycle-time/wc/${encodeURIComponent(customer)}?tab=report`
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
              Projection = MES demand (next 4 wk) · Planner Demand = planners' forecast (next 13 wk, partial coverage)
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
                  extraHeader={<WorkcellNoDataBars runners={overallData.overall.runners} topN={TOP_N} />}
                  onRowClick={openReport}
                />
              ) : <Unavailable />}
            </Section>

            {/* ── Region (Batu Kawan vs Penang Island) ── */}
            <Section
              title="Region" open={regionOpen} onToggle={() => setRegionOpen((v) => !v)}
              right={<ModeToggle mode={regionMode} onChange={setRegionMode} />}
            >
              {regionData ? (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {(regionData.regions ?? []).map((reg) => (
                    <RunnerCard
                      key={reg.plant}
                      section={reg}
                      showTitle
                      showPlant
                      size="md"
                      mode={regionMode}
                      extraHeader={<WorkcellNoDataBars runners={reg.runners} topN={TOP_N} />}
                      onRowClick={openReport}
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
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  {byPlantData.plants.map((p) => (
                    <RunnerCard
                      key={p.plant}
                      section={p}
                      showTitle
                      size="sm"
                      mode={byPlantMode}
                      extraHeader={<WorkcellNoDataBars runners={p.runners} topN={TOP_N} />}
                      onRowClick={openReport}
                    />
                  ))}
                </div>
              ) : <Unavailable />}
            </Section>
          </>
        )}
      </div>
    </div>
  );
}

/** Historical (built units) vs Projection (planned demand) segmented toggle. */
function ModeToggle({ mode, onChange }: { mode: RunnerMode; onChange: (m: RunnerMode) => void }) {
  return (
    <div className="inline-flex flex-shrink-0 rounded-lg border border-border bg-card p-0.5">
      {(['historical', 'projection', 'planner'] as RunnerMode[]).map((m) => (
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

function RunnerCard({ section, showTitle, showPlant, size = 'md', extraHeader, onRowClick, mode = 'historical' }: {
  section: CycleTimePlant; showTitle: boolean; showPlant?: boolean; size?: Size;
  extraHeader?: React.ReactNode; onRowClick?: (customer: string, assembly: string) => void;
  mode?: RunnerMode;
}) {
  const s = SIZE[size];
  // KPIs reflect only the top-N runners shown below, not the whole plant.
  const shownHas = section.runners.filter((r) => r.has_data).length;
  const shownNo = section.runners.length - shownHas;
  // Sortable within the shown top-N (population stays "top-N by units"; this just
  // re-orders it — e.g. sort by Jobs = the by-jobs view of the same list).
  const { sorted, sort, toggle } = useSortable(section.runners, RUNNER_ACCESSORS, { key: 'units', dir: 'desc' });
  // Columns: # · Assembly/Workcell · [Plant] · Jobs · Last built · Units · Data.
  // Every column equal 1fr + all LEFT-aligned so they read as evenly-spaced columns.
  const gridClass = showPlant
    ? 'grid-cols-[2rem_minmax(7rem,1.6fr)_1fr_1fr_1fr_1fr_1fr]'
    : 'grid-cols-[2rem_minmax(7rem,1.6fr)_1fr_1fr_1fr_1fr]';
  return (
    // h-full + max-h: siblings in a grid row stretch to the tallest card (equal
    // heights), capped so a 100-row card scrolls instead of running off-screen.
    <div className="flex h-full max-h-[75vh] flex-col rounded-xl border border-border bg-card overflow-hidden">
      {/* Header + KPI summary (of the shown runners) */}
      <div className="border-b border-border px-4 py-3">
        {showTitle && <h2 className="text-base font-bold text-foreground">{plantLabel(section.plant)}</h2>}
        <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]', showTitle && 'mt-2')}>
          <Kpi label="has data" value={shownHas.toLocaleString()} tone="text-emerald-600" />
          <Kpi label="no data" value={shownNo.toLocaleString()} tone="text-red-500" />
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
              mode={mode}
              onClick={onRowClick && (() => onRowClick(r.customer, r.assembly))}
            />
          ))
        )}
      </div>
    </div>
  );
}

function RunnerRow({ r, gridClass, showPlant, s, mode = 'historical', onClick }: {
  r: CycleTimePlantRunner; gridClass: string; showPlant?: boolean; s: (typeof SIZE)[Size]; mode?: RunnerMode; onClick?: () => void;
}) {
  const Tag = onClick ? 'button' : 'div';
  const md = (iso: string | null | undefined) => (iso ? iso.slice(5, 10) : '—'); // MM-DD
  return (
    <Tag
      onClick={onClick}
      className={cn(
        'grid items-center gap-2 px-3 w-full text-left border-b border-border last:border-0',
        s.row,
        gridClass,
        onClick ? 'hover:bg-emerald-500/5 cursor-pointer' : 'hover:bg-muted/40',
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
      <span>
        <span
          className={cn(
            'inline-flex items-center rounded-full font-semibold uppercase tracking-wide whitespace-nowrap',
            s.badge,
            r.has_data ? 'bg-emerald-500/15 text-emerald-600' : 'bg-red-500/15 text-red-600',
          )}
        >
          {r.has_data ? 'Has data' : 'No data'}
        </span>
      </span>
    </Tag>
  );
}

/** Top-5 workcells by their share of the top-N runners that have NO cycle-time
 *  data. Breakdown is by COUNT of no-data assemblies (models) — e.g. if 40 of
 *  the top-N have no data and 20 are workcell A → A = 50%, 20. Ranked highest. */
function WorkcellNoDataBars({ runners, topN }: { runners: CycleTimePlantRunner[]; topN: number }) {
  const byWc = new Map<string, number>();
  for (const r of runners) if (!r.has_data) byWc.set(r.customer, (byWc.get(r.customer) ?? 0) + 1);
  const totalNoData = [...byWc.values()].reduce((a, b) => a + b, 0);
  const top5 = [...byWc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  if (top5.length === 0) {
    return <p className="text-[11px] text-muted-foreground">No missing-data models in the top {topN}. 🎉</p>;
  }
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        No-data models by workcell — {totalNoData} of top {topN}
      </p>
      <div className="space-y-1.5">
        {top5.map(([customer, count]) => {
          const pct = totalNoData ? (count / totalNoData) * 100 : 0;
          return (
            <div key={customer} className="grid grid-cols-[minmax(5rem,9rem)_1fr_5rem] items-center gap-2 text-[11px]">
              <span className="truncate font-medium text-foreground">{customer}</span>
              <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                <div className="h-full rounded-full bg-red-500" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-right tabular-nums text-muted-foreground whitespace-nowrap">
                {pct.toFixed(0)}% · {count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <span className="flex items-baseline gap-1">
      <span className={cn('ct-num font-bold tabular-nums', tone ?? 'text-foreground')}>{value}</span>
      <span className="text-muted-foreground uppercase tracking-wider">{label}</span>
    </span>
  );
}
