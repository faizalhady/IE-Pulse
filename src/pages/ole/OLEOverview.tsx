import type { OlePaidHours, OleProduction, OleResult, OleSummary, SmhStatus } from '@/lib/oleApi';
import { useOlePaidHours, useOleProduction, useOleResults, useOleSummary, useOleWorkcells, useSmhStatus, useSmhLookup } from '@/hooks/useOleData';
import { getOleStatus, OLE_BAR, OLE_COLOR, QUALITY_BADGE, fmtDate, shiftLabel, SMH_STATUS_BADGE, STAGE_BADGE, STATUS_BADGE, STATUS_LABEL } from '@/lib/oleConstants';
import { cn } from '@/lib/utils';
import WorkcellBadge from '@/components/ole/WorkcellBadge';
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
  { id: 'report',     label: 'Overview' },
  { id: 'summary',    label: 'OLE Scorecard' },
  { id: 'analysis',   label: 'Analysis' },
  { id: 'labor',      label: 'Labor Input' },
  { id: 'production', label: 'Production Output' },
] as const;

type TabId = typeof TABS[number]['id'];
type SortDir = 'asc' | 'desc';

// ─── Plant → workcell mapping ─────────────────────────────────────────────────
function matchesPlant(workcellName: string, plant: string, workcellConfigs: { workcell: string; plant: string }[]): boolean {
  if (!plant) return true;
  const cfg = workcellConfigs.find(c => c.workcell === workcellName);
  return cfg ? cfg.plant === plant : false;
}

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

// ─── Shared column layout tokens ──────────────────────────────────────────────
// Labor Input:     #  Workcell  Date  Shift  OLE%  SMH-cov  OutputSMH  InputHrs  Qty  Assemblies
const LABOR_GT = '2.5rem minmax(9rem,1fr) 6rem 4rem 7rem 6rem 6.5rem 6.5rem 5.5rem 7rem';
// Production Out:  #  Workcell  Date  Shift  Stage  Assembly  Qty  SMH/unit  OutputSMH
// — Date & Shift in positions 3 & 4 to match Labor Input
const PROD_GT  = '2.5rem 1fr 6rem 4rem 5rem 12rem 5rem 6rem 7rem';

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function OLEOverview() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab]       = useState<TabId>('report');
  const [search, setSearch]             = useState('');
  const [workcell, setWorkcell]         = useState('');
  const [plant, setPlant]               = useState('');
  const [dateFrom, setDateFrom]         = useState('');
  const [dateTo, setDateTo]             = useState('');
  const [shift, setShift]               = useState('');
  const [smhFilter, setSmhFilter]       = useState('');
  const [sortCol, setSortCol]           = useState('');
  const [sortDir, setSortDir]           = useState<SortDir>('desc');
  const [page, setPage]                 = useState(1);
  const [expandedShifts, setExpandedShifts] = useState<Set<string>>(new Set());

  useEffect(() => { setPage(1); }, [activeTab, workcell, plant, dateFrom, dateTo, shift, smhFilter, search]);

  const toggleSort = useCallback((col: string) => {
    setSortCol(prev => {
      if (prev === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
      else setSortDir('desc');
      return col;
    });
    setPage(1);
  }, []);

  // ── Data ──────────────────────────────────────────────────────────────────
  const workcellsHook  = useOleWorkcells();
  const workcellConfigs = workcellsHook.data ?? [];

  const plantOptions = useMemo(() =>
    Array.from(new Set(workcellConfigs.map(c => c.plant))).sort()
  , [workcellConfigs]);

  const summaryHook    = useOleSummary();
  const shiftsHook     = useOleResults();
  const productionHook = useOleProduction();
  const paidHoursHook  = useOlePaidHours();
  const smhHook        = useSmhStatus();
  const smhLookupHook  = useSmhLookup();   // for SMH/unit join in production table

  const hookMap: Partial<Record<TabId, any>> = {
    summary:    summaryHook,
    labor:      shiftsHook,
    production: productionHook,
  };
  const activeHook = hookMap[activeTab] ?? summaryHook;

  const workcellOptions = useMemo(() =>
    Array.from(new Set((summaryHook.data ?? []).map(r => r.workcell))).sort()
  , [summaryHook.data]);

  // ── SMH lookup map: "workcell|assembly" → smh_value ───────────────────────
  const smhMap = useMemo(() => {
    const m = new Map<string, number>();
    (smhLookupHook.data ?? []).forEach(s => m.set(`${s.workcell}|${s.assembly}`, s.smh_value));
    return m;
  }, [smhLookupHook.data]);

  // ── Global header stats (no date filter — always all-time) ─────────────────
  const summaryRows  = summaryHook.data ?? [];
  const totalOutput  = summaryRows.reduce((s, r) => s + (r.total_output_smh  || 0), 0);
  const totalInput   = summaryRows.reduce((s, r) => s + (r.total_input_hours || 0), 0);
  const avgOle       = totalInput > 0 ? ((totalOutput / totalInput) * 100).toFixed(2) : '—';
  const totalQty     = summaryRows.reduce((s, r) => s + r.total_qty, 0);
  const flaggedTotal = summaryRows.reduce((s, r) => s + r.flagged_shifts, 0);

  // ── Filtered rows ──────────────────────────────────────────────────────────
  const filteredSummary = useMemo(() => {
    const hasDateFilter = !!dateFrom || !!dateTo;

    if (!hasDateFilter) {
      const list = (summaryHook.data ?? []).filter(r =>
        (!workcell || r.workcell === workcell) &&
        (!search   || r.workcell.toLowerCase().includes(search.toLowerCase())) &&
        matchesPlant(r.workcell, plant, workcellConfigs)
      );
      return sortRows(list, sortCol, sortDir) as OleSummary[];
    }

    const shiftSource = (shiftsHook.data ?? []).filter(r =>
      (!workcell || r.workcell === workcell) &&
      (!search   || r.workcell.toLowerCase().includes(search.toLowerCase())) &&
      matchesPlant(r.workcell, plant, workcellConfigs) &&
      (!dateFrom || r.date >= dateFrom) &&
      (!dateTo   || r.date <= dateTo)
    );

    const byWc: Record<string, OleSummary> = {};
    shiftSource.forEach(r => {
      if (!byWc[r.workcell]) {
        byWc[r.workcell] = {
          workcell: r.workcell, stage_label: r.stage_label, scan_stage: r.scan_stage,
          total_shifts: 0, avg_ole_pct: null, min_ole_pct: null, max_ole_pct: null,
          latest_date: r.date, total_qty: 0, total_output_smh: 0,
          total_input_hours: 0, avg_hc_direct: 0, flagged_shifts: 0,
        };
      }
      const w = byWc[r.workcell];
      w.total_shifts      += 1;
      w.total_qty         += r.total_qty;
      w.total_output_smh  += r.effective_output_smh;
      w.total_input_hours += r.total_input_hours;
      w.avg_hc_direct     += r.hc_direct;
      if (r.data_quality !== 'OK') w.flagged_shifts += 1;
      if (r.date > w.latest_date) w.latest_date = r.date;
      if (r.ole_pct !== null) {
        w.min_ole_pct = w.min_ole_pct === null ? r.ole_pct : Math.min(w.min_ole_pct, r.ole_pct);
        w.max_ole_pct = w.max_ole_pct === null ? r.ole_pct : Math.max(w.max_ole_pct, r.ole_pct);
      }
    });

    const list = Object.values(byWc).map(w => ({
      ...w,
      avg_hc_direct: w.total_shifts > 0 ? Math.round((w.avg_hc_direct / w.total_shifts) * 10) / 10 : 0,
      avg_ole_pct:   w.total_input_hours > 0
        ? Math.round((w.total_output_smh / w.total_input_hours) * 10000) / 100 : null,
    }));
    return sortRows(list, sortCol, sortDir) as OleSummary[];
  }, [summaryHook.data, shiftsHook.data, workcell, search, plant, dateFrom, dateTo, sortCol, sortDir, workcellConfigs]);

  const filteredShifts = useMemo(() => {
    const list = (shiftsHook.data ?? []).filter(r =>
      (!workcell || r.workcell === workcell) &&
      (!search || r.workcell.toLowerCase().includes(search.toLowerCase()) || r.date.includes(search)) &&
      matchesPlant(r.workcell, plant, workcellConfigs) &&
      (!dateFrom || r.date >= dateFrom) &&
      (!dateTo   || r.date <= dateTo) &&
      (!shift    || r.shift === Number(shift))
    );
    return sortRows(list, sortCol, sortDir) as OleResult[];
  }, [shiftsHook.data, workcell, search, plant, dateFrom, dateTo, shift, sortCol, sortDir, workcellConfigs]);

  const filteredProd = useMemo(() => {
    const list = (productionHook.data ?? []).filter(r =>
      (!workcell || r.workcell === workcell) &&
      (!search || r.workcell.toLowerCase().includes(search.toLowerCase()) || r.assembly.toLowerCase().includes(search.toLowerCase())) &&
      matchesPlant(r.workcell, plant, workcellConfigs) &&
      (!dateFrom || r.date >= dateFrom) &&
      (!dateTo   || r.date <= dateTo)
    );
    return sortRows(list, sortCol, sortDir) as OleProduction[];
  }, [productionHook.data, workcell, search, plant, dateFrom, dateTo, sortCol, sortDir, workcellConfigs]);

  const filteredHours = useMemo(() => {
    const list = (paidHoursHook.data ?? []).filter(r =>
      (!workcell || r.workcell === workcell) &&
      (!search || r.workcell.toLowerCase().includes(search.toLowerCase())) &&
      matchesPlant(r.workcell, plant, workcellConfigs) &&
      (!dateFrom || r.date >= dateFrom) &&
      (!dateTo   || r.date <= dateTo)
    );
    return sortRows(list, sortCol, sortDir) as OlePaidHours[];
  }, [paidHoursHook.data, workcell, search, plant, dateFrom, dateTo, sortCol, sortDir, workcellConfigs]);

  const filteredSmh = useMemo(() => {
    const list = (smhHook.data ?? []).filter(r =>
      (!workcell  || r.workcell === workcell) &&
      (!smhFilter || r.smh_status === smhFilter) &&
      (!search || r.assembly.toLowerCase().includes(search.toLowerCase()) || r.workcell.toLowerCase().includes(search.toLowerCase())) &&
      matchesPlant(r.workcell, plant, workcellConfigs)
    );
    return sortRows(list, sortCol, sortDir) as SmhStatus[];
  }, [smhHook.data, workcell, smhFilter, search, plant, sortCol, sortDir, workcellConfigs]);

  // ── Tab badges: production shows total qty, not row count ─────────────────
  const prodTotalQty = useMemo(() =>
    filteredProd.reduce((s, r) => s + r.qty, 0)
  , [filteredProd]);

  const rowCounts: Record<TabId, number> = {
    report:     0,
    summary:    filteredSummary.length,
    analysis:   0,
    labor:      filteredShifts.length,
    production: prodTotalQty,   // show total qty units, not row count
  };

  const slice = <T,>(arr: T[]) => arr.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const showDateFilters = ['summary', 'analysis', 'labor', 'production'].includes(activeTab);
  const showShiftFilter = activeTab === 'labor';
  const showSmhFilter   = false;
  const showFilters     = !['report', 'analysis'].includes(activeTab);

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
      {activeTab === 'report' && <OLEReport onNavigateTab={onNavigateTab} />}

      {/* ── ANALYSIS tab ── */}
      {activeTab === 'analysis' && (
        <OLEAnalysis
          search={search} setSearch={setSearch}
          workcell={workcell} setWorkcell={setWorkcell}
          plant={plant} setPlant={setPlant}
          plantOptions={plantOptions}
          workcellConfigs={workcellConfigs}
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
          workcellConfigs={workcellConfigs}
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

        <div className="px-6 pb-8 pt-4">

          {activeHook.loading && rowCounts[activeTab] === 0 && (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => <div key={i} className="h-12 rounded-xl bg-muted/40 animate-pulse" />)}
            </div>
          )}

          {/* ── OLE SCORECARD tab ── */}
          {activeTab === 'summary' && (() => {
            const allRows = filteredSummary;
            // Cols: # | Workcell | Final Scan (text) | OLE% | Output SMH | Input Hrs | Transferred MH | QTY | Status
            const GT = '2.5rem minmax(10rem,1fr) 7rem 9.5rem 9rem 9rem 9rem 6.5rem 7.5rem';
            return (
              <div className="rounded-xl border border-border overflow-hidden bg-card">
                <div className="grid bg-muted/50 border-b border-border text-xs text-muted-foreground font-medium uppercase tracking-wider"
                  style={{ gridTemplateColumns: GT }}>
                  <div className="px-4 py-3 text-center">#</div>
                  {([
                    ['workcell',           'Workcell'],
                    ['stage_label',        'Final Scan'],
                    ['avg_ole_pct',        'OLE %'],
                    ['total_output_smh',   'Output SMH'],
                    ['total_input_hours',  'Input Hrs'],
                    ['transferred_man_hours', 'Transferred MH'],
                    ['total_qty',          'QTY'],
                    ['',                   'Status'],
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
                  const status  = getOleStatus(calcOle);
                  return (
                    <div key={row.workcell}
                      className="grid items-center text-sm border-b border-border last:border-0 hover:bg-muted/40 transition-colors"
                      style={{ gridTemplateColumns: GT }}
                    >
                      <div className="px-4 py-3.5 text-center text-xs text-muted-foreground font-mono">{idx + 1}</div>

                      {/* Workcell */}
                      <button onClick={() => navigate(`/ole/${encodeURIComponent(row.workcell)}`)}
                        className="px-4 py-3.5 flex items-center gap-3 text-left group w-full cursor-pointer">
                        <WorkcellBadge name={row.workcell} status={status} />
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">{row.workcell}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5 whitespace-nowrap">Latest: {fmtDate(row.latest_date)}</p>
                        </div>
                      </button>

                      {/* Final Scan — plain text, no badge */}
                      <div className="px-3 py-3.5 flex items-center">
                        <span className="text-xs font-medium text-muted-foreground">{row.stage_label}</span>
                      </div>

                      {/* OLE % */}
                      <div className="px-3 py-3.5 text-center">
                        <span className={cn('text-lg font-mono font-bold', OLE_COLOR[status])}>
                          {row.total_input_hours > 0 ? `${calcOle.toFixed(2)}%` : '—'}
                        </span>
                        <div className="mt-1 h-1 rounded-full bg-muted/50 overflow-hidden">
                          <div className={cn('h-full rounded-full', OLE_BAR[status])} style={{ width: `${Math.min(calcOle, 100)}%` }} />
                        </div>
                      </div>

                      {/* Output SMH */}
                      <button onClick={() => { setActiveTab('labor'); setWorkcell(row.workcell); }}
                        className="px-3 py-3.5 text-center cursor-pointer hover:text-primary transition-colors">
                        <span className="font-mono text-sm font-semibold text-foreground">{Math.round(row.total_output_smh).toLocaleString()}</span>
                        <p className="text-[10px] text-muted-foreground">hrs</p>
                      </button>

                      {/* Input Hrs */}
                      <button onClick={() => { setActiveTab('labor'); setWorkcell(row.workcell); }}
                        className="px-3 py-3.5 text-center cursor-pointer hover:text-primary transition-colors">
                        <span className="font-mono text-sm font-semibold text-foreground">{Math.round(row.total_input_hours).toLocaleString()}</span>
                        <p className="text-[10px] text-muted-foreground">hrs</p>
                      </button>

                      {/* Transferred MH */}
                      <div className="px-3 py-3.5 text-center">
                        <span className="font-mono text-sm font-semibold text-muted-foreground">—</span>
                        <p className="text-[10px] text-muted-foreground">hrs</p>
                      </div>

                      {/* QTY */}
                      <div className="px-3 py-3.5 text-center">
                        <span className="font-mono text-sm font-semibold text-foreground">
                          {row.total_qty != null ? row.total_qty.toLocaleString() : '—'}
                        </span>
                        <p className="text-[10px] text-muted-foreground">units</p>
                      </div>

                      {/* Status */}
                      <div className="px-3 py-3.5 flex items-center justify-center">
                        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap', STATUS_BADGE[status])}>
                          {STATUS_LABEL[status]}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* ── LABOR INPUT tab ── */}
          {/* Cols: expand | Workcell | Date | Shift | OLE% | SMH Cov | Output SMH | Input Hrs | Qty | Assemblies */}
          {activeTab === 'labor' && (() => {
            const phByKey = new Map<string, OlePaidHours[]>();
            filteredHours.forEach(ph => {
              const k = `${ph.workcell}|${ph.date}|${ph.shift}`;
              if (!phByKey.has(k)) phByKey.set(k, []);
              phByKey.get(k)!.push(ph);
            });

            const toggleShift = (key: string) => {
              setExpandedShifts(prev => {
                const next = new Set(prev);
                next.has(key) ? next.delete(key) : next.add(key);
                return next;
              });
            };

            const renderHeader = () => (
              <div className="grid bg-muted/50 border-b border-border text-xs text-muted-foreground font-medium uppercase tracking-wider"
                style={{ gridTemplateColumns: LABOR_GT }}>
                <div className="px-4 py-3" />
                {([
                  ['workcell',             'Workcell'],
                  ['date',                 'Date'],
                  ['shift',                'Shift'],
                  ['ole_pct',              'OLE %'],
                  ['smh_coverage_pct',     'SMH Cov.'],
                  ['effective_output_smh', 'Output SMH'],
                  ['total_input_hours',    'Input Hrs'],
                  ['total_qty',            'Qty'],
                  ['assembly_count',       'Assemblies'],
                ] as [string, string][]).map(([col, label]) => (
                  <button key={col} onClick={() => toggleSort(col)}
                    className="px-3 py-3 text-left flex items-center hover:text-foreground transition-colors">
                    {label} <SortIcon active={sortCol === col} dir={sortDir} />
                  </button>
                ))}
              </div>
            );

            const shiftRows = slice(filteredShifts);

            return (
              <>
                <div className="rounded-xl border border-border overflow-x-auto bg-card">
                  {renderHeader()}
                  {filteredShifts.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground text-sm">No labor data</div>
                  ) : shiftRows.map((row, i) => {
                    const key      = `${row.workcell}|${row.date}|${row.shift}`;
                    const expanded = expandedShifts.has(key);
                    const employees = phByKey.get(key) ?? [];
                    const status   = getOleStatus(row.ole_pct);
                    const idx      = (page - 1) * PAGE_SIZE + i;
                    return (
                      <div key={key} className="border-b border-border last:border-0">
                        <div
                          className="grid items-center text-sm hover:bg-muted/40 transition-colors cursor-pointer"
                          style={{ gridTemplateColumns: LABOR_GT, minHeight: ROW_HEIGHT }}
                          onClick={() => employees.length > 0 && toggleShift(key)}
                        >
                          {/* expand / row# */}
                          <div className="px-4 flex items-center justify-center text-muted-foreground">
                            {employees.length > 0
                              ? expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                              : <span className="text-[10px] font-mono">{idx + 1}</span>}
                          </div>
                          {/* Workcell */}
                          <div className="px-3 flex items-center gap-2.5">
                            <WorkcellBadge name={row.workcell} status={status} />
                            <span className="font-semibold text-foreground truncate">{row.workcell}</span>
                            {employees.length > 0 && (
                              <span className="text-[10px] font-mono text-muted-foreground ml-1">{employees.length} emp</span>
                            )}
                          </div>
                          {/* Date */}
                          <div className="px-3 font-mono text-xs text-foreground">{fmtDate(row.date)}</div>
                          {/* Shift */}
                          <div className="px-3 text-center font-mono font-semibold text-foreground">{shiftLabel(row.shift)}</div>
                          {/* OLE % */}
                          <div className="px-3 text-center">
                            <span className={cn('font-mono font-bold', OLE_COLOR[status])}>
                              {row.ole_pct !== null ? `${row.ole_pct}%` : '—'}
                            </span>
                          </div>
                          {/* SMH Coverage */}
                          <div className="px-3 text-center">
                            <span className={cn('text-xs font-mono font-semibold',
                              (row.smh_coverage_pct ?? 0) >= 90 ? 'text-emerald-400' :
                              (row.smh_coverage_pct ?? 0) >= 70 ? 'text-amber-400' : 'text-red-400'
                            )}>{row.smh_coverage_pct !== null ? `${row.smh_coverage_pct}%` : '—'}</span>
                          </div>
                          {/* Output SMH */}
                          <div className="px-3 text-center font-mono text-sm text-foreground">
                            {row.effective_output_smh.toFixed(2)}
                          </div>
                          {/* Input Hrs */}
                          <div className="px-3 text-center font-mono text-sm text-foreground">
                            {row.total_input_hours.toFixed(2)}
                          </div>
                          {/* Qty */}
                          <div className="px-3 text-center font-mono text-sm text-foreground">
                            {row.total_qty.toLocaleString()}
                          </div>
                          {/* Assemblies */}
                          <div className="px-3 text-center font-mono text-sm text-foreground">
                            {row.assembly_count}
                          </div>
                        </div>

                        {/* ── Employee sub-rows ── */}
                        {expanded && employees.length > 0 && (
                          <div className="bg-muted/20 border-t border-border/50">
                            <div className="grid text-[10px] text-muted-foreground uppercase tracking-wider font-semibold border-b border-border/30"
                              style={{ gridTemplateColumns: '3rem 1fr 6rem 6rem 7rem 8rem' }}>
                              <div className="px-4 py-1.5" />
                              <div className="px-3 py-1.5">Employee</div>
                              <div className="px-3 py-1.5 text-center">Type</div>
                              <div className="px-3 py-1.5 text-center">Direct HC</div>
                              <div className="px-3 py-1.5 text-center">Direct Hrs</div>
                              <div className="px-3 py-1.5 text-center">Total Input</div>
                            </div>
                            {employees.map((emp, ei) => (
                              <div key={`${emp.name}-${ei}`}
                                className="grid items-center text-xs border-b border-border/20 last:border-0 hover:bg-muted/30 transition-colors"
                                style={{ gridTemplateColumns: '3rem 1fr 6rem 6rem 7rem 8rem', height: 40 }}
                              >
                                <div className="px-4 text-center text-muted-foreground font-mono">{ei + 1}</div>
                                <div className="px-3 text-foreground truncate" title={emp.name}>{emp.name || '—'}</div>
                                <div className="px-3 flex justify-center">
                                  <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border',
                                    emp.value_type === 'VA'  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
                                    emp.value_type === 'NVA' ? 'bg-red-500/15 text-red-400 border-red-500/30' :
                                    'bg-muted text-muted-foreground border-border'
                                  )}>{emp.value_type || 'NVA'}</span>
                                </div>
                                <div className="px-3 text-center font-mono text-foreground">{emp.thc_direct}</div>
                                <div className="px-3 text-center font-mono text-foreground">{emp.tph_direct.toFixed(2)}</div>
                                <div className="px-3 text-center font-mono font-semibold text-foreground">{emp.total_input_hours.toFixed(2)}</div>
                              </div>
                            ))}
                            <div className="grid items-center text-xs bg-muted/40 border-t border-border/40"
                              style={{ gridTemplateColumns: '3rem 1fr 6rem 6rem 7rem 8rem', height: 36 }}
                            >
                              <div />
                              <div className="px-3 text-muted-foreground font-semibold">{employees.length} employees</div>
                              <div />
                              <div className="px-3 text-center font-mono font-bold text-foreground">
                                {employees.reduce((s, e) => s + e.thc_direct, 0)}
                              </div>
                              <div className="px-3 text-center font-mono font-bold text-foreground">
                                {employees.reduce((s, e) => s + e.tph_direct, 0).toFixed(2)}
                              </div>
                              <div className="px-3 text-center font-mono font-bold text-primary">
                                {row.total_input_hours.toFixed(2)}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <Pagination page={page} total={filteredShifts.length} pageSize={PAGE_SIZE} onChange={setPage} />
              </>
            );
          })()}

          {/* ── PRODUCTION OUTPUT tab ── */}
          {/* Cols: # | Workcell | Date | Shift | Stage | Assembly | Qty | SMH/unit | Output SMH */}
          {activeTab === 'production' && (() => {
            const renderHeader = () => (
              <div className="grid bg-muted/50 border-b border-border text-xs text-muted-foreground font-medium uppercase tracking-wider"
                style={{ gridTemplateColumns: PROD_GT }}>
                <div className="px-4 py-3 text-center">#</div>
                {([
                  ['workcell',    'Workcell'],
                  ['date',        'Date'],
                  ['shift',       'Shift'],
                  ['sub_workcell','Stage'],
                  ['assembly',    'Assembly'],
                  ['qty',         'Qty'],
                  ['smh_unit',    'SMH/unit'],
                  ['output_smh',  'Output SMH'],
                ] as [string, string][]).map(([col, label]) => (
                  <button key={col} onClick={() => toggleSort(col)}
                    className="px-3 py-3 text-left flex items-center hover:text-foreground transition-colors">
                    {label} <SortIcon active={sortCol === col} dir={sortDir} />
                  </button>
                ))}
              </div>
            );

            const renderRow = (rowRaw: unknown, idx: number) => {
              const row = rowRaw as OleProduction;
              const smhUnit   = smhMap.get(`${row.workcell}|${row.assembly}`) ?? null;
              const outputSmh = smhUnit !== null ? row.qty * smhUnit : null;
              return (
                <div key={`${row.workcell}-${row.assembly}-${row.date}-${row.shift}-${idx}`}
                  className="grid items-center text-sm border-b border-border last:border-0 hover:bg-muted/40 transition-colors"
                  style={{ gridTemplateColumns: PROD_GT, height: ROW_HEIGHT }}
                >
                  {/* # */}
                  <div className="px-4 text-center text-xs text-muted-foreground font-mono">{idx + 1}</div>
                  {/* Workcell */}
                  <div className="px-3 flex items-center gap-2.5">
                    <WorkcellBadge name={row.workcell} status="idle" />
                    <span className="font-semibold text-foreground truncate">{row.workcell}</span>
                  </div>
                  {/* Date — position 3, same as Labor Input */}
                  <div className="px-3 font-mono text-xs text-foreground">{fmtDate(row.date)}</div>
                  {/* Shift — position 4, same as Labor Input */}
                  <div className="px-3 text-center font-mono font-semibold text-foreground">{shiftLabel(row.shift)}</div>
                  {/* Stage — plain text */}
                  <div className="px-3">
                    <span className="text-xs font-medium text-muted-foreground">{row.sub_workcell}</span>
                  </div>
                  {/* Assembly — dynamic width, truncated */}
                  <div className="px-3 font-mono text-xs text-foreground truncate" title={row.assembly}>{row.assembly}</div>
                  {/* Qty */}
                  <div className="px-3 text-center font-mono font-semibold text-foreground">{row.qty.toLocaleString()}</div>
                  {/* SMH/unit */}
                  <div className="px-3 text-center font-mono text-xs text-foreground">
                    {smhUnit !== null ? smhUnit.toFixed(4) : <span className="text-muted-foreground/50">—</span>}
                  </div>
                  {/* Output SMH */}
                  <div className="px-3 text-center font-mono text-sm font-semibold text-foreground">
                    {outputSmh !== null ? outputSmh.toFixed(2) : <span className="text-muted-foreground/50">—</span>}
                  </div>
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

        </div>
      </>)}

    </div>
  );
}
