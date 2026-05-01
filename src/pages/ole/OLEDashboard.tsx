import WorkcellBadge from '@/components/ole/WorkcellBadge';
import { useOlePaidHours, useOleProduction, useOleResults, useOleSummary, useOleWorkcells, useSmhStatus } from '@/hooks/useOleData';
import type { OlePaidHours, OleProduction, OleResult, OleSummary, SmhStatus } from '@/lib/oleApi';
import { getOleStatus, OLE_BAR, OLE_COLOR, QUALITY_BADGE, shiftLabel, SMH_STATUS_BADGE, STAGE_BADGE, STATUS_BADGE, STATUS_LABEL } from '@/lib/oleConstants';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  WifiOff
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import OLEAnalysis from './OLEAnalysis';
import OLEFilters from './OLEFilters';
import OLEReport from './OLEReport';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;
const VIRTUAL_THRESHOLD = 300;
const ROW_HEIGHT = 56;
const ALL = '__all__';

const TABS = [
  { id: 'report', label: 'Overview' },
  { id: 'summary', label: 'Summary' },
  { id: 'analysis', label: 'Analysis' },
  { id: 'shifts', label: 'Shift Detail' },
  { id: 'production', label: 'Production' },
  { id: 'paid_hours', label: 'Paid Hours' },
] as const;


type TabId = typeof TABS[number]['id'];
type SortDir = 'asc' | 'desc';

// ─── Plant → workcell mapping (API-driven via useOleWorkcells) ─────────────
// matchesPlant uses the plant field from /api/workcells — no hardcoding needed.
function matchesPlant(workcellName: string, plant: string, workcellConfigs: { workcell: string; plant: string }[]): boolean {
  if (!plant) return true;
  const cfg = workcellConfigs.find(c => c.workcell === workcellName);
  return cfg ? cfg.plant === plant : false;
}

// ─── Table components ────────────────────────────────────────────────────────

// ─── Sort icon ────────────────────────────────────────────────────────────────

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-30" />;
  return dir === 'asc'
    ? <ChevronUp className="w-3 h-3 ml-1" />
    : <ChevronDown className="w-3 h-3 ml-1" />;
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({ page, total, pageSize, onChange }: {
  page: number; total: number; pageSize: number; onChange: (p: number) => void;
}) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-3 px-1">
      <span className="text-xs text-muted-foreground">
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total.toLocaleString()}
      </span>
      <div className="flex items-center gap-1">
        <button onClick={() => onChange(1)} disabled={page === 1}
          className="px-2 py-1 text-xs rounded border border-border text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">«</button>
        <button onClick={() => onChange(page - 1)} disabled={page === 1}
          className="px-2 py-1 text-xs rounded border border-border text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">‹</button>
        <span className="px-3 py-1 text-xs font-mono text-foreground">{page} / {pages}</span>
        <button onClick={() => onChange(page + 1)} disabled={page === pages}
          className="px-2 py-1 text-xs rounded border border-border text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">›</button>
        <button onClick={() => onChange(pages)} disabled={page === pages}
          className="px-2 py-1 text-xs rounded border border-border text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">»</button>
      </div>
    </div>
  );
}

// ─── Virtual scroller ─────────────────────────────────────────────────────────

function VirtualTable({ rows, renderRow, renderHeader, rowHeight = ROW_HEIGHT, height = 520 }: {
  rows: unknown[];
  renderRow: (row: unknown, idx: number) => React.ReactNode;
  renderHeader: () => React.ReactNode;
  rowHeight?: number;
  height?: number;
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const visibleCount = Math.ceil(height / rowHeight) + 4;
  const startIdx = Math.max(0, Math.floor(scrollTop / rowHeight) - 2);
  const endIdx = Math.min(rows.length, startIdx + visibleCount);
  const totalHeight = rows.length * rowHeight;
  const offsetTop = startIdx * rowHeight;

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-card">
      {renderHeader()}
      <div style={{ height, overflowY: 'auto' }}
        onScroll={e => setScrollTop((e.target as HTMLDivElement).scrollTop)}
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          <div style={{ position: 'absolute', top: offsetTop, width: '100%' }}>
            {rows.slice(startIdx, endIdx).map((row, i) => renderRow(row, startIdx + i))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Generic sort helper ──────────────────────────────────────────────────────

function sortRows<T>(rows: T[], col: string, dir: SortDir): T[] {
  if (!col) return rows;
  const mul = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = (a as Record<string, unknown>)[col];
    const vb = (b as Record<string, unknown>)[col];
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === 'number' && typeof vb === 'number') return mul * (va - vb);
    return mul * String(va).localeCompare(String(vb), undefined, { numeric: true });
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function OLEOverview() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<TabId>('report');
  const [search, setSearch] = useState('');
  const [workcell, setWorkcell] = useState('');
  const [plant, setPlant] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [shift, setShift] = useState('');
  const [smhFilter, setSmhFilter] = useState('');
  const [sortCol, setSortCol] = useState('');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [activeTab, workcell, plant, dateFrom, dateTo, shift, smhFilter, search]);

  const toggleSort = useCallback((col: string) => {
    setSortCol(prev => {
      if (prev === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
      else { setSortDir('desc'); }
      return col;
    });
    setPage(1);
  }, []);

  // ── Data ─────────────────────────────────────────────────────────────────
  const workcellsHook = useOleWorkcells();
  const workcellConfigs = workcellsHook.data ?? [];

  // Derive plant options dynamically from API
  const plantOptions = useMemo(() => {
    const plants = Array.from(new Set(workcellConfigs.map(c => c.plant))).sort();
    return plants;
  }, [workcellConfigs]);

  const summaryHook = useOleSummary({
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  });
  const shiftsHook = useOleResults({
    workcell: workcell || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    shift: shift ? Number(shift) : undefined,
  });
  const productionHook = useOleProduction({
    workcell: workcell || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  });
  const paidHoursHook = useOlePaidHours({
    workcell: workcell || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  });
  const smhHook = useSmhStatus({
    workcell: workcell || undefined,
    status: smhFilter as SmhStatus['smh_status'] || undefined,
  });

  const hookMap: Partial<Record<TabId, any>> = { summary: summaryHook, shifts: shiftsHook, production: productionHook, paid_hours: paidHoursHook, smh: smhHook };
  const activeHook = hookMap[activeTab] ?? summaryHook;

  // ── Workcell options ──────────────────────────────────────────────────────
  const workcellOptions = useMemo(() =>
    Array.from(new Set((summaryHook.data ?? []).map(r => r.workcell))).sort()
    , [summaryHook.data]);

  // ── Global summary stats ──────────────────────────────────────────────────
  const summaryRows = summaryHook.data ?? [];
  const totalOutput = summaryRows.reduce((s, r) => s + (r.total_output_smh || 0), 0);
  const totalInput = summaryRows.reduce((s, r) => s + (r.total_input_hours || 0), 0);
  const avgOle = totalInput > 0 ? ((totalOutput / totalInput) * 100).toFixed(2) : '—';
  const totalQty = summaryRows.reduce((s, r) => s + r.total_qty, 0);
  const flaggedTotal = summaryRows.reduce((s, r) => s + r.flagged_shifts, 0);

  // ── Filtered + sorted rows per tab ───────────────────────────────────────
  const filteredSummary = useMemo(() => {
    let list = summaryRows.filter(r =>
      (!search || r.workcell.toLowerCase().includes(search.toLowerCase())) &&
      matchesPlant(r.workcell, plant, workcellConfigs)
    );
    return sortRows(list, sortCol, sortDir) as OleSummary[];
  }, [summaryRows, search, plant, sortCol, sortDir]);

  const filteredShifts = useMemo(() => {
    let list = (shiftsHook.data ?? []).filter(r =>
      (!search || r.workcell.toLowerCase().includes(search.toLowerCase()) || r.date.includes(search)) &&
      matchesPlant(r.workcell, plant, workcellConfigs)
    );
    return sortRows(list, sortCol, sortDir) as OleResult[];
  }, [shiftsHook.data, search, plant, sortCol, sortDir]);

  const filteredProd = useMemo(() => {
    let list = (productionHook.data ?? []).filter(r =>
      (!search || r.workcell.toLowerCase().includes(search.toLowerCase()) || r.assembly.toLowerCase().includes(search.toLowerCase())) &&
      matchesPlant(r.workcell, plant, workcellConfigs)
    );
    return sortRows(list, sortCol, sortDir) as OleProduction[];
  }, [productionHook.data, search, plant, sortCol, sortDir]);

  const filteredHours = useMemo(() => {
    let list = (paidHoursHook.data ?? []).filter(r =>
      (!search || r.workcell.toLowerCase().includes(search.toLowerCase())) &&
      matchesPlant(r.workcell, plant, workcellConfigs)
    );
    return sortRows(list, sortCol, sortDir) as OlePaidHours[];
  }, [paidHoursHook.data, search, plant, sortCol, sortDir]);

  const filteredSmh = useMemo(() => {
    let list = (smhHook.data ?? []).filter(r =>
      (!search || r.assembly.toLowerCase().includes(search.toLowerCase()) || r.workcell.toLowerCase().includes(search.toLowerCase())) &&
      matchesPlant(r.workcell, plant, workcellConfigs)
    );
    return sortRows(list, sortCol, sortDir) as SmhStatus[];
  }, [smhHook.data, search, plant, sortCol, sortDir]);

  const rowCounts: Record<TabId, number> = {
    report: 0,
    summary: filteredSummary.length,
    analysis: 0,
    shifts: filteredShifts.length,
    production: filteredProd.length,
    paid_hours: filteredHours.length,
    smh: filteredSmh.length,
  };

  // ── Paginated slices ──────────────────────────────────────────────────────
  const slice = <T,>(arr: T[]) => arr.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const showDateFilters = ['summary', 'analysis', 'shifts', 'production', 'paid_hours'].includes(activeTab);
  const showShiftFilter = activeTab === 'shifts';
  const showSmhFilter = activeTab === 'smh';
  const showFilters = !['report', 'analysis'].includes(activeTab);

  const onNavigateTab = useCallback((tab: string, wc?: string) => {
    setActiveTab(tab as TabId);
    if (wc) setWorkcell(wc);
    setSortCol('');
    setSearch('');
  }, []);

  return (
    <div className="space-y-0">

      {/* ── Sticky header ──────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-background border-b border-border px-6">
        <div className="pt-4 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-foreground">OLE Analyzer</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {activeHook.loading ? 'Loading…' : activeHook.error ? 'OLE backend unreachable' : 'Overall Labor Effectiveness — Penang plants'}
              </p>
            </div>
            <div className="flex items-center gap-4">
              {activeHook.error && (
                <span className="flex items-center gap-1.5 text-xs text-destructive">
                  <WifiOff className="h-3.5 w-3.5" /> API offline
                </span>
              )}
              <button onClick={() => activeHook.refetch()} disabled={activeHook.loading}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', activeHook.loading && 'animate-spin')} />
                Refresh
              </button>
              <div className="hidden md:flex items-center gap-6 text-sm font-mono">
                <span className="text-muted-foreground">Avg OLE <span className="text-foreground font-semibold">{avgOle}{avgOle !== '—' ? '%' : ''}</span></span>
                <span className="text-muted-foreground">Total Qty <span className="text-foreground font-semibold">{totalQty.toLocaleString()}</span></span>
                {flaggedTotal > 0 && (
                  <span className="text-amber-400 font-semibold flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" />{flaggedTotal} flagged
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex items-center gap-0 -mb-px">
          {TABS.map(tab => (
            <button key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSortCol(''); setSearch(''); }}
              className={cn(
                'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                activeTab === tab.id
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              )}
            >
              {tab.label}
              {rowCounts[tab.id] > 0 && (
                <span className="ml-2 text-[10px] font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                  {rowCounts[tab.id].toLocaleString()}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── REPORT tab ── */}
      {activeTab === 'report' && (
        <OLEReport onNavigateTab={onNavigateTab} />
      )}

      {/* ── ANALYSIS tab ── */}
      {activeTab === 'analysis' && (
        <OLEAnalysis
          search={search} setSearch={setSearch}
          workcell={workcell} setWorkcell={setWorkcell}
          plant={plant} setPlant={setPlant}
          plantOptions={plantOptions}
          dateFrom={dateFrom} setDateFrom={setDateFrom}
          dateTo={dateTo} setDateTo={setDateTo}
          workcellOptions={workcellOptions}
          rowCount={rowCounts[activeTab]}
        />
      )}



      {/* ── Filters + content for data tabs ── */}
      {showFilters && (<>
        <OLEFilters
          search={search} setSearch={setSearch}
          workcell={workcell} setWorkcell={setWorkcell}
          plant={plant} setPlant={setPlant}
          plantOptions={plantOptions}
          dateFrom={showDateFilters ? dateFrom : undefined}
          setDateFrom={showDateFilters ? setDateFrom : undefined}
          dateTo={showDateFilters ? dateTo : undefined}
          setDateTo={showDateFilters ? setDateTo : undefined}
          shift={showShiftFilter ? shift : undefined}
          setShift={showShiftFilter ? setShift : undefined}
          smhFilter={showSmhFilter ? smhFilter : undefined}
          setSmhFilter={showSmhFilter ? setSmhFilter : undefined}
          workcellOptions={workcellOptions}
          rowCount={rowCounts[activeTab]}
          activeTab={activeTab}
        />

        {/* ── Content ─────────────────────────────────────────────────────────── */}
        <div className="px-6 pb-8 pt-4">

          {activeHook.loading && rowCounts[activeTab] === 0 && (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => <div key={i} className="h-12 rounded-xl bg-muted/40 animate-pulse" />)}
            </div>
          )}

          {/* ── ANALYSIS tab (moved outside) ── */}

          {/* ── SUMMARY tab ── */}
          {activeTab === 'summary' && (() => {
            const allRows = filteredSummary;
            const GT = '2.5rem minmax(10rem, 1fr) 7.5rem 9.5rem 9rem 9rem 9rem 6.5rem 7.5rem';
            return (
              <div className="rounded-xl border border-border overflow-hidden bg-card">
                {/* table header */}
                <div className="grid bg-muted/50 border-b border-border text-xs text-muted-foreground font-medium uppercase tracking-wider"
                  style={{ gridTemplateColumns: GT }}>
                  <div className="px-4 py-3 text-center">#</div>
                  {([
                    ['workcell', 'Workcell'], ['stage_label', 'Final Scan'],
                    ['avg_ole_pct', 'OLE %'],
                    ['total_output_smh', 'Output SMH'],
                    ['total_input_hours', 'Input Hrs'], ['transferred_man_hours', 'Transferred MH'], ['total_qty', 'QTY'], ['', 'Status'],
                  ] as [string, string][]).map(([col, label]) =>
                    col ? (
                      <button key={col} onClick={() => toggleSort(col)}
                        className="px-3 py-3 text-left flex items-center hover:text-foreground transition-colors">
                        {label} <SortIcon active={sortCol === col} dir={sortDir} />
                      </button>
                    ) : <div key={label} className="px-3 py-3 text-center">{label}</div>
                  )}
                </div>

                {allRows.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground text-sm">
                    {activeHook.error ? 'Backend unreachable — is the OLE API running?' : 'No data'}
                  </div>
                ) : allRows.map((row, idx) => {
                  const calcOle = row.total_input_hours > 0 ? (row.total_output_smh / row.total_input_hours) * 100 : 0;
                  const status = getOleStatus(calcOle);
                  return (
                    <div key={row.workcell}
                      className="grid items-center text-sm border-b border-border last:border-0 hover:bg-muted/40 transition-colors"
                      style={{ gridTemplateColumns: GT }}
                    >
                      <div className="px-4 py-3.5 text-center text-xs text-muted-foreground font-mono">{idx + 1}</div>

                      <button onClick={() => navigate(`/ole/${encodeURIComponent(row.workcell)}`)} className="px-4 py-3.5 flex items-center gap-3 text-left group w-full cursor-pointer">
                        <WorkcellBadge name={row.workcell} status={status} />
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">{row.workcell}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5 whitespace-nowrap">Latest: {row.latest_date ?? '—'}</p>
                        </div>
                      </button>

                      <button onClick={() => navigate(`/ole/smh-status?workcell=${encodeURIComponent(row.workcell)}`)} className="px-3 py-3.5 flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity">
                        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap', STAGE_BADGE[row.stage_label] ?? 'bg-muted text-muted-foreground border-border')}>{row.stage_label}</span>
                      </button>

                      <div className="px-3 py-3.5 text-center">
                        <span className={cn('text-lg font-mono font-bold', OLE_COLOR[status])}>{row.total_input_hours > 0 ? `${calcOle.toFixed(2)}%` : '—'}</span>
                        <div className="mt-1 h-1 rounded-full bg-muted/50 overflow-hidden"><div className={cn('h-full rounded-full', OLE_BAR[status])} style={{ width: `${Math.min(calcOle, 100)}%` }} /></div>
                      </div>

                      <button onClick={() => { setActiveTab('shifts'); setWorkcell(row.workcell); }} className="px-3 py-3.5 text-center cursor-pointer hover:text-primary transition-colors">
                        <span className="font-mono text-sm font-semibold text-foreground">{Math.round(row.total_output_smh).toLocaleString()}</span>
                        <p className="text-[10px] text-muted-foreground">hrs</p>
                      </button>

                      <button onClick={() => { setActiveTab('paid_hours'); setWorkcell(row.workcell); }} className="px-3 py-3.5 text-center cursor-pointer hover:text-primary transition-colors">
                        <span className="font-mono text-sm font-semibold text-foreground">{Math.round(row.total_input_hours).toLocaleString()}</span>
                        <p className="text-[10px] text-muted-foreground">hrs</p>
                      </button>

                      <div className="px-3 py-3.5 text-center">
                        <span className="font-mono text-sm font-semibold text-muted-foreground">—</span>
                        <p className="text-[10px] text-muted-foreground">hrs</p>
                      </div>

                      <div className="px-3 py-3.5 text-center">
                        <span className="font-mono text-sm font-semibold text-foreground">{row.total_qty != null ? row.total_qty.toLocaleString() : '—'}</span>
                        <p className="text-[10px] text-muted-foreground">units</p>
                      </div>

                      <div className="px-3 py-3.5 flex items-center justify-center">
                        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap', STATUS_BADGE[status])}>{STATUS_LABEL[status]}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* ── SHIFTS tab ── */}
          {activeTab === 'shifts' && (() => {
            const gt = { gridTemplateColumns: '2.5rem 1fr 6rem 4rem 7rem 6rem 7rem 7rem 6rem 7rem 8rem' };
            const renderHeader = () => (
              <div className="grid bg-muted/50 border-b border-border text-xs text-muted-foreground font-medium uppercase tracking-wider" style={gt}>
                <div className="px-4 py-3 text-center">#</div>
                {([
                  ['workcell', 'Workcell'], ['date', 'Date'], ['shift', 'Shift'],
                  ['ole_pct', 'OLE %'], ['smh_coverage_pct', 'SMH Cov.'],
                  ['effective_output_smh', 'Output SMH'], ['total_input_hours', 'Input Hrs'],
                  ['total_qty', 'Qty'], ['assembly_count', 'Assemblies'], ['data_quality', 'Quality'],
                ] as [string, string][]).map(([col, label]) => (
                  <button key={col} onClick={() => toggleSort(col)}
                    className="px-3 py-3 text-left flex items-center hover:text-foreground transition-colors"
                  >{label} <SortIcon active={sortCol === col} dir={sortDir} /></button>
                ))}
              </div>
            );
            const renderRow = (rowRaw: unknown, idx: number) => {
              const row = rowRaw as OleResult;
              const status = getOleStatus(row.ole_pct);
              return (
                <div key={`${row.workcell}-${row.date}-${row.shift}`}
                  className="grid items-center text-sm border-b border-border last:border-0 hover:bg-muted/40 transition-colors"
                  style={{ ...gt, height: ROW_HEIGHT }}
                >
                  <div className="px-4 text-center text-xs text-muted-foreground font-mono">{idx + 1}</div>
                  <div className="px-3 flex items-center gap-2.5">
                    <WorkcellBadge name={row.workcell} status={getOleStatus(row.ole_pct)} />
                    <span className="font-semibold text-foreground truncate">{row.workcell}</span>
                  </div>
                  <div className="px-3 font-mono text-xs text-foreground">{row.date}</div>
                  <div className="px-3 text-center font-mono font-semibold text-foreground">{shiftLabel(row.shift)}</div>
                  <div className="px-3 text-center">
                    <span className={cn('font-mono font-bold', OLE_COLOR[status])}>{row.ole_pct !== null ? `${row.ole_pct}%` : '—'}</span>
                  </div>
                  <div className="px-3 text-center">
                    <span className={cn('text-xs font-mono font-semibold',
                      (row.smh_coverage_pct ?? 0) >= 90 ? 'text-emerald-400' :
                        (row.smh_coverage_pct ?? 0) >= 70 ? 'text-amber-400' : 'text-red-400'
                    )}>{row.smh_coverage_pct !== null ? `${row.smh_coverage_pct}%` : '—'}</span>
                  </div>
                  <div className="px-3 text-center font-mono text-sm text-foreground">{row.effective_output_smh.toFixed(2)}</div>
                  <div className="px-3 text-center font-mono text-sm text-foreground">{row.total_input_hours.toFixed(2)}</div>
                  <div className="px-3 text-center font-mono text-sm text-foreground">{row.total_qty.toLocaleString()}</div>
                  <div className="px-3 text-center font-mono text-sm text-foreground">{row.assembly_count}</div>
                  <div className="px-3 flex justify-center">
                    <span className={cn('text-[10px] font-semibold px-2 py-1 rounded-full border', QUALITY_BADGE[row.data_quality] ?? '')}>
                      {row.data_quality}
                    </span>
                  </div>
                </div>
              );
            };
            return filteredShifts.length > VIRTUAL_THRESHOLD ? (
              <VirtualTable rows={filteredShifts} renderHeader={renderHeader} renderRow={renderRow} />
            ) : (
              <>
                <div className="rounded-xl border border-border overflow-x-auto bg-card">
                  {renderHeader()}
                  {filteredShifts.length === 0
                    ? <div className="py-12 text-center text-muted-foreground text-sm">No shift data</div>
                    : slice(filteredShifts).map((r, i) => renderRow(r, (page - 1) * PAGE_SIZE + i))}
                </div>
                <Pagination page={page} total={filteredShifts.length} pageSize={PAGE_SIZE} onChange={setPage} />
              </>
            );
          })()}

          {/* ── PRODUCTION tab ── */}
          {activeTab === 'production' && (() => {
            const gt = { gridTemplateColumns: '2.5rem 1fr 7rem 1fr 5rem 7rem 4rem' };
            const renderHeader = () => (
              <div className="grid bg-muted/50 border-b border-border text-xs text-muted-foreground font-medium uppercase tracking-wider" style={gt}>
                <div className="px-4 py-3 text-center">#</div>
                {([
                  ['workcell', 'Workcell'], ['sub_workcell', 'Stage'], ['assembly', 'Assembly'],
                  ['qty', 'Qty'], ['date', 'Date'], ['shift', 'Shift'],
                ] as [string, string][]).map(([col, label]) => (
                  <button key={col} onClick={() => toggleSort(col)}
                    className="px-3 py-3 text-left flex items-center hover:text-foreground transition-colors"
                  >{label} <SortIcon active={sortCol === col} dir={sortDir} /></button>
                ))}
              </div>
            );
            const renderRow = (rowRaw: unknown, idx: number) => {
              const row = rowRaw as OleProduction;
              return (
                <div key={`${row.workcell}-${row.assembly}-${row.date}-${row.shift}-${idx}`}
                  className="grid items-center text-sm border-b border-border last:border-0 hover:bg-muted/40 transition-colors"
                  style={{ ...gt, height: ROW_HEIGHT }}
                >
                  <div className="px-4 text-center text-xs text-muted-foreground font-mono">{idx + 1}</div>
                  <div className="px-3 flex items-center gap-2.5">
                    <WorkcellBadge name={row.workcell} status="idle" />
                    <span className="font-semibold text-foreground truncate">{row.workcell}</span>
                  </div>
                  <div className="px-3">
                    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border', STAGE_BADGE[row.sub_workcell] ?? 'bg-muted text-muted-foreground border-border')}>
                      {row.sub_workcell}
                    </span>
                  </div>
                  <div className="px-3 font-mono text-xs text-foreground truncate" title={row.assembly}>{row.assembly}</div>
                  <div className="px-3 text-center font-mono font-semibold text-foreground">{row.qty.toLocaleString()}</div>
                  <div className="px-3 font-mono text-xs text-foreground">{row.date}</div>
                  <div className="px-3 text-center font-mono font-semibold text-foreground">{shiftLabel(row.shift)}</div>
                </div>
              );
            };
            return filteredProd.length > VIRTUAL_THRESHOLD ? (
              <VirtualTable rows={filteredProd} renderHeader={renderHeader} renderRow={renderRow} />
            ) : (
              <>
                <div className="rounded-xl border border-border overflow-x-auto bg-card">
                  {renderHeader()}
                  {filteredProd.length === 0
                    ? <div className="py-12 text-center text-muted-foreground text-sm">No production data</div>
                    : slice(filteredProd).map((r, i) => renderRow(r, (page - 1) * PAGE_SIZE + i))}
                </div>
                <Pagination page={page} total={filteredProd.length} pageSize={PAGE_SIZE} onChange={setPage} />
              </>
            );
          })()}

          {/* ── PAID HOURS tab ── */}
          {activeTab === 'paid_hours' && (() => {
            const gt = { gridTemplateColumns: '2.5rem 1fr 7rem 4rem 5rem 6rem 7rem 8rem 8rem' };
            return (
              <>
                <div className="rounded-xl border border-border overflow-x-auto bg-card">
                  <div className="grid bg-muted/50 border-b border-border text-xs text-muted-foreground font-medium uppercase tracking-wider" style={gt}>
                    <div className="px-4 py-3 text-center">#</div>
                    {([
                      ['workcell', 'Workcell'], ['date', 'Date'], ['shift', 'Shift'],
                      ['thc_direct', 'Direct HC'], ['tph_direct', 'Direct Hrs'],
                      ['value_type', 'Type'], ['name', 'Employee'],
                      ['total_input_hours', 'Total Input'],
                    ] as [string, string][]).map(([col, label]) => (
                      <button key={col} onClick={() => toggleSort(col)}
                        className="px-3 py-3 text-left flex items-center hover:text-foreground transition-colors"
                      >{label} <SortIcon active={sortCol === col} dir={sortDir} /></button>
                    ))}
                  </div>
                  {filteredHours.length === 0
                    ? <div className="py-12 text-center text-muted-foreground text-sm">No paid hours data</div>
                    : slice(filteredHours).map((row, i) => (
                      <div key={`${row.workcell}-${row.date}-${row.shift}-${row.name}-${i}`}
                        className="grid items-center text-sm border-b border-border last:border-0 hover:bg-muted/40 transition-colors"
                        style={gt}
                      >
                        <div className="px-4 py-3 text-center text-xs text-muted-foreground font-mono">{(page - 1) * PAGE_SIZE + i + 1}</div>
                        <div className="px-3 py-3 flex items-center gap-2.5">
                          <WorkcellBadge name={row.workcell} status="idle" />
                          <span className="font-semibold text-foreground truncate">{row.workcell}</span>
                        </div>
                        <div className="px-3 py-3 font-mono text-xs text-foreground">{row.date}</div>
                        <div className="px-3 py-3 text-center font-mono font-semibold text-foreground">{shiftLabel(row.shift)}</div>
                        <div className="px-3 py-3 text-center font-mono text-sm text-foreground">{row.thc_direct}</div>
                        <div className="px-3 py-3 text-center font-mono text-sm text-foreground">{row.tph_direct.toFixed(2)}</div>
                        <div className="px-3 py-3 text-center">
                          <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border',
                            row.value_type === 'VA' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
                              row.value_type === 'NVA' ? 'bg-red-500/15 text-red-400 border-red-500/30' :
                                'bg-muted text-muted-foreground border-border'
                          )}>{row.value_type || 'NVA'}</span>
                        </div>
                        <div className="px-3 py-3 text-xs text-foreground truncate">{row.name}</div>
                        <div className="px-3 py-3 text-center font-mono font-bold text-foreground">{row.total_input_hours.toFixed(2)}</div>
                      </div>
                    ))}
                </div>
                <Pagination page={page} total={filteredHours.length} pageSize={PAGE_SIZE} onChange={setPage} />
              </>
            );
          })()}

          {/* ── SMH COVERAGE tab ── */}
          {activeTab === 'smh' && (() => {
            const gt = { gridTemplateColumns: '2.5rem 1fr 1fr 6rem 7rem 5rem 6rem 6rem 8rem' };
            const renderHeader = () => (
              <div className="grid bg-muted/50 border-b border-border text-xs text-muted-foreground font-medium uppercase tracking-wider" style={gt}>
                <div className="px-4 py-3 text-center">#</div>
                {([
                  ['workcell', 'Workcell'], ['assembly', 'Assembly'], ['smh_value', 'SMH/unit'],
                  ['total_qty_produced', 'Qty Produced'], ['active_days', 'Days Active'],
                  ['first_seen_date', 'First Seen'], ['last_seen_date', 'Last Seen'],
                  ['smh_status', 'Status'],
                ] as [string, string][]).map(([col, label]) => (
                  <button key={col} onClick={() => toggleSort(col)}
                    className="px-3 py-3 text-left flex items-center hover:text-foreground transition-colors"
                  >{label} <SortIcon active={sortCol === col} dir={sortDir} /></button>
                ))}
              </div>
            );
            const renderRow = (rowRaw: unknown, idx: number) => {
              const row = rowRaw as SmhStatus;
              return (
                <div key={`${row.workcell}-${row.assembly}`}
                  className="grid items-center text-sm border-b border-border last:border-0 hover:bg-muted/40 transition-colors"
                  style={{ ...gt, height: ROW_HEIGHT }}
                >
                  <div className="px-4 text-center text-xs text-muted-foreground font-mono">{idx + 1}</div>
                  <div className="px-3 flex items-center gap-2.5">
                    <WorkcellBadge name={row.workcell} status={row.smh_status === 'OK' ? 'optimal' : row.smh_status === 'MISSING_SMH' ? 'warning' : 'critical'} />
                    <span className="font-semibold text-foreground truncate">{row.workcell}</span>
                  </div>
                  <div className="px-3 font-mono text-xs text-foreground truncate" title={row.assembly}>{row.assembly}</div>
                  <div className="px-3 text-center">
                    <span className={cn('font-mono text-sm font-semibold', row.smh_value > 0 ? 'text-foreground' : 'text-red-400')}>
                      {row.smh_value > 0 ? row.smh_value.toFixed(4) : 'not set'}
                    </span>
                  </div>
                  <div className="px-3 text-center font-mono font-semibold text-foreground">{row.total_qty_produced.toLocaleString()}</div>
                  <div className="px-3 text-center font-mono text-xs text-muted-foreground">{row.active_days}</div>
                  <div className="px-3 font-mono text-xs text-muted-foreground">{row.first_seen_date}</div>
                  <div className="px-3 font-mono text-xs text-muted-foreground">{row.last_seen_date}</div>
                  <div className="px-3 flex justify-center">
                    <span className={cn('text-[10px] font-semibold px-2 py-1 rounded-full border', SMH_STATUS_BADGE[row.smh_status] ?? '')}>
                      {row.smh_status === 'OK' ? 'OK' : row.smh_status === 'MISSING_SMH' ? 'Missing' : 'Not in DB'}
                    </span>
                  </div>
                </div>
              );
            };
            return filteredSmh.length > VIRTUAL_THRESHOLD ? (
              <VirtualTable rows={filteredSmh} renderHeader={renderHeader} renderRow={renderRow} />
            ) : (
              <>
                <div className="rounded-xl border border-border overflow-x-auto bg-card">
                  {renderHeader()}
                  {filteredSmh.length === 0
                    ? <div className="py-12 text-center text-muted-foreground text-sm">No SMH coverage data</div>
                    : slice(filteredSmh).map((r, i) => renderRow(r, (page - 1) * PAGE_SIZE + i))}
                </div>
                <Pagination page={page} total={filteredSmh.length} pageSize={PAGE_SIZE} onChange={setPage} />
              </>
            );
          })()}

        </div>
      </>)}

    </div>
  );
}