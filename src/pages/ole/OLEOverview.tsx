import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useOlePaidHours, useOleProduction, useOleResults, useOleSummary, useSmhStatus } from '@/hooks/useOleData';
import type { OlePaidHours, OleProduction, OleResult, OleSummary, SmhStatus } from '@/lib/oleApi';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  AlertTriangle,
  ArrowUpDown,
  CalendarIcon,
  ChevronDown, ChevronUp,
  RefreshCw, Search, WifiOff,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import OLEReport from './OLEReport';
import OLEWorkcellTab from './OLEWorkcellTab';
import OLEProjection from './OLEProjection';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;
const VIRTUAL_THRESHOLD = 300;
const ROW_HEIGHT = 56;
const ALL = '__all__';

const TABS = [
  { id: 'report',     label: 'OLE Report' },
  { id: 'summary',    label: 'OLE Summary' },
  { id: 'workcell',   label: 'OLE Workcell' },
  { id: 'projection', label: 'OLE Projection' },
  { id: 'shifts',     label: 'Shift Detail' },
  { id: 'production', label: 'Production' },
  { id: 'paid_hours', label: 'Paid Hours' },
  // { id: 'smh', label: 'SMH Coverage' },
] as const;

type TabId = typeof TABS[number]['id'];
type SortDir = 'asc' | 'desc';

// ─── Plant → workcell mapping (client-side filter) ───────────────────────────
const PLANT_WORKCELLS: Record<string, string[]> = {
  'Plant 1': ['ARISTA', 'AOP', 'KEYSIGHT', 'MSI PCA'],
  'Batu Kawan': ['MICRON', 'WABTEC', 'MSI', 'PHOTONICS', 'LAMKEY'],
  'Plant 2': ['CELESTICA', 'DYSON', 'FLEX', 'MED', 'REINERA', 'MAN COUL', 'TELLABS'],
};

function matchesPlant(workcellName: string, plant: string): boolean {
  if (!plant) return true;
  const list = PLANT_WORKCELLS[plant] ?? [];
  const upper = workcellName.toUpperCase();
  return list.some(p => upper.includes(p));
}


// ─── Workcell logos (same map as WorkcellsTable) ────────────────────────────
const WORKCELL_LOGOS: Record<string, string> = {
  arista: '/workcell logo/Arista.png',
  keysight: '/workcell logo/keyisght.png',
  aop: '/workcell logo/aop.png',
  micron: '/workcell logo/micron.png',
};

function WorkcellBadge({ name, status }: { name: string; status: string }) {
  const [imgErr, setImgErr] = useState(false);
  const key = name.toLowerCase().replace(/[^a-z]/g, '');  // strip numbers/spaces: 'aop1' → 'aop'
  const logoKey = Object.keys(WORKCELL_LOGOS).find(k => key.startsWith(k)) ?? key;
  const logoSrc = WORKCELL_LOGOS[logoKey];
  const ring: Record<string, string> = {
    optimal: 'ring-emerald-500/30',
    warning: 'ring-amber-500/30',
    critical: 'ring-red-500/30',
    idle: 'ring-border',
  };
  const bg: Record<string, string> = {
    optimal: 'bg-emerald-500/15 text-emerald-400',
    warning: 'bg-amber-500/15  text-amber-400',
    critical: 'bg-red-500/15    text-red-400',
    idle: 'bg-muted         text-muted-foreground',
  };
  if (logoSrc && !imgErr) return (
    <div className={`w-14 h-8 rounded-lg overflow-hidden ring-1 flex-shrink-0 flex items-center justify-center ${ring[status] ?? 'ring-border'}`}
      style={{ background: '#ffffff' }}>
      <img src={logoSrc} alt={name} onError={() => setImgErr(true)} className="w-full h-full object-contain p-1" />
    </div>
  );
  return (
    <div className={`w-14 h-8 rounded-lg flex items-center justify-center text-[10px] font-black ring-1 flex-shrink-0 ${bg[status] ?? 'bg-muted text-muted-foreground'} ${ring[status] ?? 'ring-border'}`}>
      {name.slice(0, 3).toUpperCase()}
    </div>
  );
}

// ─── Mock rows for summary table ─────────────────────────────────────────────
const MOCK_SUMMARY: OleSummary[] = [
  { workcell: 'ARISTA', stage_label: 'Backend', scan_stage: 'Backend', total_shifts: 10, avg_ole_pct: 83.2, min_ole_pct: 72.1, max_ole_pct: 91.4, latest_date: '2026-04-16', total_qty: 31200, total_output_smh: 4120.5, total_input_hours: 4952.0, flagged_shifts: 2 },
  { workcell: 'MICRON', stage_label: 'SMT', scan_stage: 'SMT', total_shifts: 8, avg_ole_pct: 61.7, min_ole_pct: 48.2, max_ole_pct: 74.3, latest_date: '2026-04-16', total_qty: 18900, total_output_smh: 2344.1, total_input_hours: 3798.0, flagged_shifts: 8 },
  { workcell: 'WABTEC', stage_label: 'BoxBuild', scan_stage: 'BoxBuild', total_shifts: 10, avg_ole_pct: 55.4, min_ole_pct: 31.0, max_ole_pct: 72.8, latest_date: '2026-04-15', total_qty: 8420, total_output_smh: 1890.3, total_input_hours: 3412.0, flagged_shifts: 10 },
  { workcell: 'CELESTICA', stage_label: 'Backend', scan_stage: 'Backend', total_shifts: 6, avg_ole_pct: 91.3, min_ole_pct: 87.2, max_ole_pct: 95.1, latest_date: '2026-04-14', total_qty: 22100, total_output_smh: 3210.0, total_input_hours: 3515.0, flagged_shifts: 0 },
  { workcell: 'DYSON', stage_label: 'Backend', scan_stage: 'Backend', total_shifts: 4, avg_ole_pct: 44.8, min_ole_pct: 28.3, max_ole_pct: 61.2, latest_date: '2026-04-13', total_qty: 5600, total_output_smh: 980.2, total_input_hours: 2188.0, flagged_shifts: 4 },
  { workcell: 'FLEX', stage_label: 'SMT', scan_stage: 'SMT', total_shifts: 10, avg_ole_pct: 78.9, min_ole_pct: 65.4, max_ole_pct: 88.7, latest_date: '2026-04-16', total_qty: 41000, total_output_smh: 5620.4, total_input_hours: 7122.0, flagged_shifts: 3 },
];

// ─── Colour helpers ───────────────────────────────────────────────────────────

function getOleStatus(pct: number | null): 'optimal' | 'warning' | 'critical' | 'idle' {
  if (pct === null) return 'idle';
  if (pct >= 80) return 'optimal';
  if (pct >= 60) return 'warning';
  return 'critical';
}

const STATUS_BADGE: Record<string, string> = {
  optimal: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  warning: 'bg-amber-500/15  text-amber-400  border-amber-500/30',
  critical: 'bg-red-500/15    text-red-400    border-red-500/30',
  idle: 'bg-muted         text-muted-foreground border-border',
};
const STATUS_LABEL: Record<string, string> = {
  optimal: 'On Track', warning: 'At Risk', critical: 'Below Target', idle: 'No Data',
};
const OLE_COLOR: Record<string, string> = {
  optimal: 'text-emerald-500', warning: 'text-amber-400',
  critical: 'text-red-400', idle: 'text-muted-foreground',
};
const OLE_BAR: Record<string, string> = {
  optimal: 'bg-emerald-500', warning: 'bg-amber-400',
  critical: 'bg-red-500', idle: 'bg-muted',
};
const STAGE_BADGE: Record<string, string> = {
  SMT: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  Backend: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  BoxBuild: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
};
const SMH_STATUS_BADGE: Record<string, string> = {
  OK: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  MISSING_SMH: 'bg-amber-500/15  text-amber-400  border-amber-500/30',
  NOT_IN_SMH_DB: 'bg-red-500/15    text-red-400    border-red-500/30',
};
const QUALITY_BADGE: Record<string, string> = {
  OK: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  PARTIAL_SMH: 'bg-amber-500/15  text-amber-400  border-amber-500/30',
  NO_INPUT_HOURS: 'bg-red-500/15    text-red-400    border-red-500/30',
  NO_OUTPUT_SMH: 'bg-red-500/15    text-red-400    border-red-500/30',
};

// ─── Date picker (same as OleMartApiTest) ─────────────────────────────────────

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function fromYmd(s: string): Date | undefined {
  if (!s?.trim()) return undefined;
  const parts = s.trim().split('-').map(Number);
  if (parts.length !== 3) return undefined;
  const [y, mo, d] = parts;
  if (!y || !mo || !d) return undefined;
  return new Date(y, mo - 1, d);
}

function DatePickerField({ id, label, value, onChange }: {
  id: string; label: string; value: string; onChange: (ymd: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const date = fromYmd(value);
  return (
    <div className="min-w-[180px] max-w-[220px]">
      <Label htmlFor={id} className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button id={id} type="button" variant="outline"
            className={cn('mt-1 w-full h-9 justify-start text-left font-normal px-2', !value && 'text-muted-foreground')}
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-70" />
            <span className="truncate">{date ? format(date, 'MMM d, yyyy') : 'Any date'}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={date}
            onSelect={d => { onChange(d ? toYmd(d) : ''); setOpen(false); }}
            initialFocus
          />
          {value && (
            <div className="border-t border-border p-2">
              <Button type="button" variant="ghost" size="sm" className="w-full h-8 text-xs"
                onClick={() => { onChange(''); setOpen(false); }}
              >Clear date</Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
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
    <div className="rounded-xl border border-border overflow-hidden">
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
  const validSummary = summaryRows.filter(r => r.avg_ole_pct !== null);
  const avgOle = validSummary.length
    ? (validSummary.reduce((s, r) => s + (r.avg_ole_pct ?? 0), 0) / validSummary.length).toFixed(1)
    : '—';
  const totalQty = summaryRows.reduce((s, r) => s + r.total_qty, 0);
  const flaggedTotal = summaryRows.reduce((s, r) => s + r.flagged_shifts, 0);

  // ── Filtered + sorted rows per tab ───────────────────────────────────────
  const filteredSummary = useMemo(() => {
    let list = summaryRows.filter(r =>
      (!search || r.workcell.toLowerCase().includes(search.toLowerCase())) &&
      matchesPlant(r.workcell, plant)
    );
    return sortRows(list, sortCol, sortDir) as OleSummary[];
  }, [summaryRows, search, plant, sortCol, sortDir]);

  const filteredShifts = useMemo(() => {
    let list = (shiftsHook.data ?? []).filter(r =>
      (!search || r.workcell.toLowerCase().includes(search.toLowerCase()) || r.date.includes(search)) &&
      matchesPlant(r.workcell, plant)
    );
    return sortRows(list, sortCol, sortDir) as OleResult[];
  }, [shiftsHook.data, search, plant, sortCol, sortDir]);

  const filteredProd = useMemo(() => {
    let list = (productionHook.data ?? []).filter(r =>
      (!search || r.workcell.toLowerCase().includes(search.toLowerCase()) || r.assembly.toLowerCase().includes(search.toLowerCase())) &&
      matchesPlant(r.workcell, plant)
    );
    return sortRows(list, sortCol, sortDir) as OleProduction[];
  }, [productionHook.data, search, plant, sortCol, sortDir]);

  const filteredHours = useMemo(() => {
    let list = (paidHoursHook.data ?? []).filter(r =>
      (!search || r.workcell.toLowerCase().includes(search.toLowerCase())) &&
      matchesPlant(r.workcell, plant)
    );
    return sortRows(list, sortCol, sortDir) as OlePaidHours[];
  }, [paidHoursHook.data, search, plant, sortCol, sortDir]);

  const filteredSmh = useMemo(() => {
    let list = (smhHook.data ?? []).filter(r =>
      (!search || r.assembly.toLowerCase().includes(search.toLowerCase()) || r.workcell.toLowerCase().includes(search.toLowerCase())) &&
      matchesPlant(r.workcell, plant)
    );
    return sortRows(list, sortCol, sortDir) as SmhStatus[];
  }, [smhHook.data, search, plant, sortCol, sortDir]);

  const rowCounts: Record<TabId, number> = {
    report:     0,
    summary:    filteredSummary.length,
    workcell:   0,
    projection: 0,
    shifts:     filteredShifts.length,
    production: filteredProd.length,
    paid_hours: filteredHours.length,
    smh:        filteredSmh.length,
  };

  // ── Paginated slices ──────────────────────────────────────────────────────
  const slice = <T,>(arr: T[]) => arr.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const showDateFilters = ['summary', 'workcell', 'shifts', 'production', 'paid_hours'].includes(activeTab);
  const showShiftFilter = activeTab === 'shifts';
  const showSmhFilter = activeTab === 'smh';
  const showFilters = !['report', 'projection'].includes(activeTab);

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

      {/* ── PROJECTION tab ── */}
      {activeTab === 'projection' && (
        <OLEProjection />
      )}



      {/* ── Filters + content for data tabs ── */}
      {showFilters && (<>
        <div className="px-6 pt-4 pb-3 flex flex-wrap items-end gap-3">
          <div className="relative min-w-[200px] max-w-xs flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={activeTab === 'smh' ? 'Search assembly…' : activeTab === 'production' ? 'Search workcell or assembly…' : 'Search…'}
              className="pl-8 h-9"
            />
          </div>

          <div className="min-w-[180px]">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Workcell</Label>
            <Select value={workcell || ALL} onValueChange={v => setWorkcell(v === ALL ? '' : v)}>
              <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="All workcells" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All workcells</SelectItem>
                {workcellOptions.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-[160px]">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Plant</Label>
            <Select value={plant || ALL} onValueChange={v => setPlant(v === ALL ? '' : v)}>
              <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="All plants" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All</SelectItem>
                <SelectItem value="Plant 1">Plant 1</SelectItem>
                <SelectItem value="Batu Kawan">Batu Kawan</SelectItem>
                <SelectItem value="Plant 2">Plant 2</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {showDateFilters && (
            <>
              <DatePickerField id="ole-date-from" label="Date from" value={dateFrom} onChange={setDateFrom} />
              <DatePickerField id="ole-date-to" label="Date to" value={dateTo} onChange={setDateTo} />
            </>
          )}

          {showShiftFilter && (
            <div className="min-w-[140px]">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Shift</Label>
              <Select value={shift || ALL} onValueChange={v => setShift(v === ALL ? '' : v)}>
                <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="Any shift" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Any shift</SelectItem>
                  <SelectItem value="2">Shift 2</SelectItem>
                  <SelectItem value="3">Shift 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {showSmhFilter && (
            <div className="min-w-[180px]">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">SMH Status</Label>
              <Select value={smhFilter || ALL} onValueChange={v => setSmhFilter(v === ALL ? '' : v)}>
                <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="Any status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Any status</SelectItem>
                  <SelectItem value="MISSING_SMH">Missing SMH</SelectItem>
                  <SelectItem value="NOT_IN_SMH_DB">Not in DB</SelectItem>
                  <SelectItem value="OK">OK</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <span className="text-xs text-muted-foreground ml-auto">{rowCounts[activeTab].toLocaleString()} rows</span>
        </div>

        {/* ── Content ─────────────────────────────────────────────────────────── */}
        <div className="px-6 pb-8 pt-4">

          {activeHook.loading && rowCounts[activeTab] === 0 && (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => <div key={i} className="h-12 rounded-xl bg-muted/40 animate-pulse" />)}
            </div>
          )}

          {/* ── WORKCELL tab ── */}
          {activeTab === 'workcell' && (
            <OLEWorkcellTab workcell={workcell} dateFrom={dateFrom} dateTo={dateTo} />
          )}

          {/* ── SUMMARY tab ── */}
          {activeTab === 'summary' && (() => {
            // real rows first, mock rows below — mock rows are not navigatable
            const liveWorkcells = new Set(filteredSummary.map(r => r.workcell));
            const mockRows = MOCK_SUMMARY.filter(r => !liveWorkcells.has(r.workcell));
            const allRows = [...filteredSummary, ...mockRows];
            const GT = '2.5rem minmax(10rem, 1fr) 7.5rem 9.5rem 9rem 9rem 9rem 6.5rem 7.5rem';
            return (
              <div className="rounded-xl border border-border overflow-hidden">
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
                  const status = getOleStatus(row.avg_ole_pct);
                  const isLive = liveWorkcells.has(row.workcell);
                  return (
                    <div key={row.workcell}
                      className={cn('grid items-center text-sm border-b border-border last:border-0 transition-colors', isLive ? 'hover:bg-muted/40' : 'opacity-60 hover:opacity-80 hover:bg-muted/20')}
                      style={{ gridTemplateColumns: GT }}
                    >
                      {/* # */}
                      <div className="px-4 py-3.5 text-center text-xs text-muted-foreground font-mono">{idx + 1}</div>

                      {/* Workcell — clickable → workcell drill-down (live only) */}
                      <button
                        onClick={() => isLive && navigate(`/ole/${encodeURIComponent(row.workcell)}`)}
                        disabled={!isLive}
                        className={cn('px-4 py-3.5 flex items-center gap-3 text-left group w-full', isLive && 'cursor-pointer')}
                      >
                        <WorkcellBadge name={row.workcell} status={status} />
                        <div className="min-w-0">
                          <p className={cn('font-semibold text-foreground truncate', isLive && 'group-hover:text-primary transition-colors')}>{row.workcell}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5 whitespace-nowrap">
                            {isLive ? `Latest: ${row.latest_date ?? '—'}` : 'Mock data'}
                          </p>
                        </div>
                      </button>

                      {/* Final Scan — clickable → SMH Coverage tab filtered to this workcell */}
                      <button
                        onClick={() => { setActiveTab('smh'); setWorkcell(row.workcell); }}
                        className="px-3 py-3.5 flex items-center justify-center cursor-pointer"
                      >
                        <span className={cn(
                          'text-[10px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap',
                          STAGE_BADGE[row.stage_label] ?? 'bg-muted text-muted-foreground border-border'
                        )}>{row.stage_label}</span>
                      </button>


                      {/* OLE % */}
                      <div className="px-3 py-3.5 text-center">
                        <span className={cn('text-lg font-mono font-bold', OLE_COLOR[status])}>
                          {row.avg_ole_pct !== null ? `${row.avg_ole_pct}%` : '—'}
                        </span>
                        <div className="mt-1 h-1 rounded-full bg-muted/50 overflow-hidden">
                          <div className={cn('h-full rounded-full', OLE_BAR[status])}
                            style={{ width: `${Math.min(row.avg_ole_pct ?? 0, 100)}%` }} />
                        </div>
                      </div>


                      {/* Output SMH — clickable → Shift Detail tab */}
                      <button
                        onClick={() => { if (isLive) { setActiveTab('shifts'); setWorkcell(row.workcell); } }}
                        disabled={!isLive}
                        className={cn('px-3 py-3.5 text-center', isLive && 'cursor-pointer hover:text-primary transition-colors')}
                      >
                        <span className="font-mono text-sm font-semibold text-foreground">{Math.round(row.total_output_smh).toLocaleString()}</span>
                        <p className="text-[10px] text-muted-foreground">hrs</p>
                      </button>

                      {/* Input Hrs — clickable → Paid Hours tab */}
                      <button
                        onClick={() => { if (isLive) { setActiveTab('paid_hours'); setWorkcell(row.workcell); } }}
                        disabled={!isLive}
                        className={cn('px-3 py-3.5 text-center', isLive && 'cursor-pointer hover:text-primary transition-colors')}
                      >
                        <span className="font-mono text-sm font-semibold text-foreground">{Math.round(row.total_input_hours).toLocaleString()}</span>
                        <p className="text-[10px] text-muted-foreground">hrs</p>
                      </button>

                      {/* Transferred Man-Hours — default 0 */}
                      <div className="px-3 py-3.5 text-center">
                        <span className="font-mono text-sm font-semibold text-muted-foreground">
                          {((row as any).transferred_man_hours ?? 0).toLocaleString()}
                        </span>
                        <p className="text-[10px] text-muted-foreground">hrs</p>
                      </div>

                      {/* QTY */}
                      <div className="px-3 py-3.5 text-center">
                        <span className="font-mono text-sm font-semibold text-foreground">
                          {row.total_qty != null ? row.total_qty.toLocaleString() : '—'}
                        </span>
                        <p className="text-[10px] text-muted-foreground">units</p>
                      </div>

                      {/* Status badge */}
                      <div className="px-3 py-3.5 flex items-center justify-center">
                        <span className={cn(
                          'text-[10px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap',
                          STATUS_BADGE[status]
                        )}>{STATUS_LABEL[status]}</span>
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
                  <div className="px-3 text-center font-mono font-semibold text-foreground">{row.shift}</div>
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
                <div className="rounded-xl border border-border overflow-x-auto">
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
                  <div className="px-3 text-center font-mono text-sm text-foreground">{row.shift}</div>
                </div>
              );
            };
            return filteredProd.length > VIRTUAL_THRESHOLD ? (
              <VirtualTable rows={filteredProd} renderHeader={renderHeader} renderRow={renderRow} />
            ) : (
              <>
                <div className="rounded-xl border border-border overflow-x-auto">
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
            const gt = { gridTemplateColumns: '2.5rem 1fr 7rem 4rem 7rem 7rem 7rem 7rem 8rem' };
            return (
              <>
                <div className="rounded-xl border border-border overflow-x-auto">
                  <div className="grid bg-muted/50 border-b border-border text-xs text-muted-foreground font-medium uppercase tracking-wider" style={gt}>
                    <div className="px-4 py-3 text-center">#</div>
                    {([
                      ['workcell', 'Workcell'], ['date', 'Date'], ['shift', 'Shift'],
                      ['thc_direct', 'Direct HC'], ['tph_direct', 'Direct Hrs'],
                      ['thc_support', 'Support HC'], ['tph_support', 'Support Hrs'],
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
                      <div key={`${row.workcell}-${row.date}-${row.shift}`}
                        className="grid items-center text-sm border-b border-border last:border-0 hover:bg-muted/40 transition-colors"
                        style={gt}
                      >
                        <div className="px-4 py-3 text-center text-xs text-muted-foreground font-mono">{(page - 1) * PAGE_SIZE + i + 1}</div>
                        <div className="px-3 py-3 flex items-center gap-2.5">
                          <WorkcellBadge name={row.workcell} status="idle" />
                          <span className="font-semibold text-foreground truncate">{row.workcell}</span>
                        </div>
                        <div className="px-3 py-3 font-mono text-xs text-foreground">{row.date}</div>
                        <div className="px-3 py-3 text-center font-mono font-semibold text-foreground">{row.shift}</div>
                        <div className="px-3 py-3 text-center font-mono text-sm text-foreground">{row.thc_direct.toFixed(0)}</div>
                        <div className="px-3 py-3 text-center font-mono text-sm text-foreground">{row.tph_direct.toFixed(2)}</div>
                        <div className="px-3 py-3 text-center font-mono text-sm text-foreground">{row.thc_support.toFixed(0)}</div>
                        <div className="px-3 py-3 text-center font-mono text-sm text-foreground">{row.tph_support.toFixed(2)}</div>
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
                <div className="rounded-xl border border-border overflow-x-auto">
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