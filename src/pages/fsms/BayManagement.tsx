import {
  Dialog, DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  ArrowUpDown, ChevronDown, ChevronUp,
  Lock, LockOpen, Pencil, RefreshCw, Search, WifiOff,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Bay {
  _id?: string;
  bay_number: string;
  workcell: string;
  plant: string;
  floor: string;
  status: string;
  description: string;
  length_m: number;
  width_m: number;
  rate_per_sqm: number;
  line_manager: string;
  pic: string;
  area_sqm: number;
  monthly_cost: number;
}

type SortKey = 'bay_number' | 'workcell' | 'plant' | 'status' | 'length_m' | 'width_m' | 'rate_per_sqm' | 'line_manager';
type SortDir = 'asc' | 'desc';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  'Active': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  'Idle': 'bg-muted text-muted-foreground border-border',
  'Reserved': 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  'Under Maintenance': 'bg-amber-500/15 text-amber-400 border-amber-500/30',
};

const ALL = '__all__';
const PLANT_OPTIONS = [
  { label: 'All', value: 'All' },
  { label: 'P1', value: 'P1' },
  { label: 'P2', value: 'P2' },
  { label: 'BK', value: 'BK' },
  { label: 'P3', value: 'P3' },
];
const STATUS_OPTIONS = ['Active', 'Idle', 'Reserved', 'Under Maintenance'];
const FLOOR_OPTIONS = ['L1', 'L2', 'L3'];
const FSMS_API = '/api/fsms';
const GRID = '2.5rem 7rem 6rem 4rem 4rem 8rem 5rem 5rem 5.5rem 6.5rem 7rem 8rem 7rem';
const ACTIONS_W = '5.5rem';

// ─── BayEditModal ─────────────────────────────────────────────────────────────

export function BayEditModal({
  bay, open, onClose, onSave,
}: {
  bay: Bay;
  open: boolean;
  onClose: () => void;
  onSave: (updated: Bay) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Bay>(bay);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (open) { setDraft(bay); setError(null); } }, [open, bay]);

  const patch = (field: keyof Bay, value: string | number) =>
    setDraft(d => ({ ...d, [field]: value }));

  const area = (draft.length_m ?? 0) * (draft.width_m ?? 0);
  const cost = area * (draft.rate_per_sqm ?? 0);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(draft);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const fieldInput = (
    label: string,
    field: keyof Bay,
    type: 'text' | 'number' = 'text',
    hint?: string,
  ) => (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
      <input
        type={type}
        value={(draft[field] as string | number) ?? ''}
        onChange={e => patch(field, type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
        className="w-full text-sm bg-muted/40 border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-foreground placeholder:text-muted-foreground"
      />
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );

  const fieldSelect = (label: string, field: keyof Bay, options: string[]) => (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
      <select
        value={(draft[field] as string) ?? ''}
        onChange={e => patch(field, e.target.value)}
        className="w-full text-sm bg-muted/40 border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-foreground"
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Pencil className="h-4 w-4 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-foreground">
                Edit Bay — <span className="font-mono text-primary">{bay.bay_number}</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Update floor space details, dimensions, cost rate and personnel
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">

          {/* Section: Classification */}
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Classification</p>
            <div className="grid grid-cols-3 gap-4">
              {fieldSelect('Workcell', 'workcell', ['Arista', 'Keysight', 'Aop', 'Micron'])}
              {fieldSelect('Plant', 'plant', ['P1', 'P2', 'BK', 'P3'])}
              {fieldSelect('Floor', 'floor', FLOOR_OPTIONS)}
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Section: Status */}
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Status</p>
            <div className="grid grid-cols-2 gap-4">
              {fieldSelect('Status', 'status', STATUS_OPTIONS)}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Preview</label>
                <div className="flex items-center h-[38px]">
                  <span className={cn(
                    'text-[11px] font-semibold px-3 py-1 rounded-full border',
                    STATUS_BADGE[draft.status] ?? 'bg-muted text-muted-foreground border-border'
                  )}>{draft.status || '—'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Section: Dimensions & Cost */}
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Dimensions & Cost</p>
            <div className="grid grid-cols-3 gap-4">
              {fieldInput('Length (m)', 'length_m', 'number')}
              {fieldInput('Width (m)', 'width_m', 'number')}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Area (m²)</label>
                <div className="flex items-center h-[38px] px-3 rounded-lg bg-muted/20 border border-border">
                  <span className="text-sm font-mono text-foreground">{area > 0 ? area.toFixed(1) : '—'}</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              {fieldInput('Rate / m² (RM)', 'rate_per_sqm', 'number')}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Monthly Cost (RM)</label>
                <div className="flex items-center h-[38px] px-3 rounded-lg bg-muted/20 border border-border">
                  <span className="text-sm font-mono font-semibold text-foreground">
                    {cost > 0 ? cost.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Section: Personnel */}
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Personnel</p>
            <div className="grid grid-cols-2 gap-4">
              {fieldInput('Line Manager', 'line_manager')}
              {fieldInput('PIC', 'pic')}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t border-border bg-muted/20 flex items-center gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 sm:flex-none px-5 py-2 rounded-lg text-sm font-medium border border-destructive/50 text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 sm:flex-none px-6 py-2 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {saving && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── BayRow — stateless, lock/modal state lifted to parent ──────────────────

function BayRow({
  bay, idx, isLocked, onToggleLock, onEdit,
}: {
  bay: Bay;
  idx: number;
  isLocked: boolean;
  onToggleLock: () => void;
  onEdit: () => void;
}) {
  const area = (bay.length_m ?? 0) * (bay.width_m ?? 0);
  const monthlyCost = area * (bay.rate_per_sqm ?? 0);

  const cell = (content: React.ReactNode, cls = '') => (
    <div className={cn('px-3 py-3.5 flex items-center text-sm min-w-0', cls)}>{content}</div>
  );

  return (
    <div className={cn(
      'flex items-stretch border-b border-border last:border-0 transition-colors group',
      'hover:bg-muted/40',
      isLocked && 'opacity-70'
    )}>
      <div className="grid items-center flex-1 min-w-0" style={{ gridTemplateColumns: GRID }}>
        {cell(<span className="text-xs text-muted-foreground font-mono">{idx + 1}</span>, 'justify-center px-4')}
        {cell(<span className="font-semibold text-foreground truncate">{bay.bay_number}</span>)}
        {cell(<span className="text-foreground truncate">{bay.workcell || '—'}</span>)}
        {cell(<span className="text-foreground truncate">{bay.plant || '—'}</span>)}
        {cell(<span className="text-foreground truncate">{bay.floor || '—'}</span>)}
        {cell(
          <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap',
            STATUS_BADGE[bay.status] ?? 'bg-muted text-muted-foreground border-border')}>
            {bay.status || '—'}
          </span>
        )}
        {cell(<span className="font-mono text-sm text-foreground truncate">{bay.length_m || '—'}</span>)}
        {cell(<span className="font-mono text-sm text-foreground truncate">{bay.width_m || '—'}</span>)}
        {cell(<span className="font-mono text-sm text-foreground truncate">{area > 0 ? area.toFixed(1) : '—'}</span>)}
        {cell(<span className="font-mono text-sm text-foreground truncate">{bay.rate_per_sqm > 0 ? bay.rate_per_sqm.toFixed(2) : '—'}</span>)}
        {cell(<span className="font-mono text-sm font-semibold text-foreground truncate">{monthlyCost > 0 ? monthlyCost.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}</span>)}
        {cell(<span className="text-foreground truncate">{bay.line_manager || '—'}</span>)}
        {cell(<span className="text-foreground truncate">{bay.pic || '—'}</span>)}
      </div>

      <div className="flex-shrink-0 flex items-center gap-1.5 px-3 border-l border-border sticky right-0 z-10"
        style={{ width: ACTIONS_W, background: 'hsl(var(--background))' }}>
        <button
          onClick={onEdit}
          disabled={isLocked}
          className={cn('p-1.5 rounded-lg transition-colors',
            isLocked ? 'opacity-30 cursor-not-allowed text-muted-foreground' : 'text-muted-foreground hover:text-primary hover:bg-primary/10'
          )}
          title={isLocked ? 'Unlock to edit' : 'Edit bay'}>
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onToggleLock}
          className={cn('p-1.5 rounded-lg transition-colors',
            isLocked ? 'text-amber-400 hover:text-amber-500 hover:bg-amber-500/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          )}
          title={isLocked ? 'Unlock row' : 'Lock row'}>
          {isLocked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

// ─── SortIcon ────────────────────────────────────────────────────────────────

function SortIcon({ sortKey, k, sortDir }: { sortKey: SortKey; k: SortKey; sortDir: SortDir }) {
  if (sortKey !== k) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-30" />;
  return sortDir === 'asc' ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BayManagement() {
  const [bays, setBays] = useState<Bay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Lifted lock + edit state — keyed by bay_number so filter/sort never resets them
  const [lockedRows, setLockedRows] = useState<Set<string>>(new Set());
  const [editingBay, setEditingBay] = useState<Bay | null>(null);

  const [search, setSearch] = useState('');
  const [plantFilter, setPlantFilter] = useState('All');
  const [workcellFilter, setWorkcellFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [sortKey, setSortKey] = useState<SortKey>('bay_number');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchBays = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${FSMS_API}/bays`);
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const rawData = await res.json() as Bay[];
      const data = rawData.map((b, i) => ({ ...b, _id: `${b.bay_number}-${b.workcell}-${i}` }));
      setBays(data);
      // All rows start locked; preserve any already-unlocked rows across refresh
      setLockedRows(prev => {
        const next = new Set(prev);
        data.forEach(b => { if (b._id && !next.has(b._id)) next.add(b._id); });
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBays(); }, []);

  // ── Save handler ──────────────────────────────────────────────────────────

  const handleSave = async (updated: Bay) => {
    const res = await fetch(`${FSMS_API}/bays/${encodeURIComponent(updated.bay_number)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
    if (!res.ok) throw new Error('Save failed');
    const area = (updated.length_m ?? 0) * (updated.width_m ?? 0);
    setBays(prev => prev.map(b =>
      b._id === updated._id
        ? { ...updated, area_sqm: area, monthly_cost: area * (updated.rate_per_sqm ?? 0) }
        : b
    ));
    setEditingBay(null);
  };

  // ── Lock toggle ───────────────────────────────────────────────────────────

  const toggleLock = (id: string) => {
    setLockedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = useMemo(() => {
    let list = [...bays];
    if (search) {
      const s = search.trim().toLowerCase();
      list = list.filter(b =>
        (b.bay_number ?? '').toLowerCase().includes(s) ||
        (b.workcell ?? '').toLowerCase().includes(s) ||
        (b.line_manager ?? '').toLowerCase().includes(s) ||
        (b.pic ?? '').toLowerCase().includes(s)
      );
    }

    if (plantFilter !== 'All') {
      list = list.filter(b => {
        const p = (b.plant ?? '').trim().toLowerCase();
        const f = plantFilter.trim().toLowerCase();
        if (f === 'bk') return p.includes('bk') || p.includes('batu kawan');
        return p.includes(f);
      });
    }

    // Case-insensitive workcell match — API may return different casing
    if (workcellFilter !== ALL) {
      list = list.filter(b =>
        (b.workcell ?? '').trim().toLowerCase() === workcellFilter.trim().toLowerCase()
      );
    }

    if (statusFilter !== ALL) {
      list = list.filter(b =>
        (b.status ?? '').trim().toLowerCase() === statusFilter.trim().toLowerCase()
      );
    }

    list.sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1;
      const va = a[sortKey];
      const vb = b[sortKey];
      if (typeof va === 'number' && typeof vb === 'number') return mul * (va - vb);
      return mul * String(va ?? '').localeCompare(String(vb ?? ''));
    });
    return list;
  }, [bays, search, plantFilter, workcellFilter, statusFilter, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  // ── Stats ─────────────────────────────────────────────────────────────────

  const totalArea = bays.reduce((s, b) => s + (b.area_sqm ?? 0), 0);
  const totalCost = bays.reduce((s, b) => s + (b.monthly_cost ?? 0), 0);
  const activeBays = bays.filter(b => b.status === 'Active').length;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-0">

      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-20 bg-background border-b border-border px-6">
        <div className="pt-4 pb-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Bay Management</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {loading ? 'Loading…' : error ? 'API unreachable' : 'Floor space records — dimensions, costs and personnel per bay'}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {error && (
              <span className="flex items-center gap-1.5 text-xs text-destructive">
                <WifiOff className="h-3.5 w-3.5" /> API offline
              </span>
            )}
            <button onClick={fetchBays} disabled={loading}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40">
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /> Refresh
            </button>
            <div className="hidden md:flex items-center gap-6 text-sm font-mono">
              <span className="text-muted-foreground">Active <span className="text-foreground font-semibold">{activeBays}/{bays.length}</span></span>
              <span className="text-muted-foreground">Total Area <span className="text-foreground font-semibold">{totalArea.toLocaleString()}m²</span></span>
              <span className="text-muted-foreground">Monthly <span className="text-foreground font-semibold">RM {totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="px-6 pt-4 pb-3 flex items-center gap-3 overflow-x-auto w-full">

        {/* Search - Allowed to grow, minimum width of 200px */}
        <div className="relative min-w-[200px] flex-1 shrink-0">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search bay, workcell, manager…"
            className="pl-8 h-9"
          />
        </div>

        {/* Plant Filters - Removed flex-wrap, added shrink-0 */}
        <div className="flex gap-1.5 shrink-0">
          {PLANT_OPTIONS.map(p => (
            <button
              key={p.value}
              onClick={() => setPlantFilter(p.value)}
              className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap',
                plantFilter === p.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'text-muted-foreground border-border hover:text-foreground hover:border-foreground/30'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Workcell Select - Added wrapper with shrink-0 */}
        <div className="shrink-0">
          <Select value={workcellFilter} onValueChange={setWorkcellFilter}>
            <SelectTrigger className="h-9 text-xs w-[140px]">
              <SelectValue placeholder="All Workcells" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Workcells</SelectItem>
              {[...new Set(bays.map(b => b.workcell).filter(Boolean))].sort().map(w => (
                <SelectItem key={w as string} value={w as string}>{w}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status Select - Added wrapper with shrink-0 */}
        <div className="shrink-0">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 text-xs w-[130px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Status</SelectItem>
              {STATUS_OPTIONS.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Item Count - Pushed to the right, forced on one line */}
        <span className="text-xs text-muted-foreground ml-auto shrink-0 whitespace-nowrap">
          {filtered.length} bays
        </span>

      </div>

      {/* ── Loading skeleton ── */}
      {loading && bays.length === 0 && (
        <div className="px-6 pb-4 space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      )}

      {/* ── Table ── */}
      {(!loading || bays.length > 0) && (
        <div className="px-6 pb-8">
          {/* Outer container with overflow-x-auto for small screens, and relative positioning for sticky children */}
          <div className="rounded-xl border border-border overflow-x-auto bg-background relative shadow-sm">

            {/* --- HEADER --- */}
            <div className="flex items-stretch bg-muted/50 border-b border-border text-xs text-muted-foreground font-medium uppercase tracking-wider min-w-[800px]">

              {/* The Scrollable/Dynamic Grid Area */}
              <div className="grid flex-1 min-w-0" style={{ gridTemplateColumns: GRID }}>
                <div className="px-4 py-3 text-center">#</div>
                {([
                  ['bay_number', 'Bay No.'],
                  ['workcell', 'Workcell'],
                  ['plant', 'Plant'],
                  [null, 'Floor'],
                  ['status', 'Status'],
                  ['length_m', 'L (m)'],
                  ['width_m', 'W (m)'],
                  [null, 'Area m²'],
                  ['rate_per_sqm', 'Rate/m²'],
                  [null, 'Monthly (RM)'],
                  ['line_manager', 'Line Manager'],
                  ['pic', 'PIC'],
                ] as [SortKey | null, string][]).map(([key, label]) => (
                  key ? (
                    <button key={label} onClick={() => toggleSort(key)}
                      className="px-3 py-3 text-left flex items-center hover:text-foreground transition-colors whitespace-nowrap overflow-hidden text-ellipsis">
                      {label} <SortIcon sortKey={sortKey} k={key} sortDir={sortDir} />
                    </button>
                  ) : (
                    <div key={label} className="px-3 py-3 whitespace-nowrap overflow-hidden text-ellipsis">{label}</div>
                  )
                ))}
              </div>

              {/* Fixed Actions Header: Sticky to the right */}
              <div
                className="flex-shrink-0 flex items-center px-3 border-l border-border bg-muted/50 whitespace-nowrap sticky right-0 z-10"
                style={{ width: ACTIONS_W }}
              >
                Actions
              </div>
            </div>

            {/* --- ROWS --- */}
            <div className="flex flex-col min-w-[800px]">
              {/* Single modal instance driven by editingBay */}
              {editingBay && (
                <BayEditModal
                  bay={editingBay}
                  open={true}
                  onClose={() => setEditingBay(null)}
                  onSave={handleSave}
                />
              )}
              {filtered.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  {error ? 'Could not load bay data — is the FSMS API running?' : 'No bays found'}
                </div>
              ) : filtered.map((bay, idx) => (
                <BayRow
                  key={bay._id!}
                  bay={bay}
                  idx={idx}
                  isLocked={lockedRows.has(bay._id!)}
                  onToggleLock={() => toggleLock(bay._id!)}
                  onEdit={() => setEditingBay(bay)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
