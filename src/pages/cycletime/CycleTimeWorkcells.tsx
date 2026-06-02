/**
 * CycleTimeWorkcells.tsx
 * ───────────────────────
 * "League table" of cycle-time workcells (= customers). Logo + name on the
 * left, the high-level cycle-time stats on the right (assemblies, lines,
 * processes, builds, avg FPY, freshness). Ranked by portfolio size
 * (assemblies). Click a row → /cycle-time/wc/:customer (dedicated profile).
 *
 * Route: /cycle-time/workcells
 *
 * Base list comes from /customers; the richer per-customer columns are
 * enriched in parallel from /profile (summary only — small payload).
 */

import { Input } from '@/components/ui/input';
import { getWorkcellLogo } from '@/lib/ole/oleConstants';
import { cn } from '@/lib/utils';
import { cycleTimeApi } from '@/lib/cycle_time/cycleTimeApi';
import { ctKeys, useCycleTimeCustomers } from '@/hooks/cycle_time/useCycleTimeData';
import { useQueries } from '@tanstack/react-query';
import { ChevronRight, Clock, Loader2, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const GRID = '2.5rem minmax(10rem,1fr) 8rem 4rem 5rem 6rem 6.5rem 7rem 1.5rem';
const HEADERS = ['#', 'Workcell', 'Assemblies', 'Lines', 'Proc', 'Builds', 'Avg FPY', 'Updated', ''];

/** FPY (0..1 or already-percent) → display % + quality color. */
function fpyPct(v: number | null | undefined): number | null {
  if (v == null || Number.isNaN(v)) return null;
  return v <= 1 ? v * 100 : v;
}
function fpyColor(pct: number | null): string {
  if (pct == null) return 'text-muted-foreground';
  if (pct >= 95) return 'text-emerald-400';
  if (pct >= 90) return 'text-amber-400';
  return 'text-red-400';
}
function fpyBar(pct: number | null): string {
  if (pct == null) return 'bg-muted-foreground/30';
  if (pct >= 95) return 'bg-emerald-500';
  if (pct >= 90) return 'bg-amber-400';
  return 'bg-red-500';
}

export default function CycleTimeWorkcells() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const { data: customers = [], isFetching, refetch } = useCycleTimeCustomers();

  // Enrich each customer with its profile, in parallel. Same query key as
  // useCycleTimeProfile so the drill-in profile page reuses this cache.
  const profileQs = useQueries({
    queries: customers.map(c => ({
      queryKey: ctKeys.profile(c.customer),
      queryFn: () => cycleTimeApi.profile.get(c.customer),
      staleTime: 5 * 60_000,
    })),
  });

  const statsByCustomer = useMemo(() => {
    const map = new Map<string, { lines: number; processes: number; builds: number; avgFpy: number | null; updated: string | null; loading: boolean }>();
    customers.forEach((c, i) => {
      const q = profileQs[i];
      const s = q?.data?.summary;
      map.set(c.customer, {
        lines: s?.lines ?? 0,
        processes: s?.processes ?? 0,
        builds: s?.builds ?? 0,
        avgFpy: s?.avg_fpy ?? null,
        updated: s?.updated_on ?? null,
        loading: Boolean(q?.isLoading),
      });
    });
    return map;
  }, [customers, profileQs]);

  const maxAssemblies = useMemo(
    () => customers.reduce((m, c) => Math.max(m, c.assembly_count), 0) || 1,
    [customers],
  );

  const ranked = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = term
      ? customers.filter(c => c.customer.toLowerCase().includes(term) || c.division.toLowerCase().includes(term))
      : customers;
    return [...filtered].sort((a, b) => b.assembly_count - a.assembly_count || a.customer.localeCompare(b.customer));
  }, [customers, search]);

  return (
    <div className="relative">
      {/* ─── Sticky header ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border px-6">
        <div className="pt-4 pb-4 flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
              <Clock className="h-5 w-5 text-emerald-500" />
              Cycle Time Workcells
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              League standings · ranked by portfolio size · {customers.length} workcells
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Loader2 className={cn('h-3.5 w-3.5', isFetching ? 'animate-spin' : 'hidden')} />
            Refresh
          </button>
        </div>
      </div>

      <div className="p-5">
        {/* search */}
        <div className="relative w-[280px] mb-4">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search workcell or division…"
            className="pl-8 h-9"
          />
        </div>

        {/* league table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div
            className="grid bg-muted/50 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold border-b border-border"
            style={{ gridTemplateColumns: GRID }}
          >
            {HEADERS.map((h, i) => (
              <div key={i} className={cn('px-2 py-2.5', i >= 2 && i <= 7 && 'text-right')}>{h}</div>
            ))}
          </div>

          {isFetching && customers.length === 0 ? (
            <div className="py-16 flex items-center justify-center text-muted-foreground text-sm gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading workcells…
            </div>
          ) : ranked.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">No workcells match the search.</div>
          ) : (
            ranked.map((c, idx) => {
              const stats = statsByCustomer.get(c.customer);
              const logo = getWorkcellLogo(c.customer);
              const pos = idx + 1;
              const pct = fpyPct(stats?.avgFpy);
              const asmWidth = Math.round((c.assembly_count / maxAssemblies) * 100);
              const updated = stats?.updated
                ? new Date(stats.updated).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                : '—';
              return (
                <button
                  key={c.customer}
                  onClick={() => navigate(`/cycle-time/wc/${encodeURIComponent(c.customer)}`)}
                  className="group grid items-center w-full text-left border-b border-border last:border-0 hover:bg-muted/30 transition-colors relative"
                  style={{ gridTemplateColumns: GRID, height: 60 }}
                >
                  {/* FPY quality accent */}
                  <span className={cn('absolute left-0 top-0 bottom-0 w-0.5', fpyBar(pct))} />

                  {/* position */}
                  <div className="px-2">
                    <span className="text-sm font-mono font-bold text-muted-foreground tabular-nums">{pos}</span>
                  </div>

                  {/* club: logo + name */}
                  <div className="px-2 flex items-center gap-3 min-w-0">
                    {logo ? (
                      <div className="w-12 h-7 rounded border border-border bg-white flex items-center justify-center overflow-hidden flex-shrink-0">
                        <img src={logo} alt={c.customer} className="w-full h-full object-contain p-0.5" />
                      </div>
                    ) : (
                      <div className="w-12 h-7 rounded border border-border bg-muted flex items-center justify-center flex-shrink-0">
                        <span className="text-[9px] font-bold text-muted-foreground">{c.customer.slice(0, 3).toUpperCase()}</span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{c.customer}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{c.division}</p>
                    </div>
                  </div>

                  {/* assemblies — headline stat with bar */}
                  <div className="px-2">
                    <p className="text-right text-sm font-mono font-black text-foreground tabular-nums leading-none">
                      {c.assembly_count.toLocaleString()}
                    </p>
                    <div className="mt-1 h-1 rounded-full bg-muted/40 overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${asmWidth}%` }} />
                    </div>
                  </div>

                  {/* lines */}
                  <EnrichedCell loading={stats?.loading} value={stats?.lines} />
                  {/* processes */}
                  <EnrichedCell loading={stats?.loading} value={stats?.processes} />
                  {/* builds */}
                  <EnrichedCell loading={stats?.loading} value={stats?.builds} format={v => v.toLocaleString()} />

                  {/* avg FPY */}
                  <div className="px-2 text-right">
                    {stats?.loading ? (
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/50 ml-auto" />
                    ) : (
                      <span className={cn('text-[11px] font-mono font-semibold tabular-nums', fpyColor(pct))}>
                        {pct == null ? '—' : `${pct.toFixed(1)}%`}
                      </span>
                    )}
                  </div>

                  {/* updated */}
                  <div className="px-2 text-right text-[10px] font-mono text-muted-foreground tabular-nums">
                    {stats?.loading ? '…' : updated}
                  </div>

                  {/* chevron */}
                  <div className="px-1 flex justify-center">
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </button>
              );
            })
          )}
        </div>

        <p className="text-[10px] text-muted-foreground mt-3">
          Ranked by number of assemblies. The coloured bar at the left of each row reflects average first-pass
          yield (FPY). Click a workcell to open its full cycle-time profile.
        </p>
      </div>
    </div>
  );
}

// ─── Enriched (profile-derived) numeric cell ────────────────────────────────────
function EnrichedCell({ loading, value, format }: {
  loading?: boolean; value?: number; format?: (v: number) => string;
}) {
  return (
    <div className="px-2 text-right text-[11px] font-mono text-muted-foreground tabular-nums">
      {loading
        ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/50 ml-auto" />
        : value == null ? '—' : (format ? format(value) : value)}
    </div>
  );
}
