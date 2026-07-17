/**
 * IncompletionReport.tsx
 * ──────────────────────
 * Data-incompletion report for the Cycle Time module. Lists every workcell
 * (= customer) with its completion % from the IEDB CustomerStatus report.
 * Click a row → detail page listing that workcell's assemblies with no data.
 *
 * Route: /cycle-time/incompletion
 */

import { SortHeader } from '@/components/shared/SortHeader';
import { useCycleTimeCoverage, useCycleTimeCustomers, useCycleTimeCustomerStatus } from '@/hooks/cycle_time/useCycleTimeData';
import { useSortable } from '@/hooks/shared/useSortable';
import { matchCustomerStatus } from '@/lib/cycle_time/cycleTimeApi';
import { getWorkcellLogo, getWorkcellLogoBg } from '@/lib/ole/oleConstants';
import { cn } from '@/lib/utils';
import { ChevronRight, Loader2 } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

const GRID = '2.5rem minmax(11rem,1fr) 8.5rem 8.5rem 8rem 3rem';

type SortKey = 'customer' | 'complete' | 'oldComplete' | 'noData';
interface ReportRow {
  customer: string;
  division: string;
  complete: number | null;
  oldComplete: number | null;
  noData: number | null;
  withData: number;
}
const COLUMNS: { label: string; key?: SortKey }[] = [
  { label: '#' },
  { label: 'Workcell', key: 'customer' },
  { label: 'Completion % (API)', key: 'complete' },
  { label: 'Completion % (old)', key: 'oldComplete' },
  { label: 'No data', key: 'noData' },
  { label: '' },
];
const ACCESSORS: Record<SortKey, (r: ReportRow) => string | number | null> = {
  customer: (r) => r.customer,
  complete: (r) => r.complete,
  oldComplete: (r) => r.oldComplete,
  noData: (r) => r.noData,
};

/** Completion % → color (higher is better). */
function completionColor(pct: number | null | undefined): string {
  if (pct == null) return 'text-muted-foreground';
  if (pct >= 90) return 'text-emerald-500';
  if (pct >= 80) return 'text-amber-500';
  return 'text-red-500';
}

export default function IncompletionReport() {
  const navigate = useNavigate();
  const { data: customers = [], isFetching: custFetching } = useCycleTimeCustomers();
  const { data: customerStatus = [], isLoading: statusLoading, isError: statusError } = useCycleTimeCustomerStatus();
  const { data: coverage = [] } = useCycleTimeCoverage();

  // Old-way with-data count = distinct assemblies present in raw.parquet
  // (from /coverage), keyed by customer.
  const covByCustomer = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of coverage) m.set(c.customer, c.assemblies);
    return m;
  }, [coverage]);

  // One row per workcell that has data. Default sort = worst-completion first
  // (the point of this page — surface the workcells that need attention).
  const rows = useMemo<ReportRow[]>(() => {
    return customers
      .map((c) => {
        const st = matchCustomerStatus(customerStatus, c.customer);
        // Old-way completion: with-data from raw.parquet ÷ catalogue total from
        // config (c.assembly_count) — exactly the pre-API calculation.
        const oldWith = covByCustomer.get(c.customer) ?? 0;
        const oldTotal = c.assembly_count;
        const oldComplete = oldTotal > 0 ? Math.min(100, Math.round((oldWith / oldTotal) * 100)) : null;
        return {
          customer: c.customer,
          division: c.division,
          complete: st?.Complete ?? null,
          oldComplete,
          noData: st ? Math.max(0, st.NoOfAssemblies - st.NoOfAssembliesWithData) : null,
          withData: st?.NoOfAssembliesWithData ?? 0,
        };
      })
      .filter((r) => r.withData > 0);
  }, [customers, customerStatus, covByCustomer]);

  const { sorted, sort, toggle } = useSortable(rows, ACCESSORS, { key: 'complete', dir: 'asc' });

  const loading = (custFetching && customers.length === 0) || statusLoading;

  return (
    <div className="p-5">
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-foreground">Incompletion Report</h1>
        <p className="text-xs text-muted-foreground">
          Cycle-time data completeness per workcell. Click a workcell to see its assemblies with no data.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* header */}
        <div
          className="grid bg-muted/50 text-xs text-muted-foreground uppercase tracking-wider"
          style={{ gridTemplateColumns: GRID }}
        >
          {COLUMNS.map((col, i) =>
            col.key ? (
              <SortHeader
                key={i}
                label={col.label}
                active={sort?.key === col.key}
                dir={sort?.dir}
                onClick={() => toggle(col.key!)}
                className="px-3"
              />
            ) : (
              <div key={i} className="px-3 py-2.5">{col.label}</div>
            ),
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : statusError ? (
          <div className="flex items-center justify-center h-40 text-sm text-red-500">
            Can’t fetch data from IEDB.
          </div>
        ) : (
          sorted.map((r, i) => {
            const logo = getWorkcellLogo(r.customer);
            return (
              <button
                key={r.customer}
                onClick={() => navigate(`/cycle-time/incompletion/${encodeURIComponent(r.customer)}`)}
                className="grid w-full items-center text-left h-14 hover:bg-muted/40 border-b border-border last:border-0 group"
                style={{ gridTemplateColumns: GRID }}
              >
                <div className="px-3 text-xs text-muted-foreground tabular-nums">{i + 1}</div>
                <div className="px-3 flex items-center gap-3 min-w-0">
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
                    <p className="text-[13px] xl:text-sm font-semibold text-foreground truncate">{r.customer}</p>
                    <p className="text-[10px] xl:text-[11px] text-muted-foreground truncate">{r.division}</p>
                  </div>
                </div>
                <div className="px-3">
                  <span className={cn('text-sm ct-num font-bold tabular-nums', completionColor(r.complete))}>
                    {r.complete == null ? '—' : `${r.complete}%`}
                  </span>
                </div>
                <div className="px-3">
                  <span className={cn('text-sm ct-num font-semibold tabular-nums', completionColor(r.oldComplete))}>
                    {r.oldComplete == null ? '—' : `${r.oldComplete}%`}
                  </span>
                </div>
                <div className="px-3">
                  <span className="text-sm ct-num font-semibold tabular-nums text-foreground">
                    {r.noData == null ? '—' : r.noData.toLocaleString()}
                  </span>
                </div>
                <div className="px-1 flex justify-center">
                  <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
