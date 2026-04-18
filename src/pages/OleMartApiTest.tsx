/**
 * Dev/testing page — calls the FastAPI OLE mart (DuckDB/Parquet) backend.
 * Proxied via Vite: /ole-api → http://localhost:8000 (see vite.config.ts).
 */
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  ArrowUpDown,
  CalendarIcon,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  WifiOff
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

const OLE_BASE = '/ole-api';

const ALL = '__all__';

const SMH_STATUS_OPTIONS = [
  { value: 'OK', label: 'OK' },
  { value: 'MISSING_SMH', label: 'Missing SMH' },
  { value: 'NOT_IN_SMH_DB', label: 'Not in SMH DB' },
] as const;

type EndpointId =
  | 'health'
  | 'workcells'
  | 'ole'
  | 'ole_summary'
  | 'production'
  | 'paid_hours'
  | 'smh'
  | 'smh_status'
  | 'refresh';

type SortDir = 'asc' | 'desc';

interface EndpointDef {
  id: EndpointId;
  label: string;
  method: 'GET' | 'POST';
  path: string;
  /** Show optional query fields */
  filters: ('workcell' | 'date_from' | 'date_to' | 'shift' | 'assembly' | 'status')[];
}

const ENDPOINTS: EndpointDef[] = [
  { id: 'health', label: 'GET /api/health', method: 'GET', path: '/api/health', filters: [] },
  { id: 'workcells', label: 'GET /api/workcells', method: 'GET', path: '/api/workcells', filters: [] },
  { id: 'ole', label: 'GET /api/ole', method: 'GET', path: '/api/ole', filters: ['workcell', 'date_from', 'date_to', 'shift'] },
  { id: 'ole_summary', label: 'GET /api/ole/summary', method: 'GET', path: '/api/ole/summary', filters: [] },
  { id: 'production', label: 'GET /api/production', method: 'GET', path: '/api/production', filters: ['workcell', 'date_from', 'date_to', 'assembly'] },
  { id: 'paid_hours', label: 'GET /api/paid-hours', method: 'GET', path: '/api/paid-hours', filters: ['workcell', 'date_from', 'date_to'] },
  { id: 'smh', label: 'GET /api/smh', method: 'GET', path: '/api/smh', filters: ['workcell', 'assembly'] },
  { id: 'smh_status', label: 'GET /api/smh-status', method: 'GET', path: '/api/smh-status', filters: ['workcell', 'status'] },
  { id: 'refresh', label: 'POST /api/refresh', method: 'POST', path: '/api/refresh', filters: [] },
];

function columnKeys(rows: Record<string, unknown>[]): string[] {
  if (rows.length === 0) return [];
  const order: string[] = [...Object.keys(rows[0])];
  const seen = new Set(order);
  for (let i = 1; i < rows.length; i++) {
    for (const k of Object.keys(rows[i])) {
      if (!seen.has(k)) {
        seen.add(k);
        order.push(k);
      }
    }
  }
  return order;
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/** Local calendar day → YYYY-MM-DD (avoids UTC off-by-one). */
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
  const [y, m, d] = parts;
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

function DatePickerField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (ymd: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const date = fromYmd(value);

  return (
    <div className="min-w-[200px] max-w-[240px]">
      <Label htmlFor={id} className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            className={cn(
              'mt-1 w-full h-9 justify-start text-left font-normal px-2',
              !value && 'text-muted-foreground',
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-70" />
            <span className="truncate">
              {date ? format(date, 'MMM d, yyyy') : 'Any date'}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={d => {
              onChange(d ? toYmd(d) : '');
              setOpen(false);
            }}
            initialFocus
          />
          {value ? (
            <div className="border-t border-border p-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full h-8 text-xs"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
              >
                Clear date
              </Button>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default function OleMartApiTest() {
  const [endpointId, setEndpointId] = useState<EndpointId>('health');
  const [workcell, setWorkcell] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [shift, setShift] = useState('');
  const [assembly, setAssembly] = useState('');
  const [smhStatus, setSmhStatus] = useState('');

  const [workcellOptions, setWorkcellOptions] = useState<string[]>([]);
  const [assemblyOptions, setAssemblyOptions] = useState<string[]>([]);
  const [listsLoading, setListsLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [raw, setRaw] = useState<unknown>(null);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const def = ENDPOINTS.find(e => e.id === endpointId)!;

  const needsAssemblyList = def.filters.includes('assembly');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${OLE_BASE}/api/workcells`);
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as unknown;
        if (!Array.isArray(data) || cancelled) return;
        const names = new Set<string>();
        for (const row of data) {
          if (row && typeof row === 'object' && 'workcell' in row) {
            const w = (row as { workcell: unknown }).workcell;
            if (typeof w === 'string' && w.trim()) names.add(w.trim());
          }
        }
        if (!cancelled) {
          setWorkcellOptions([...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })));
        }
      } catch {
        /* OLE mart offline */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!needsAssemblyList) {
      setAssemblyOptions([]);
      setListsLoading(false);
      return;
    }
    let cancelled = false;
    setListsLoading(true);
    (async () => {
      try {
        const res = await fetch(`${OLE_BASE}/api/smh`);
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as unknown;
        if (!Array.isArray(data) || cancelled) return;
        const assemblies = new Set<string>();
        for (const row of data) {
          if (row && typeof row === 'object' && 'assembly' in row) {
            const a = (row as { assembly: unknown }).assembly;
            if (typeof a === 'string' && a.trim()) assemblies.add(a.trim());
          }
        }
        if (!cancelled) {
          setAssemblyOptions([...assemblies].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })));
        }
      } catch {
        if (!cancelled) setAssemblyOptions([]);
      } finally {
        if (!cancelled) setListsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [needsAssemblyList, endpointId]);

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (def.filters.includes('workcell') && workcell.trim()) params.set('workcell', workcell.trim());
    if (def.filters.includes('date_from') && dateFrom.trim()) params.set('date_from', dateFrom.trim());
    if (def.filters.includes('date_to') && dateTo.trim()) params.set('date_to', dateTo.trim());
    if (def.filters.includes('shift') && shift.trim()) {
      const n = parseInt(shift, 10);
      if (!Number.isNaN(n)) params.set('shift', String(n));
    }
    if (def.filters.includes('assembly') && assembly.trim()) params.set('assembly', assembly.trim());
    if (def.filters.includes('status') && smhStatus.trim()) params.set('status', smhStatus.trim());
    const q = params.toString();
    return q ? `?${q}` : '';
  }, [def.filters, workcell, dateFrom, dateTo, shift, assembly, smhStatus]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `${OLE_BASE}${def.path}${def.method === 'GET' ? buildQuery() : ''}`;
      const res = await fetch(url, {
        method: def.method,
        headers: def.method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
        body: def.method === 'POST' ? '{}' : undefined,
      });
      const text = await res.text();
      let parsed: unknown;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        parsed = text;
      }
      if (!res.ok) {
        const detail = typeof parsed === 'object' && parsed !== null && 'detail' in parsed
          ? String((parsed as { detail: unknown }).detail)
          : text || res.statusText;
        throw new Error(`${res.status} ${detail}`);
      }
      setRaw(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRaw(null);
    } finally {
      setLoading(false);
    }
  }, [def.method, def.path, buildQuery]);

  const tableRows = useMemo(() => {
    if (!Array.isArray(raw)) return null;
    return raw as Record<string, unknown>[];
  }, [raw]);

  const sortedRows = useMemo(() => {
    if (!tableRows || tableRows.length === 0) return tableRows;
    if (!sortCol) return tableRows;
    const mul = sortDir === 'asc' ? 1 : -1;
    return [...tableRows].sort((a, b) => {
      const va = a[sortCol];
      const vb = b[sortCol];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return mul * (va - vb);
      return mul * String(va).localeCompare(String(vb), undefined, { numeric: true });
    });
  }, [tableRows, sortCol, sortDir]);

  const keys = useMemo(() => (sortedRows ? columnKeys(sortedRows) : []), [sortedRows]);

  const toggleSort = (k: string) => {
    if (sortCol === k) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortCol(k);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ k }: { k: string }) => {
    if (sortCol !== k) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-30" />;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 ml-1" />
      : <ChevronDown className="w-3 h-3 ml-1" />;
  };

  const gridTemplate = useMemo(() => {
    const n = Math.max(keys.length, 1);
    return { gridTemplateColumns: `2.5rem repeat(${n}, minmax(120px, 1fr))` };
  }, [keys.length]);

  const showFilters = def.filters.length > 0;

  return (
    <div className="space-y-0">
      <div className="sticky top-0 z-20 bg-background border-b border-border px-6 mb-6">
        <div className="pt-4 pb-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                {/* <Database className="h-7 w-7 text-primary" /> */}
                OLE Mart API
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Calls the DuckDB/Parquet FastAPI on port 8000 via <code className="text-xs bg-muted px-1 rounded">/ole-api</code>
              </p>
            </div>
            <div className="flex items-center gap-3">
              {error && (
                <span className="flex items-center gap-1.5 text-xs text-destructive max-w-md truncate" title={error}>
                  <WifiOff className="h-3.5 w-3.5 shrink-0" /> {error}
                </span>
              )}
              <button
                type="button"
                onClick={() => void fetchData()}
                disabled={loading}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
                {def.method === 'POST' ? 'Run' : 'Fetch'}
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3 pb-3">
          <div className="min-w-[240px]">
            <Label htmlFor="ole-endpoint" className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Endpoint
            </Label>
            <Select
              value={endpointId}
              onValueChange={v => {
                setEndpointId(v as EndpointId);
                setError(null);
                setRaw(null);
                setSortCol(null);
              }}
            >
              <SelectTrigger id="ole-endpoint" className="mt-1 h-9">
                <SelectValue placeholder="Choose endpoint" />
              </SelectTrigger>
              <SelectContent>
                {ENDPOINTS.map(ep => (
                  <SelectItem key={ep.id} value={ep.id}>{ep.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {showFilters && (
            <>
              {def.filters.includes('workcell') && (
                <div className="min-w-[200px] max-w-[260px]">
                  <Label htmlFor="ole-workcell" className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                    Workcell
                  </Label>
                  <Select
                    value={workcell || ALL}
                    onValueChange={v => setWorkcell(v === ALL ? '' : v)}
                  >
                    <SelectTrigger id="ole-workcell" className="mt-1 h-9">
                      <SelectValue placeholder="All workcells" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>All workcells</SelectItem>
                      {workcellOptions.map(w => (
                        <SelectItem key={w} value={w}>
                          <span className="truncate" title={w}>{w}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {def.filters.includes('date_from') && (
                <DatePickerField
                  id="ole-date-from"
                  label="Date from"
                  value={dateFrom}
                  onChange={setDateFrom}
                />
              )}
              {def.filters.includes('date_to') && (
                <DatePickerField
                  id="ole-date-to"
                  label="Date to"
                  value={dateTo}
                  onChange={setDateTo}
                />
              )}
              {def.filters.includes('shift') && (
                <div className="min-w-[140px]">
                  <Label htmlFor="ole-shift" className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                    Shift
                  </Label>
                  <Select value={shift || ALL} onValueChange={v => setShift(v === ALL ? '' : v)}>
                    <SelectTrigger id="ole-shift" className="mt-1 h-9">
                      <SelectValue placeholder="Any shift" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Any shift</SelectItem>
                      <SelectItem value="1">Shift 1</SelectItem>
                      <SelectItem value="2">Shift 2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {def.filters.includes('assembly') && (
                <div className="min-w-[220px] max-w-[320px]">
                  <Label htmlFor="ole-assembly" className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                    Assembly
                    {listsLoading ? (
                      <span className="normal-case font-normal text-muted-foreground/80"> — loading…</span>
                    ) : null}
                  </Label>
                  <Select
                    value={assembly || ALL}
                    onValueChange={v => setAssembly(v === ALL ? '' : v)}
                    disabled={listsLoading}
                  >
                    <SelectTrigger id="ole-assembly" className="mt-1 h-9">
                      <SelectValue placeholder={listsLoading ? 'Loading…' : 'Any assembly'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Any assembly</SelectItem>
                      {assemblyOptions.map(a => (
                        <SelectItem key={a} value={a} title={a}>
                          <span className="truncate max-w-[280px] block">{a}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {def.filters.includes('status') && (
                <div className="min-w-[200px]">
                  <Label htmlFor="ole-smh-status" className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                    SMH status
                  </Label>
                  <Select value={smhStatus || ALL} onValueChange={v => setSmhStatus(v === ALL ? '' : v)}>
                    <SelectTrigger id="ole-smh-status" className="mt-1 h-9">
                      <SelectValue placeholder="Any status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Any status</SelectItem>
                      {SMH_STATUS_OPTIONS.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}
          <span className="text-xs text-muted-foreground ml-auto font-mono break-all">
            {def.method} {OLE_BASE}{def.path}{def.method === 'GET' ? buildQuery() : ''}
          </span>
        </div>
      </div>

      {loading && !raw && (
        <div className="px-6 pb-8 space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      )}

      {sortedRows && (
        <div className="px-6 pb-8 overflow-x-auto">
          <div className="rounded-xl border border-border overflow-hidden min-w-[640px]">
            {keys.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">No columns (empty array)</div>
            ) : (
              <>
                <div
                  className="grid bg-muted/50 border-b border-border text-xs text-muted-foreground font-medium uppercase tracking-wider"
                  style={gridTemplate}
                >
                  <div className="px-4 py-3 text-center">#</div>
                  {keys.map(k => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => toggleSort(k)}
                      className="px-3 py-3 text-left flex items-center hover:text-foreground transition-colors min-w-0"
                    >
                      <span className="truncate">{k}</span>
                      <SortIcon k={k} />
                    </button>
                  ))}
                </div>
                {sortedRows.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground text-sm">No rows</div>
                ) : (
                  sortedRows.map((row, idx) => (
                    <div
                      key={idx}
                      className="w-full grid items-center text-sm border-b border-border last:border-0 hover:bg-muted/40 transition-colors"
                      style={gridTemplate}
                    >
                      <div className="px-4 py-3 text-center text-xs text-muted-foreground font-mono">{idx + 1}</div>
                      {keys.map(k => (
                        <div key={k} className="px-3 py-3 text-left font-mono text-xs break-all min-w-0">
                          {formatCell(row[k])}
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2">{sortedRows.length} rows</p>
        </div>
      )}

      {raw !== null && !Array.isArray(raw) && (
        <div className="px-6 pb-8">
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="bg-muted/50 border-b border-border px-4 py-2 text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Response (object)
            </div>
            <pre className="p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-words max-h-[480px] overflow-y-auto bg-muted/20">
              {JSON.stringify(raw, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {!loading && raw === null && !error && (
        <div className="px-6 pb-12 text-center text-muted-foreground text-sm">
          Select an endpoint and click {def.method === 'POST' ? 'Run' : 'Fetch'}.
        </div>
      )}
    </div>
  );
}
