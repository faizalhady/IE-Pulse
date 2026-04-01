import { Input } from '@/components/ui/input';
import { useProductionSummary, useWorkcells } from '@/hooks/useMesData';
import { cn } from '@/lib/utils';
import type { StatusLevel } from '@/types';
import { getStatusLevel } from '@/types';
import { ArrowUpDown, ChevronDown, ChevronUp, RefreshCw, Search, WifiOff } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

// Logo filename map — matches files in /public/workcell logo/
const WORKCELL_LOGOS: Record<string, string> = {
  arista: '/workcell logo/Arista.png',
  keysight: '/workcell logo/keyisght.png',  // note: typo in filename preserved
  aop: '/workcell logo/aop.png',
  micron: '/workcell logo/micron.png',
};

// Workcell badge — real logo if available, fallback to styled initials
function WorkcellBadge({ id, name, status }: { id: string; name: string; status: StatusLevel }) {
  const [imgError, setImgError] = useState(false);
  const logoSrc = WORKCELL_LOGOS[id];
  const colors: Record<StatusLevel, { bg: string; text: string; ring: string }> = {
    optimal: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', ring: 'ring-emerald-500/30' },
    warning: { bg: 'bg-amber-500/15', text: 'text-amber-400', ring: 'ring-amber-500/30' },
    critical: { bg: 'bg-red-500/15', text: 'text-red-400', ring: 'ring-red-500/30' },
    idle: { bg: 'bg-muted', text: 'text-muted-foreground', ring: 'ring-border' },
  };
  const c = colors[status];

  if (logoSrc && !imgError) {
    return (
      <div className={cn('w-20 h-11 rounded-xl overflow-hidden ring-1 flex-shrink-0 flex items-center justify-center', c.ring)} style={{ background: '#ffffff' }}>
        <img
          src={logoSrc}
          alt={name}
          onError={() => setImgError(true)}
          className="w-full h-full object-contain p-1.5"
        />
      </div>
    );
  }

  // Fallback — styled initials badge
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <div className={cn(
      'w-20 h-11 rounded-xl flex items-center justify-center text-xs font-black ring-1 flex-shrink-0',
      c.bg, c.text, c.ring
    )}>
      {initials}
    </div>
  );
}

type SortKey = 'name' | 'productivity' | 'bays' | 'output' | 'plant';
type SortDir = 'asc' | 'desc';

interface WorkcellRow {
  id: string;
  customer_id: number;
  name: string;
  plant: string;
  bayCount: number;
  activeBays: number;
  avgProductivity: number;
  totalOutput: number;
  latestActivity: string;
  status: StatusLevel;
  form: StatusLevel[];
}

const STATUS_BADGE: Record<StatusLevel, string> = {
  optimal: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  warning: 'bg-amber-500/15  text-amber-400  border-amber-500/30',
  critical: 'bg-red-500/15    text-red-400    border-red-500/30',
  idle: 'bg-muted         text-muted-foreground border-border',
};
const STATUS_LABEL: Record<StatusLevel, string> = {
  optimal: 'On Track', warning: 'Warning', critical: 'Critical', idle: 'Idle',
};

export default function WorkcellsTable() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('productivity');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [plantFilter, setPlantFilter] = useState(() => searchParams.get('plant') ?? 'All');

  // Sync filter if URL param changes (e.g. back/forward navigation)
  useEffect(() => {
    const p = searchParams.get('plant');
    if (p) setPlantFilter(p);
  }, [searchParams]);

  // ── API data ───────────────────────────────────────────────────────────────
  // Production summary already contains workcell + bay + output — use it as
  // the single source of truth. No separate bays endpoint needed.
  // ── API data — no polling, fetch once only (interval = 0 disables timer) ──
  const { data: apiWorkcells, loading: wcLoading, error: wcError, refetch } = useWorkcells();
  const { data: apiProduction, loading: prodLoading } = useProductionSummary();

  const loading = wcLoading || prodLoading;

  // ── Build display rows from API data ───────────────────────────────────────
  // Only render workcells that have at least one production/bay row
  const rows = useMemo<WorkcellRow[]>(() => {
    if (!apiProduction) return [];

    // Use production summary as source of truth — derive unique workcells from it
    const wcMap = new Map<number, typeof apiProduction[0][]>();
    for (const row of apiProduction) {
      if (!wcMap.has(row.customer_id)) wcMap.set(row.customer_id, []);
      wcMap.get(row.customer_id)!.push(row);
    }

    return Array.from(wcMap.entries()).map(([customer_id, wcProd]) => {
      const wc = apiWorkcells?.find(w => w.customer_id === customer_id);
      const workcell_name = wcProd[0].workcell_name;
      const bayCount = wcProd.length;
      const totalOutput = wcProd.reduce((s, p) => s + (p.total_output ?? 0), 0);
      const activeBays = wcProd.filter(p => (p.total_output ?? 0) > 0).length;

      const perBayProd = wcProd.map(p => {
        if (!p.total_steps || p.total_steps === 0) return 0;
        return Math.min(100, Math.round((p.total_output / p.total_steps) * 100));
      });
      const avgProductivity = perBayProd.length
        ? parseFloat((perBayProd.reduce((s, v) => s + v, 0) / perBayProd.length).toFixed(1))
        : 0;

      // Cap form badges at 5
      const form: StatusLevel[] = perBayProd.slice(0, 5).map(pct => getStatusLevel(pct));

      const latestActivity = wcProd
        .map(p => p.latest_activity)
        .filter(Boolean)
        .sort()
        .at(-1) ?? '—';

      const plant = (wcProd[0] as any).plant ?? 'P1';

      return {
        id: workcell_name,
        customer_id,
        name: workcell_name,
        plant,
        bayCount,
        activeBays,
        avgProductivity,
        totalOutput,
        latestActivity,
        status: getStatusLevel(avgProductivity),
        form,
      };
    });
  }, [apiWorkcells, apiProduction]);

  // Fixed plant filter options matching the API plant codes
  const PLANT_OPTIONS = [
    { label: 'All', value: 'All' },
    { label: 'P1', value: 'P1' },
    { label: 'P2', value: 'P2' },
    { label: 'Batu Kawan', value: 'BK' },
    { label: 'Chuping', value: 'P3' },
  ];

  const filtered = useMemo(() => {
    let list = [...rows];
    if (search) list = list.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));
    if (plantFilter !== 'All') list = list.filter(r => r.plant === plantFilter || r.plant?.startsWith(plantFilter));
    list.sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1;
      switch (sortKey) {
        case 'name': return mul * a.name.localeCompare(b.name);
        case 'productivity': return mul * (a.avgProductivity - b.avgProductivity);
        case 'bays': return mul * (a.bayCount - b.bayCount);
        case 'output': return mul * (a.totalOutput - b.totalOutput);
        case 'plant': return mul * a.plant.localeCompare(b.plant);
        default: return 0;
      }
    });
    return list;
  }, [rows, search, sortDir, sortKey, plantFilter]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-30" />;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 ml-1" />
      : <ChevronDown className="w-3 h-3 ml-1" />;
  };

  const totalActive = rows.filter(r => r.status !== 'idle').length;
  const avgAll = rows.length ? (rows.reduce((s, r) => s + r.avgProductivity, 0) / rows.length).toFixed(1) : '0';
  const totalOutput = rows.reduce((s, r) => s + r.totalOutput, 0);

  return (
    <div className="space-y-0">

      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-background border-b border-border px-6 mb-6">
        <div className="pt-4 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Workcells</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {loading ? 'Loading live data…' : wcError ? 'Using cached data — API unreachable' : 'List of workcells with real-time status and productivity'}
              </p>
            </div>
            <div className="flex items-center gap-4">
              {wcError && (
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
              <div className="hidden md:flex items-center gap-6 text-sm font-mono">
                <span className="text-muted-foreground">Active <span className="text-foreground font-semibold">{totalActive}/{rows.length}</span></span>
                <span className="text-muted-foreground">Avg Prod. <span className="text-foreground font-semibold">{avgAll}%</span></span>
                <span className="text-muted-foreground">Output <span className="text-foreground font-semibold">{totalOutput.toLocaleString()}</span></span>
              </div>
            </div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3 pb-3">
          <div className="relative min-w-[200px] max-w-xs flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search workcells…"
              className="pl-8 h-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {PLANT_OPTIONS.map(p => (
              <button
                key={p.value}
                onClick={() => setPlantFilter(p.value)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                  plantFilter === p.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'text-muted-foreground border-border hover:text-foreground hover:border-foreground/30'
                )}
              >{p.label}</button>
            ))}
          </div>
          <span className="text-xs text-muted-foreground ml-auto">{filtered.length} workcells</span>
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && rows.length === 0 && (
        <div className="px-6 pb-8 space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      )}

      {/* Table */}
      {(!loading || rows.length > 0) && (
        <div className="px-6 pb-8">
          <div className="rounded-xl border border-border overflow-hidden">

            {/* Header */}
            <div
              className="grid bg-muted/50 border-b border-border text-xs text-muted-foreground font-medium uppercase tracking-wider"
              style={{ gridTemplateColumns: '2.5rem 1fr 5rem 5rem 7rem 7rem 7rem 7rem' }}
            >
              <div className="px-4 py-3 text-center">#</div>
              <button onClick={() => toggleSort('name')} className="px-4 py-3 text-left flex items-center hover:text-foreground transition-colors">
                Workcell <SortIcon k="name" />
              </button>
              <button onClick={() => toggleSort('plant')} className="px-3 py-3 flex items-center hover:text-foreground transition-colors">
                Plant <SortIcon k="plant" />
              </button>
              <button onClick={() => toggleSort('bays')} className="px-3 py-3 text-center flex items-center justify-center hover:text-foreground transition-colors">
                Bays <SortIcon k="bays" />
              </button>
              <button onClick={() => toggleSort('productivity')} className="px-3 py-3 text-center flex items-center justify-center hover:text-foreground transition-colors">
                Productivity <SortIcon k="productivity" />
              </button>
              <div className="px-3 py-3 text-left">Bay Status</div>
              <button onClick={() => toggleSort('output')} className="px-3 py-3 text-center flex items-center justify-center hover:text-foreground transition-colors">
                Output <SortIcon k="output" />
              </button>
              <div className="px-3 py-3 text-center">Status</div>
            </div>

            {/* Rows */}
            {filtered.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">No workcells found</div>
            ) : filtered.map((row, idx) => {
              const prodColor = row.status === 'optimal' ? 'text-emerald-500' : row.status === 'warning' ? 'text-amber-400' : row.status === 'critical' ? 'text-red-400' : 'text-muted-foreground';
              const barColor = row.status === 'optimal' ? 'bg-emerald-500' : row.status === 'warning' ? 'bg-amber-400' : row.status === 'critical' ? 'bg-red-500' : 'bg-muted';
              return (
                <button
                  key={row.id}
                  onClick={() => navigate(`/workcell/${row.id}`)}
                  className="w-full grid items-center text-sm border-b border-border last:border-0 hover:bg-muted/40 transition-colors text-left group"
                  style={{ gridTemplateColumns: '2.5rem 1fr 5rem 5rem 7rem 7rem 7rem 7rem' }}
                >
                  {/* # */}
                  <div className="px-4 py-4 text-center text-xs text-muted-foreground font-mono">{idx + 1}</div>

                  {/* Workcell name + badge */}
                  <div className="px-4 py-4 flex items-center gap-3">
                    <WorkcellBadge id={row.id.toLowerCase()} name={row.name} status={row.status} />
                    <div>
                      <p className="font-semibold text-foreground group-hover:text-primary transition-colors">{row.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {row.bayCount} bays · {row.latestActivity !== '—' ? `Last: ${row.latestActivity.slice(11, 16)}` : 'No activity'}
                      </p>
                    </div>
                  </div>

                  {/* Plant */}
                  <div className="px-3 py-4">
                    <span className="text-xs font-medium text-foreground">{row.plant}</span>
                  </div>

                  {/* Bays */}
                  <div className="px-3 py-4 text-center">
                    <span className="font-mono font-semibold text-foreground">{row.activeBays}</span>
                    <span className="text-muted-foreground text-xs">/{row.bayCount}</span>
                  </div>

                  {/* Productivity */}
                  <div className="px-3 py-4 text-center">
                    <span className={cn('text-xl font-mono font-bold', prodColor)}>{row.avgProductivity}%</span>
                    <div className="mt-1 h-1 rounded-full bg-muted/50 overflow-hidden w-full">
                      <div className={cn('h-full rounded-full', barColor)} style={{ width: `${row.avgProductivity}%` }} />
                    </div>
                  </div>

                  {/* Bay status pills */}
                  <div className="px-3 py-4 flex items-center gap-0.5">
                    {row.form.map((s, i) => (
                      <span
                        key={i}
                        className={cn(
                          'w-5 h-5 rounded-sm text-[9px] font-black flex items-center justify-center flex-shrink-0',
                          s === 'optimal' ? 'bg-emerald-500 text-emerald-950' :
                            s === 'warning' ? 'bg-amber-400 text-amber-950' :
                              s === 'critical' ? 'bg-red-500 text-white' : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {s === 'optimal' ? 'G' : s === 'warning' ? 'W' : s === 'critical' ? 'B' : '–'}
                      </span>
                    ))}
                  </div>

                  {/* Output */}
                  <div className="px-3 py-4 text-center">
                    <span className="font-mono font-semibold text-foreground">
                      {row.totalOutput.toLocaleString()}
                    </span>
                    <p className="text-[10px] text-muted-foreground mt-0.5">units</p>
                  </div>

                  {/* Status badge */}
                  <div className="px-3 py-4 flex justify-center">
                    <span className={cn('text-[10px] font-semibold px-2.5 py-1 rounded-full border', STATUS_BADGE[row.status])}>
                      {STATUS_LABEL[row.status]}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
