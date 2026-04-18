import { cn } from '@/lib/utils';
import { useSmhStatus } from '@/hooks/useOleData';
import { AlertTriangle, ArrowLeft, CheckCircle2, Search, RefreshCw, WifiOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { SmhStatus } from '@/lib/oleApi';

type StatusFilter = 'all' | 'MISSING_SMH' | 'NOT_IN_SMH_DB' | 'OK';

const STATUS_BADGE: Record<SmhStatus['smh_status'], string> = {
  OK:             'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  MISSING_SMH:    'bg-amber-500/15  text-amber-400  border-amber-500/30',
  NOT_IN_SMH_DB:  'bg-red-500/15    text-red-400    border-red-500/30',
};

const STATUS_LABEL: Record<SmhStatus['smh_status'], string> = {
  OK:             'OK',
  MISSING_SMH:    'Missing SMH',
  NOT_IN_SMH_DB:  'Not in DB',
};

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all',            label: 'All' },
  { key: 'MISSING_SMH',    label: 'Missing SMH' },
  { key: 'NOT_IN_SMH_DB',  label: 'Not in DB' },
  { key: 'OK',             label: 'OK' },
];

export default function SMHStatus() {
  const navigate        = useNavigate();
  const [searchParams]  = useSearchParams();
  const workcellParam   = searchParams.get('workcell') ?? undefined;

  const { data, loading, error, refetch } = useSmhStatus({ workcell: workcellParam });

  const [search,        setSearch]        = useState('');
  const [statusFilter,  setStatusFilter]  = useState<StatusFilter>('MISSING_SMH');
  const [workcellFilter, setWorkcellFilter] = useState(workcellParam ?? 'all');

  const rows = data ?? [];

  // Unique workcells for filter pills
  const workcells = useMemo(() => {
    const wcs = Array.from(new Set(rows.map(r => r.workcell))).sort();
    return ['all', ...wcs];
  }, [rows]);

  const filtered = useMemo(() => {
    let list = [...rows];
    if (workcellFilter !== 'all') list = list.filter(r => r.workcell === workcellFilter);
    if (statusFilter !== 'all')   list = list.filter(r => r.smh_status === statusFilter);
    if (search) list = list.filter(r =>
      r.assembly.toLowerCase().includes(search.toLowerCase()) ||
      r.workcell.toLowerCase().includes(search.toLowerCase())
    );
    return list.sort((a, b) => b.total_qty_produced - a.total_qty_produced);
  }, [rows, workcellFilter, statusFilter, search]);

  // Summary counts
  const missingCount = rows.filter(r => r.smh_status !== 'OK').length;
  const okCount      = rows.filter(r => r.smh_status === 'OK').length;
  const totalQtyMissing = rows
    .filter(r => r.smh_status !== 'OK')
    .reduce((s, r) => s + r.total_qty_produced, 0);

  return (
    <div className="space-y-5 p-6">

      {/* Page header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(workcellParam ? `/ole/${encodeURIComponent(workcellParam)}` : '/ole')}
          className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">SMH Coverage</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {loading ? 'Loading…' : error ? 'Backend unreachable' :
              `Assembly models in MES production — SMH status from OLE Webtools`}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {error && (
            <span className="flex items-center gap-1.5 text-xs text-destructive">
              <WifiOff className="h-3.5 w-3.5" /> API offline
            </span>
          )}
          <button
            onClick={refetch}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <p className="text-xs text-amber-400/80">Missing SMH</p>
          </div>
          <p className="text-2xl font-mono font-bold text-amber-400 mt-1">{missingCount}</p>
          <p className="text-[10px] text-amber-400/60 mt-0.5">{totalQtyMissing.toLocaleString()} units produced without SMH</p>
        </div>
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <p className="text-xs text-emerald-400/80">With SMH</p>
          </div>
          <p className="text-2xl font-mono font-bold text-emerald-400 mt-1">{okCount}</p>
          <p className="text-[10px] text-emerald-400/60 mt-0.5">assemblies with valid SMH values</p>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Total assemblies</p>
          <p className="text-2xl font-mono font-bold text-foreground mt-1">{rows.length}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">unique models in MES this week</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search assembly…"
            className="pl-8 h-9"
          />
        </div>

        {/* Status filter */}
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                statusFilter === key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'text-muted-foreground border-border hover:text-foreground hover:border-foreground/30'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Workcell filter */}
        <div className="flex flex-wrap gap-2">
          {workcells.map(wc => (
            <button
              key={wc}
              onClick={() => setWorkcellFilter(wc)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                workcellFilter === wc
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'text-muted-foreground border-border hover:text-foreground hover:border-foreground/30'
              )}
            >
              {wc === 'all' ? 'All workcells' : wc}
            </button>
          ))}
        </div>

        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} assemblies</span>
      </div>

      {/* Table — matching Documents page style */}
      {loading && rows.length === 0 ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden bg-card">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">No assemblies found</div>
          ) : filtered.map((row, idx) => (
            <div
              key={`${row.workcell}-${row.assembly}`}
              className="flex items-center gap-4 px-5 py-4 border-b border-border last:border-0 hover:bg-muted/40 transition-colors"
            >
              {/* Index */}
              <span className="text-xs text-muted-foreground font-mono w-6 text-right flex-shrink-0">{idx + 1}</span>

              {/* Status dot */}
              <div className={cn(
                'w-2 h-2 rounded-full flex-shrink-0',
                row.smh_status === 'OK'            ? 'bg-emerald-400' :
                row.smh_status === 'MISSING_SMH'   ? 'bg-amber-400' : 'bg-red-400'
              )} />

              {/* Assembly info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm text-foreground font-mono">{row.assembly}</p>
                  <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded border', STATUS_BADGE[row.smh_status])}>
                    {STATUS_LABEL[row.smh_status]}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {row.workcell} · Active {row.active_days} day{row.active_days !== 1 ? 's' : ''} · Last seen: {row.last_seen_date}
                </p>
              </div>

              {/* SMH value */}
              <div className="hidden sm:flex flex-col items-end gap-0.5 text-xs flex-shrink-0 w-20 text-right">
                <span className="text-muted-foreground">SMH/unit</span>
                <span className={cn('font-mono font-semibold', row.smh_value > 0 ? 'text-foreground' : 'text-red-400')}>
                  {row.smh_value > 0 ? row.smh_value.toFixed(4) : 'not set'}
                </span>
              </div>

              {/* Qty produced */}
              <div className="hidden md:flex flex-col items-end gap-0.5 text-xs flex-shrink-0 w-24 text-right">
                <span className="text-muted-foreground">Qty produced</span>
                <span className="font-mono font-semibold text-foreground">{row.total_qty_produced.toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action note */}
      {missingCount > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-blue-500/30 bg-blue-500/5 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-400/90">
            To fix missing SMH — log in to <strong>OLE Webtools</strong> and enter SMH/unit values for the assemblies listed above. Once entered and the pipeline refreshes, these will be resolved automatically.
          </p>
        </div>
      )}
    </div>
  );
}
