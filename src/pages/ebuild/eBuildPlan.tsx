import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ArrowUpDown, CalendarIcon, ChevronDown, ChevronUp, RefreshCw, Search, WifiOff } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

// ─── Customer badge ─────────────────────────────────────────────────────────────

const CUSTOMER_LOGOS: Record<string, string> = {
  arista: '/workcell logo/Arista.png',
  keysight: '/workcell logo/keyisght.png',
  aop: '/workcell logo/aop.png',
  micron: '/workcell logo/micron.png',
};

function CustomerBadge({ name }: { name: string }) {
  const [imgErr, setImgErr] = useState(false);
  const key = name.toLowerCase().replace(/[^a-z]/g, '');
  const logoKey = Object.keys(CUSTOMER_LOGOS).find(k => key.startsWith(k));
  const logoSrc = logoKey ? CUSTOMER_LOGOS[logoKey] : null;

  if (logoSrc && !imgErr) return (
    <div className="w-12 h-7 rounded-md overflow-hidden ring-1 ring-border flex-shrink-0 flex items-center justify-center" style={{ background: '#ffffff' }}>
      <img src={logoSrc} alt={name} onError={() => setImgErr(true)} className="w-full h-full object-contain p-1" />
    </div>
  );
  return (
    <div className="w-12 h-7 rounded-md flex items-center justify-center text-[9px] font-black bg-muted text-muted-foreground ring-1 ring-border flex-shrink-0">
      {name.slice(0, 3).toUpperCase()}
    </div>
  );
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function toYmd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fromYmd(s: string): Date | undefined {
  if (!s?.trim()) return undefined;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}
function getMonday(d: Date) {
  const day = d.getDay();
  return new Date(new Date(d).setDate(d.getDate() - day + (day === 0 ? -6 : 1)));
}
function getSunday(d: Date) {
  return new Date(getMonday(new Date(d)).getTime() + 6 * 86400000);
}

function DatePickerField({ id, label, value, onChange }: {
  id: string; label: string; value: string; onChange: (v: string) => void;
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
          <Calendar mode="single" selected={date} defaultMonth={date}
            onSelect={d => { onChange(d ? toYmd(d) : ''); setOpen(false); }}
            initialFocus
          />
          {value && (
            <div className="border-t border-border p-2">
              <Button type="button" variant="ghost" size="sm" className="w-full h-8 text-xs"
                onClick={() => { onChange(''); setOpen(false); }}>Clear date</Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface BuildPlanRow {
  Order_ID: number;
  Plant_ID: number;
  Plant: string;
  SMT_Customer_ID: number;
  Customer: string;
  SMT_Bay_ID: number;
  Bay: string;
  SMT_BayType_ID: string;
  BayType: string;
  SMT_Mode_ID: number;
  Mode: string;
  SMT_Status_ID: number;
  Status: string;
  Sub_Status: string;
  ForeColor: string;
  BgColor: string;
  JobNumber: string;
  BatchNumber: string;
  Quantity: number;
  SMT_Assembly: string;
  Final_Assembly: string;
  // ── fields below fetched but not yet displayed ──
  // Hours:              number;
  // PanelSize:          number;
  // Deviation:          string;
  // DoubleSided:        number;
  // LeadFree:           number;
  // Backflushed_Qty:    number;
  // WIP:                number | null;
  // UnitsCompleted:     number;
  // '%':                number;
  // CompletedDateTime:  string | null;
  // Active:             number;
  // Updated:            number;
  // UserID:             string;
  // LastUpdated:        string;
  // Comments:           number;
  // ME_Info:            number;
  // Alerts:             number;
  // Split:              number;
  // MES:                number;
  // FlagColor:          string;
  // Status_Indicator:   string;
  // BottomSide:         number;
  // QRAP:               string;
  // KittingProgressSMT: string;
  // KittingProgressMI:  string;
  // KittingProgressMA:  string;
  // KittingProgressBB:  string;
  // DiscreteJobNumber:  string;
  // CompanyA:           number;
  // 'CompanyA%':        number;
  // MAStart:            number;
  // Packout:            number;
  // 'CompanyB%':        number;
  // SourceId:           number;
  // PLM_Ver:            string;
  // SetupSheetID:       string;
  // RouteName:          string;
  // Route_Step:         string;
  // PoNumber:           string;
  // Flag:               string | null;
  // FA_Rev_Ver:         string | null;
}

type SortKey = 'Customer' | 'Plant' | 'Bay' | 'Status' | 'JobNumber' | 'BatchNumber' | 'Quantity' | 'SMT_Assembly' | 'Final_Assembly';
type SortDir = 'asc' | 'desc';

function badgeStyle(bg: string, fg: string): React.CSSProperties {
  if (!bg) return {};
  return { backgroundColor: bg, color: fg || '#000', border: 'none' };
}

const GRID = '2.5rem 20rem 4.5rem 11rem 5rem 12rem 10rem 8rem 8rem 1fr';

const COLS: [SortKey | null, string][] = [
  ['Customer', 'Customer'],
  ['Plant', 'Plant'],
  ['Bay', 'Bay'],
  ['Status', 'Status'],
  ['SMT_Assembly', 'SMT Assembly'],
  ['Final_Assembly', 'Final Assembly'],
  ['JobNumber', 'Job No.'],
  ['BatchNumber', 'Batch Number'],
  ['Quantity', 'Qty'],
  // removed: BayType, Mode, Sub_Status, Order_ID
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function EBuildPlan() {
  const now = new Date();
  const [fromDate, setFromDate] = useState(() => toYmd(getMonday(now)));
  const [toDate, setToDate] = useState(() => toYmd(getSunday(now)));

  const [rows, setRows] = useState<BuildPlanRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);

  const [search, setSearch] = useState('');
  const [plantFilter, setPlantFilter] = useState('All');
  const [modeFilter, setModeFilter] = useState('All');
  const [sortKey, setSortKey] = useState<SortKey>('Customer');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ebuild/buildplan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: fromDate, to: toDate }),
      });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      setRows(data.rows ?? []);
      setFetched(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  };

  // ── Filters ───────────────────────────────────────────────────────────────

  const plants = useMemo(() => ['All', ...Array.from(new Set(rows.map(r => r.Plant).filter(Boolean))).sort()], [rows]);
  const modes = useMemo(() => ['All', ...Array.from(new Set(rows.map(r => r.Mode).filter(Boolean))).sort()], [rows]);

  const filtered = useMemo(() => {
    let list = [...rows];
    if (search) list = list.filter(r =>
      r.Customer?.toLowerCase().includes(search.toLowerCase()) ||
      r.Bay?.toLowerCase().includes(search.toLowerCase()) ||
      r.JobNumber?.toLowerCase().includes(search.toLowerCase()) ||
      r.BatchNumber?.toLowerCase().includes(search.toLowerCase())
    );
    if (plantFilter !== 'All') list = list.filter(r => r.Plant === plantFilter);
    if (modeFilter !== 'All') list = list.filter(r => r.Mode === modeFilter);
    list.sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1;
      const va = a[sortKey]; const vb = b[sortKey];
      if (typeof va === 'number' && typeof vb === 'number') return mul * (va - vb);
      return mul * String(va ?? '').localeCompare(String(vb ?? ''));
    });
    return list;
  }, [rows, search, plantFilter, modeFilter, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-30" />;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />;
  };

  const [page, setPage] = useState(1);

  // Reset page when filters change
  useEffect(() => setPage(1), [search, plantFilter, modeFilter, sortKey, sortDir]);

  const PAGE_SIZE = 100;
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const uniqueCustomers = new Set(rows.map(r => r.Customer)).size;
  const uniqueBays = new Set(rows.map(r => r.Bay)).size;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-0">

      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-20 bg-background border-b border-border px-6">
        <div className="pt-4 pb-3 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">eBuild Plan</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {loading ? 'Loading…' : error ? 'API unreachable' : fetched
                ? `SMT build schedule — ${rows.length} orders`
                : 'Select a date range and click Apply'}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {error && <span className="flex items-center gap-1.5 text-xs text-destructive"><WifiOff className="h-3.5 w-3.5" /> {error}</span>}
            {fetched && !loading && (
              <div className="hidden md:flex items-center gap-6 text-sm font-mono">
                <span className="text-muted-foreground">Orders <span className="text-foreground font-semibold">{rows.length}</span></span>
                <span className="text-muted-foreground">Customers <span className="text-foreground font-semibold">{uniqueCustomers}</span></span>
                <span className="text-muted-foreground">Bays <span className="text-foreground font-semibold">{uniqueBays}</span></span>
              </div>
            )}
          </div>
        </div>

        {/* ── Filter bar ── */}
        <div className="pb-3 flex flex-wrap items-end gap-3">
          <div className="relative min-w-[200px] max-w-xs flex-1">
            <Search className="absolute left-2.5 top-[50%] -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search customer, bay, job…" className="pl-8 h-9" />
          </div>
          <DatePickerField id="ebuild-from" label="Date From" value={fromDate} onChange={setFromDate} />
          <DatePickerField id="ebuild-to" label="Date To" value={toDate} onChange={setToDate} />
          <div className="flex flex-col justify-end">
            <Button onClick={fetchData} disabled={loading} size="sm" className="h-9 px-4 text-xs font-medium">
              <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', loading && 'animate-spin')} />
              {loading ? 'Loading…' : 'Apply'}
            </Button>
          </div>
          {fetched && <span className="text-xs text-muted-foreground ml-auto self-end pb-0.5">{filtered.length} orders</span>}
        </div>
      </div>

      {/* ── Plant + Mode pills ── */}
      {fetched && (
        <div className="px-6 pt-3 pb-2 flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5 flex-wrap">
            {plants.map(p => (
              <button key={p} onClick={() => setPlantFilter(p)}
                className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                  plantFilter === p ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground border-border hover:text-foreground hover:border-foreground/30'
                )}>{p}</button>
            ))}
          </div>
          {modes.length > 1 && <div className="w-px h-4 bg-border mx-1" />}
          <div className="flex gap-1.5 flex-wrap">
            {modes.map(m => (
              <button key={m} onClick={() => setModeFilter(m)}
                className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                  modeFilter === m ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground border-border hover:text-foreground hover:border-foreground/30'
                )}>{m}</button>
            ))}
          </div>
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {loading && (
        <div className="px-6 pt-4 pb-4 space-y-2">
          {[...Array(6)].map((_, i) => <div key={i} className="h-12 rounded-xl bg-muted/40 animate-pulse" />)}
        </div>
      )}

      {/* ── Table (always shown) ── */}
      {!loading && (
        <div className="px-6 pb-8 pt-2">
          <div className="rounded-xl border border-border overflow-hidden overflow-x-auto">

            {/* Header */}
            <div className="grid bg-muted/50 border-b border-border text-xs text-muted-foreground font-medium uppercase tracking-wider min-w-max"
              style={{ gridTemplateColumns: GRID }}>
              <div className="px-4 py-3 text-center">No</div>
              {COLS.map(([key, label]) => key ? (
                <button key={label} onClick={() => toggleSort(key)}
                  className="px-3 py-3 text-left flex items-center hover:text-foreground transition-colors whitespace-nowrap">
                  {label} <SortIcon k={key} />
                </button>
              ) : (
                <div key={label} className="px-3 py-3 whitespace-nowrap">{label}</div>
              ))}
            </div>

            {/* Body */}
            {!fetched ? (
              <div className="py-16 text-center text-muted-foreground text-sm">
                Select a date range above and click{' '}
                <span className="font-medium text-foreground">Apply</span>{' '}
                to load build plan data.
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground text-sm">
                No orders found for the selected date range.
              </div>
            ) : pageRows.map((row, idx) => (
              <div key={`${row.Order_ID}-${idx}`}
                className="grid items-center border-b border-border last:border-0 hover:bg-muted/40 transition-colors min-w-max overflow-hidden"
                style={{ gridTemplateColumns: GRID }}
              >
                <div className="px-4 py-3.5 text-center text-xs text-muted-foreground font-mono">{(page - 1) * PAGE_SIZE + idx + 1}</div>
                <div className="px-3 py-3.5 min-w-0 flex items-center gap-2.5">
                  <CustomerBadge name={row.Customer} />
                  <span className="text-sm font-semibold text-foreground block truncate">{row.Customer}</span>
                </div>
                <div className="px-3 py-3.5 min-w-0"><span className="text-sm text-foreground block truncate">{row.Plant || '—'}</span></div>
                <div className="px-3 py-3.5 min-w-0"><span className="text-sm text-foreground block truncate">{row.Bay || '—'}</span></div>
                <div className="px-3 py-3.5">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-transparent whitespace-nowrap"
                    style={row.BgColor ? badgeStyle(row.BgColor, row.ForeColor) : undefined}>
                    {row.Status || '—'}
                  </span>
                </div>
                <div className="px-3 py-3.5 min-w-0"><span className="text-xs font-mono text-foreground block truncate">{row.SMT_Assembly || '—'}</span></div>
                <div className="px-3 py-3.5 min-w-0"><span className="text-xs font-mono text-foreground block truncate">{row.Final_Assembly || '—'}</span></div>
                <div className="px-3 py-3.5 min-w-0"><span className="text-sm font-mono text-foreground block truncate">{row.JobNumber || '—'}</span></div>
                <div className="px-3 py-3.5 min-w-0"><span className="text-xs font-mono text-foreground block truncate">{row.BatchNumber || '—'}</span></div>
                <div className="px-3 py-3.5"><span className="text-xs font-mono text-foreground">{row.Quantity ?? '—'}</span></div>
              </div>
            ))}
          </div>
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-3 px-1">
              <span className="text-xs text-muted-foreground">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length.toLocaleString()}
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(1)} disabled={page === 1}
                  className="px-2 py-1 text-xs rounded border border-border text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">«</button>
                <button onClick={() => setPage(p => p - 1)} disabled={page === 1}
                  className="px-2 py-1 text-xs rounded border border-border text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">‹</button>
                <span className="px-3 py-1 text-xs font-mono text-foreground">{page} / {totalPages}</span>
                <button onClick={() => setPage(p => p + 1)} disabled={page === totalPages}
                  className="px-2 py-1 text-xs rounded border border-border text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">›</button>
                <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                  className="px-2 py-1 text-xs rounded border border-border text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">»</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
