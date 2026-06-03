/**
 * CycleTimeWorkcells.tsx
 * ───────────────────────
 * "League table" of cycle-time workcells (= customers). Logo + name, then the
 * one stat that matters here: how much of each customer's assembly catalogue
 * actually has cycle-time data (with data / missing / total + coverage), plus
 * freshness. The richer per-line/process breakdown lives on the dedicated
 * workcell page.
 *
 * Route: /cycle-time/workcells
 *
 * Data: catalogue totals from /customers, with-data counts + freshness from
 * /coverage (a single request — no per-customer round trips). Workcells with
 * zero data are hidden; a count of them is shown in the header so they're not
 * forgotten. Sorted A–Z.
 */

import { useCycleTimeCoverage, useCycleTimeCustomers } from '@/hooks/cycle_time/useCycleTimeData';
import { getWorkcellLogo, getWorkcellLogoBg } from '@/lib/ole/oleConstants';
import { cn } from '@/lib/utils';
import { ChevronRight, Loader2 } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

const GRID = '2.5rem minmax(15rem,1fr) 22rem 8rem 1.5rem';
const HEADERS = ['#', 'Workcell', 'Assemblies (with data / total)', 'Updated', ''];

/** Data-coverage % (assemblies with cycle-time data ÷ catalogue total). */
function coverageColor(pct: number | null): string {
  if (pct == null) return 'text-muted-foreground';
  if (pct >= 90) return 'text-emerald-400';
  if (pct >= 50) return 'text-amber-400';
  return 'text-red-400';
}
function coverageBar(pct: number | null): string {
  if (pct == null) return 'bg-muted-foreground/30';
  if (pct >= 90) return 'bg-emerald-500';
  if (pct >= 50) return 'bg-amber-400';
  return 'bg-red-500';
}

interface Row {
  customer: string;
  division: string;
  total: number;
  withData: number;
  missing: number;
  cov: number | null;
  updated: string | null;
}

export default function CycleTimeWorkcells() {
  const navigate = useNavigate();
  const { data: customers = [], isFetching: custFetching } = useCycleTimeCustomers();
  const { data: coverage = [], isFetching: covFetching } = useCycleTimeCoverage();

  const covByCustomer = useMemo(() => {
    const m = new Map<string, { assemblies: number; updated_on: string | null }>();
    for (const c of coverage) m.set(c.customer, { assemblies: c.assemblies, updated_on: c.updated_on });
    return m;
  }, [coverage]);

  // Build rows, then keep only those that actually have data, sorted A–Z.
  const { visible } = useMemo(() => {
    const rows: Row[] = customers.map((c) => {
      const cov = covByCustomer.get(c.customer);
      const withData = cov?.assemblies ?? 0;
      const total = c.assembly_count;
      return {
        customer: c.customer,
        division: c.division,
        total,
        withData,
        missing: Math.max(0, total - withData),
        cov: total > 0 ? Math.min(100, Math.round((withData / total) * 100)) : null,
        updated: cov?.updated_on ?? null,
      };
    });
    const visible = rows
      .filter((r) => r.withData > 0)
      .sort((a, b) => a.customer.localeCompare(b.customer));
    const hiddenNames = rows
      .filter((r) => r.withData === 0)
      .map((r) => r.customer)
      .sort((a, b) => a.localeCompare(b));
    return { visible, hiddenNames };
  }, [customers, covByCustomer]);

  const loading = (custFetching && customers.length === 0) || (covFetching && coverage.length === 0);

  return (
    <div className="p-5">
        {/* league table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div
            className="grid bg-muted/50 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold border-b border-border"
            style={{ gridTemplateColumns: GRID }}
          >
            {HEADERS.map((h, i) => (
              <div key={i} className={cn('px-2 py-2.5', (i === 2 || i === 3) && 'text-right')}>{h}</div>
            ))}
          </div>

          {loading ? (
            <div className="py-16 flex items-center justify-center text-muted-foreground text-sm gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading workcells…
            </div>
          ) : visible.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">No workcells with cycle-time data.</div>
          ) : (
            visible.map((r, idx) => {
              const logo = getWorkcellLogo(r.customer);
              const updated = r.updated
                ? new Date(r.updated).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                : '—';
              return (
                <button
                  key={r.customer}
                  onClick={() => navigate(`/cycle-time/wc/${encodeURIComponent(r.customer)}`)}
                  className="group grid items-center w-full text-left border-b border-border last:border-0 hover:bg-muted/30 transition-colors relative"
                  style={{ gridTemplateColumns: GRID, height: 60 }}
                >
                  {/* position */}
                  <div className="px-2">
                    <span className="text-sm font-mono font-bold text-muted-foreground tabular-nums">{idx + 1}</span>
                  </div>

                  {/* logo + name */}
                  <div className="px-2 flex items-center gap-3 min-w-0">
                    {logo ? (
                      <div
                        className="w-24 h-9 rounded border border-border flex items-center justify-center overflow-hidden flex-shrink-0"
                        style={{ backgroundColor: getWorkcellLogoBg(r.customer) ?? '#ffffff' }}
                      >
                        <img src={logo} alt={r.customer} className="w-full h-full object-contain p-0.5" />
                      </div>
                    ) : (
                      <div className="w-24 h-9 rounded border border-border bg-muted flex items-center justify-center flex-shrink-0">
                        <span className="text-[9px] font-bold text-muted-foreground">{r.customer.slice(0, 3).toUpperCase()}</span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-foreground truncate">{r.customer}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{r.division}</p>
                    </div>
                  </div>

                  {/* assemblies — coverage: with data / missing / total + bar */}
                  <div className="px-3">
                    <div className="flex items-baseline gap-3 leading-none">
                      <NumLabel n={r.withData} label="with data" tone={coverageColor(r.cov)} bold />
                      <span className="text-border">/</span>
                      <NumLabel n={r.total} label="total" tone="text-foreground" />
                      <span className="text-[10px] text-muted-foreground">({r.missing.toLocaleString()} missing)</span>
                      <span className={cn('ml-auto text-xs font-mono font-semibold tabular-nums', coverageColor(r.cov))}>
                        {r.cov == null ? '—' : `${r.cov}%`}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-muted/40 overflow-hidden">
                      <div className={cn('h-full rounded-full transition-all', coverageBar(r.cov))} style={{ width: `${r.cov ?? 0}%` }} />
                    </div>
                  </div>

                  {/* updated */}
                  <div className="px-2 text-right text-[11px] font-mono text-muted-foreground tabular-nums">
                    {updated}
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
          Sorted alphabetically. <span className="font-medium text-foreground/80">Assemblies</span> shows how many
          have cycle-time data vs the customer's total catalogue — the bar and % are that coverage (red &lt;50%, amber
          &lt;90%, green ≥90%). Workcells with no data yet are hidden. Click a workcell to open its
          full profile.
        </p>
    </div>
  );
}

// ─── Inline number + tiny label ───────────────────────────────────────────────
function NumLabel({ n, label, tone, bold }: { n: number; label: string; tone: string; bold?: boolean }) {
  return (
    <span className="flex items-baseline gap-1">
      <span className={cn('font-mono tabular-nums', bold ? 'text-sm font-bold' : 'text-sm font-semibold', tone)}>
        {n.toLocaleString()}
      </span>
      <span className="text-[9px] text-muted-foreground">{label}</span>
    </span>
  );
}
