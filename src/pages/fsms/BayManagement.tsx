import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  ArrowUpDown, Check, ChevronDown, ChevronUp,
  Lock, LockOpen, Pencil, RefreshCw, Search, WifiOff, X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Bay {
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
  locked?: boolean; // client-side only
}

type SortKey = 'bay_number' | 'workcell' | 'plant' | 'status' | 'length_m' | 'width_m' | 'rate_per_sqm' | 'line_manager';
type SortDir = 'asc' | 'desc';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  'Active':            'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  'Idle':              'bg-muted text-muted-foreground border-border',
  'Reserved':          'bg-blue-500/15 text-blue-400 border-blue-500/30',
  'Under Maintenance': 'bg-amber-500/15 text-amber-400 border-amber-500/30',
};

const WORKCELLS    = ['All', 'Arista', 'Keysight', 'Aop', 'Micron'];
const PLANT_OPTIONS = [
  { label: 'All', value: 'All' },
  { label: 'P1',  value: 'P1' },
  { label: 'P2',  value: 'P2' },
  { label: 'BK',  value: 'BK' },
  { label: 'P3',  value: 'P3' },
];
const STATUS_OPTIONS = ['Active', 'Idle', 'Reserved', 'Under Maintenance'];
const FLOOR_OPTIONS  = ['L1', 'L2', 'L3'];
const FSMS_API = '/api/fsms';

// ─── Component ────────────────────────────────────────────────────────────────

export default function BayManagement() {
  const [bays, setBays]           = useState<Bay[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [saving, setSaving]       = useState<string | null>(null); // bay_number being saved

  // Client-side lock state (not persisted — UX only)
  const [lockedIds, setLockedIds] = useState<Set<string>>(new Set());

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Bay>>({});

  const [search, setSearch]               = useState('');
  const [plantFilter, setPlantFilter]     = useState('All');
  const [workcellFilter, setWorkcellFilter] = useState('All');
  const [statusFilter, setStatusFilter]   = useState('All');
  const [sortKey, setSortKey]             = useState<SortKey>('bay_number');
  const [sortDir, setSortDir]             = useState<SortDir>('asc');

  // ── Fetch bays ────────────────────────────────────────────────────────────

  const fetchBays = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${FSMS_API}/bays`);
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json() as Bay[];
      setBays(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBays(); }, []);

  // ── Computed ──────────────────────────────────────────────────────────────

  const area  = (b: Partial<Bay>) => (b.length_m ?? 0) * (b.width_m ?? 0);
  const cost  = (b: Partial<Bay>) => area(b) * (b.rate_per_sqm ?? 0);

  // ── Sort + filter ─────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = [...bays];
    if (search) list = list.filter(b =>
      b.bay_number.toLowerCase().includes(search.toLowerCase()) ||
      (b.workcell ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (b.line_manager ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (b.pic ?? '').toLowerCase().includes(search.toLowerCase())
    );
    if (plantFilter    !== 'All') list = list.filter(b => b.plant    === plantFilter);
    if (workcellFilter !== 'All') list = list.filter(b => b.workcell === workcellFilter);
    if (statusFilter   !== 'All') list = list.filter(b => b.status   === statusFilter);
    list.sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1;
      const va = a[sortKey]; const vb = b[sortKey];
      if (typeof va === 'number' && typeof vb === 'number') return mul * (va - vb);
      return mul * String(va ?? '').localeCompare(String(vb ?? ''));
    });
    return list;
  }, [bays, search, plantFilter, workcellFilter, statusFilter, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-30" />;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />;
  };

  // ── Edit handlers ─────────────────────────────────────────────────────────

  const startEdit = (bay: Bay) => {
    setEditingId(bay.bay_number);
    setEditDraft({ ...bay });
  };

  const cancelEdit = () => { setEditingId(null); setEditDraft({}); };

  const commitEdit = async () => {
    if (!editingId) return;
    setSaving(editingId);
    try {
      const res = await fetch(`${FSMS_API}/bays/${encodeURIComponent(editingId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editDraft),
      });
      if (!res.ok) throw new Error('Save failed');
      // Update local state optimistically
      setBays(prev => prev.map(b =>
        b.bay_number === editingId ? { ...b, ...editDraft, area_sqm: area(editDraft), monthly_cost: cost(editDraft) } as Bay : b
      ));
      setEditingId(null);
      setEditDraft({});
    } catch {
      // Keep editing open on failure
    } finally {
      setSaving(null);
    }
  };

  const toggleLock = (bay_number: string) => {
    if (editingId === bay_number) cancelEdit();
    setLockedIds(prev => {
      const next = new Set(prev);
      next.has(bay_number) ? next.delete(bay_number) : next.add(bay_number);
      return next;
    });
  };

  const patch = (field: keyof Bay, value: any) =>
    setEditDraft(d => ({ ...d, [field]: value }));

  // ── Stats ─────────────────────────────────────────────────────────────────

  const totalArea  = bays.reduce((s, b) => s + (b.area_sqm ?? 0), 0);
  const totalCost  = bays.reduce((s, b) => s + (b.monthly_cost ?? 0), 0);
  const activeBays = bays.filter(b => b.status === 'Active').length;

  // ── Grid ──────────────────────────────────────────────────────────────────

  const GRID = '2.5rem 7rem 6rem 4rem 4rem 8rem 5rem 5rem 5.5rem 6.5rem 7rem 8rem 7rem 5.5rem';

  // ── Cell helpers ──────────────────────────────────────────────────────────

  const cell = (content: React.ReactNode, cls = '') => (
    <div className={cn('px-3 py-3.5 flex items-center text-sm', cls)}>{content}</div>
  );

  const editInput = (field: keyof Bay, type: 'text' | 'number' = 'text') => (
    <input
      type={type}
      value={(editDraft[field] as string | number) ?? ''}
      onChange={e => patch(field, type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
      className="w-full text-xs bg-background border border-primary/50 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-primary text-foreground"
      onClick={e => e.stopPropagation()}
    />
  );

  const editSelect = (field: keyof Bay, options: string[]) => (
    <select
      value={(editDraft[field] as string) ?? ''}
      onChange={e => patch(field, e.target.value)}
      className="w-full text-xs bg-background border border-primary/50 rounded px-1 py-1 outline-none focus:ring-1 focus:ring-primary text-foreground"
      onClick={e => e.stopPropagation()}
    >
      {options.map(o => <option key={o}>{o}</option>)}
    </select>
  );

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
      <div className="px-6 pt-4 pb-3 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] max-w-xs flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search bay, workcell, manager…" className="pl-8 h-9" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {PLANT_OPTIONS.map(p => (
            <button key={p.value} onClick={() => setPlantFilter(p.value)}
              className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                plantFilter === p.value ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground border-border hover:text-foreground hover:border-foreground/30'
              )}>{p.label}</button>
          ))}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {WORKCELLS.map(w => (
            <button key={w} onClick={() => setWorkcellFilter(w)}
              className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                workcellFilter === w ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground border-border hover:text-foreground hover:border-foreground/30'
              )}>{w}</button>
          ))}
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background text-foreground outline-none focus:ring-1 focus:ring-ring">
          <option value="All">All Status</option>
          {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
        </select>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} bays</span>
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
          <div className="rounded-xl border border-border overflow-hidden overflow-x-auto">

            {/* Header */}
            <div className="grid bg-muted/50 border-b border-border text-xs text-muted-foreground font-medium uppercase tracking-wider min-w-max"
              style={{ gridTemplateColumns: GRID }}>
              <div className="px-4 py-3 text-center">#</div>
              {([
                ['bay_number',   'Bay No.'],
                ['workcell',     'Workcell'],
                ['plant',        'Plant'],
                [null,           'Floor'],
                ['status',       'Status'],
                ['length_m',     'L (m)'],
                ['width_m',      'W (m)'],
                [null,           'Area m²'],
                ['rate_per_sqm', 'Rate/m²'],
                [null,           'Monthly (RM)'],
                ['line_manager', 'Line Manager'],
                ['pic',          'PIC'],
                [null,           'Actions'],
              ] as [SortKey | null, string][]).map(([key, label]) => (
                key ? (
                  <button key={label} onClick={() => toggleSort(key)}
                    className="px-3 py-3 text-left flex items-center hover:text-foreground transition-colors whitespace-nowrap">
                    {label} <SortIcon k={key} />
                  </button>
                ) : (
                  <div key={label} className="px-3 py-3 whitespace-nowrap">{label}</div>
                )
              ))}
            </div>

            {/* Rows */}
            {filtered.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                {error ? 'Could not load bay data — is the FSMS API running?' : 'No bays found'}
              </div>
            ) : filtered.map((bay, idx) => {
              const isEditing = editingId === bay.bay_number;
              const isSaving  = saving === bay.bay_number;
              const isLocked  = lockedIds.has(bay.bay_number);
              const d = isEditing ? editDraft : bay;
              const areaSqm     = isEditing ? area(d)  : (bay.area_sqm ?? 0);
              const monthlyCost = isEditing ? cost(d)  : (bay.monthly_cost ?? 0);

              return (
                <div
                  key={bay.bay_number}
                  className={cn(
                    'grid items-center border-b border-border last:border-0 transition-colors min-w-max',
                    isEditing ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-muted/40',
                    isLocked && !isEditing && 'opacity-70'
                  )}
                  style={{ gridTemplateColumns: GRID }}
                >
                  {/* # */}
                  {cell(<span className="text-xs text-muted-foreground font-mono">{idx + 1}</span>, 'justify-center px-4')}

                  {/* Bay Number */}
                  {cell(<span className="font-semibold text-foreground">{bay.bay_number}</span>)}

                  {/* Workcell */}
                  {cell(isEditing ? editSelect('workcell', ['Arista', 'Keysight', 'Aop', 'Micron']) : <span className="text-foreground">{bay.workcell || '—'}</span>)}

                  {/* Plant */}
                  {cell(isEditing ? editSelect('plant', ['P1', 'P2', 'BK', 'P3']) : <span className="text-foreground">{bay.plant || '—'}</span>)}

                  {/* Floor */}
                  {cell(isEditing ? editSelect('floor', FLOOR_OPTIONS) : <span className="text-foreground">{bay.floor || '—'}</span>)}

                  {/* Status */}
                  {cell(
                    isEditing
                      ? editSelect('status', STATUS_OPTIONS)
                      : <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap', STATUS_BADGE[bay.status] ?? 'bg-muted text-muted-foreground border-border')}>
                          {bay.status || '—'}
                        </span>
                  )}

                  {/* Length */}
                  {cell(isEditing ? editInput('length_m', 'number') : <span className="font-mono text-sm text-foreground">{bay.length_m || '—'}</span>)}

                  {/* Width */}
                  {cell(isEditing ? editInput('width_m', 'number') : <span className="font-mono text-sm text-foreground">{bay.width_m || '—'}</span>)}

                  {/* Area — computed */}
                  {cell(<span className="font-mono text-sm text-foreground">{areaSqm > 0 ? areaSqm.toFixed(1) : '—'}</span>)}

                  {/* Rate/m² */}
                  {cell(isEditing ? editInput('rate_per_sqm', 'number') : <span className="font-mono text-sm text-foreground">{bay.rate_per_sqm > 0 ? bay.rate_per_sqm.toFixed(2) : '—'}</span>)}

                  {/* Monthly cost — computed */}
                  {cell(<span className="font-mono text-sm font-semibold text-foreground">{monthlyCost > 0 ? monthlyCost.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}</span>)}

                  {/* Line Manager */}
                  {cell(isEditing ? editInput('line_manager') : <span className="text-foreground truncate">{bay.line_manager || '—'}</span>)}

                  {/* PIC */}
                  {cell(isEditing ? editInput('pic') : <span className="text-foreground truncate">{bay.pic || '—'}</span>)}

                  {/* Actions */}
                  <div className="px-3 py-3.5 flex items-center gap-1.5">
                    {isEditing ? (
                      <>
                        <button onClick={commitEdit} disabled={isSaving}
                          className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25 transition-colors disabled:opacity-40"
                          title="Save changes">
                          <Check className={cn('h-3.5 w-3.5', isSaving && 'animate-spin')} />
                        </button>
                        <button onClick={cancelEdit}
                          className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                          title="Cancel">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => !isLocked && startEdit(bay)}
                          disabled={isLocked}
                          className={cn(
                            'p-1.5 rounded-lg transition-colors',
                            isLocked ? 'opacity-30 pointer-events-none text-muted-foreground' : 'text-muted-foreground hover:text-primary hover:bg-primary/10'
                          )}
                          title={isLocked ? 'Unlock to edit' : 'Edit row'}>
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => toggleLock(bay.bay_number)}
                          className={cn(
                            'p-1.5 rounded-lg transition-colors',
                            isLocked ? 'text-amber-400 hover:text-amber-500 hover:bg-amber-500/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                          )}
                          title={isLocked ? 'Unlock row' : 'Lock row'}>
                          {isLocked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
