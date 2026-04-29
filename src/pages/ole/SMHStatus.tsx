import { cn } from '@/lib/utils';
import { useSmhStatus } from '@/hooks/useOleData';
import { AlertTriangle, ArrowLeft, CheckCircle2, Search, RefreshCw, WifiOff, Pencil, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useState, useMemo, useEffect } from 'react';
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

const WORKCELL_LOGOS: Record<string, string> = {
  arista:      '/workcell logo/Arista.png',
  keysight:    '/workcell logo/keysight.png',
  keyisght:    '/workcell logo/keysight.png',
  aop:         '/workcell logo/aop.png',
  micron:      '/workcell logo/micron.png',
  dyson:       '/workcell logo/dyson.png',
  wabtec:      '/workcell logo/wabtec.png',
  msi:         '/workcell logo/msi.png',
  photonics:   '/workcell logo/photonics.png',
  tellabs:     '/workcell logo/tellabs.png',
  imed:        '/workcell logo/imed.png',
  collins:     '/workcell logo/collins.png',
  danaher:     '/workcell logo/danaher.png',
  infinera:    '/workcell logo/infinera.jpg',
  masimo:      '/workcell logo/masimo.png',
  resmed:      '/workcell logo/resmed.png',
  fortive:     '/workcell logo/fortive.png',
  lamresearch: '/workcell logo/lam_research.png',
  asp:         '/workcell logo/asp.jpg',
};

function WorkcellBadge({ name, status = 'idle' }: { name: string; status?: string }) {
  const [imgErr, setImgErr] = useState(false);
  const key = name.toLowerCase().replace(/[^a-z]/g, '');
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

export default function SMHStatus() {
  const navigate        = useNavigate();
  const [searchParams]  = useSearchParams();
  const workcellParam   = searchParams.get('workcell') ?? undefined;

  const { data, loading, error, refetch } = useSmhStatus({ workcell: workcellParam });

  const [search,        setSearch]        = useState('');
  const [statusFilter,  setStatusFilter]  = useState<StatusFilter>('all');
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

  const [page, setPage] = useState(1);
  const rowsPerPage = 100;
  
  const [editingRow, setEditingRow] = useState<SmhStatus | null>(null);
  const [newSmh, setNewSmh] = useState('');

  useEffect(() => {
    setPage(1);
  }, [workcellFilter, statusFilter, search]);

  const totalPages = Math.ceil(filtered.length / rowsPerPage);
  const paginatedData = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage);

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
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/12 px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <p className="text-xs text-amber-600 dark:text-amber-400">Missing SMH</p>
          </div>
          <p className="text-2xl font-mono font-bold text-amber-600 dark:text-amber-400 mt-1">{missingCount}</p>
          <p className="text-[10px] text-amber-600/70 dark:text-amber-400/60 mt-0.5">{totalQtyMissing.toLocaleString()} units produced without SMH</p>
        </div>
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/12 px-4 py-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <p className="text-xs text-emerald-600 dark:text-emerald-400">With SMH</p>
          </div>
          <p className="text-2xl font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-1">{okCount}</p>
          <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/60 mt-0.5">assemblies with valid SMH values</p>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Total assemblies</p>
          <p className="text-2xl font-mono font-bold text-foreground mt-1">{rows.length}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">unique models in MES this week</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
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
        <div className="min-w-[160px]">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Status</Label>
          <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
            <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="All status" /></SelectTrigger>
            <SelectContent>
              {FILTERS.map(({ key, label }) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Workcell filter */}
        <div className="min-w-[180px]">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Workcell</Label>
          <Select value={workcellFilter} onValueChange={setWorkcellFilter}>
            <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="All workcells" /></SelectTrigger>
            <SelectContent>
              {workcells.map(wc => (
                <SelectItem key={wc} value={wc}>{wc === 'all' ? 'All workcells' : wc}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {(search || statusFilter !== 'all' || workcellFilter !== 'all') && (
          <button
            onClick={() => { setSearch(''); setStatusFilter('all'); setWorkcellFilter('all'); }}
            className="h-9 px-3 rounded-lg border border-red-500/30 text-xs text-red-500 hover:bg-red-500/10 hover:border-red-500/50 transition-colors"
          >
            Clear
          </button>
        )}

        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} assemblies</span>
      </div>

      {/* Table */}
      {loading && rows.length === 0 ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <div className="min-w-[700px]">
              <div className="grid bg-muted/50 border-b border-border text-xs text-muted-foreground font-medium uppercase tracking-wider px-5 py-3 gap-4"
                   style={{ gridTemplateColumns: '2.5rem 4rem 1fr 7rem 6rem 7rem 3rem' }}>
                <span className="text-right">#</span>
                <span className="text-center">WC</span>
                <span>Assembly</span>
                <span>Status</span>
                <span className="text-right">SMH / Unit</span>
                <span className="text-right">Qty Produced</span>
                <span className="text-center">Edit</span>
              </div>

              {paginatedData.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">No assemblies found</div>
              ) : paginatedData.map((row, idx) => {
                const badgeStatus = row.smh_status === 'OK' ? 'optimal' : row.smh_status === 'MISSING_SMH' ? 'warning' : 'critical';

                return (
                  <div
                    key={`${row.workcell}-${row.assembly}`}
                    className="grid items-center gap-4 px-5 py-4 border-b border-border last:border-0 hover:bg-muted/40 transition-colors"
                    style={{ gridTemplateColumns: '2.5rem 4rem 1fr 7rem 6rem 7rem 3rem' }}
                  >
                    {/* Index */}
                    <span className="text-xs text-muted-foreground font-mono text-right flex-shrink-0">
                      {(page - 1) * rowsPerPage + idx + 1}
                    </span>

                    {/* Logo */}
                    <WorkcellBadge name={row.workcell} status={badgeStatus} />

                    {/* Assembly info */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className={cn(
                          'w-2 h-2 rounded-full flex-shrink-0',
                          row.smh_status === 'OK'            ? 'bg-emerald-400' :
                          row.smh_status === 'MISSING_SMH'   ? 'bg-amber-400' : 'bg-red-400'
                        )} />
                        <p className="font-semibold text-sm text-foreground font-mono truncate">{row.assembly}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {row.workcell} · Active {row.active_days} day{row.active_days !== 1 ? 's' : ''} · Last seen: {row.last_seen_date}
                      </p>
                    </div>

                    {/* Status */}
                    <div>
                      <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded border', STATUS_BADGE[row.smh_status])}>
                        {STATUS_LABEL[row.smh_status]}
                      </span>
                    </div>

                    {/* SMH value */}
                    <div className="flex flex-col items-end gap-0.5 text-xs text-right">
                      <span className={cn('font-mono font-semibold', row.smh_value > 0 ? 'text-foreground' : 'text-red-400')}>
                        {row.smh_value > 0 ? row.smh_value.toFixed(4) : 'not set'}
                      </span>
                    </div>

                    {/* Qty produced */}
                    <div className="flex flex-col items-end gap-0.5 text-xs text-right">
                      <span className="font-mono font-semibold text-foreground">{row.total_qty_produced.toLocaleString()}</span>
                    </div>

                    {/* Edit */}
                    <div className="flex justify-center">
                      <button 
                        onClick={() => { setEditingRow(row); setNewSmh(String(row.smh_value || '')); }}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Pagination Controls */}
      {!loading && filtered.length > 0 && (
        <Pagination page={page} total={filtered.length} pageSize={rowsPerPage} onChange={setPage} />
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

      {/* Edit Modal */}
      {editingRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
              <p className="font-bold text-foreground text-lg">Edit SMH Value</p>
              <button onClick={() => setEditingRow(null)} className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-6 py-6 space-y-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Workcell</Label>
                <p className="font-medium text-foreground">{editingRow.workcell}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Assembly</Label>
                <p className="font-medium text-foreground font-mono">{editingRow.assembly}</p>
              </div>
              <div className="space-y-2 pt-2">
                <Label className="text-sm font-semibold">SMH / Unit</Label>
                <Input type="number" step="0.0001" min="0" value={newSmh} onChange={e => setNewSmh(e.target.value)} placeholder="0.0000" className="font-mono" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/10">
              <button onClick={() => setEditingRow(null)}
                className="px-4 py-2 rounded-lg border border-border bg-card text-foreground text-sm font-medium hover:bg-muted transition-colors shadow-sm">
                Cancel
              </button>
              <button onClick={() => setEditingRow(null)}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm">
                Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
