/**
 * CycleTimeWorkcell.tsx
 * ──────────────────────
 * Dedicated profile page for one cycle-time workcell (= customer), reached by
 * picking a row in the Workcells league table.
 *
 * Route: /cycle-time/wc/:customer
 *
 * Profile header (logo + name + division) + headline summary cards, then the
 * existing CycleTimeBreakdown (counts · by-line · longest builds). "Open data
 * table" deep-links to the Overview scoped to this customer.
 */

import { getWorkcellLogo } from '@/lib/ole/oleConstants';
import { cn } from '@/lib/utils';
import { useCycleTimeProfile } from '@/hooks/cycle_time/useCycleTimeData';
import CycleTimeBreakdown from './CycleTimeBreakdown';
import { ArrowLeft, Loader2, Table2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

function fpyPct(v: number | null | undefined): number | null {
  if (v == null || Number.isNaN(v)) return null;
  return v <= 1 ? v * 100 : v;
}

export default function CycleTimeWorkcell() {
  const navigate = useNavigate();
  const { customer = '' } = useParams();
  const { data, isFetching } = useCycleTimeProfile(customer);

  const logo = getWorkcellLogo(customer);
  const summary = data?.summary;
  const pct = fpyPct(summary?.avg_fpy);
  const bottleneck = summary?.bottleneck;

  const openTable = () => navigate(`/cycle-time?customer=${encodeURIComponent(customer)}`);

  return (
    <div className="flex h-full flex-col">
      {/* ─── Profile header ────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-6 pt-2.5">
          <button
            onClick={() => navigate('/cycle-time/workcells')}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3 w-3" /> All workcells
          </button>
        </div>
        <div className="px-6 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {logo ? (
              <div className="w-14 h-10 rounded-md border border-border bg-white flex items-center justify-center overflow-hidden flex-shrink-0">
                <img src={logo} alt={customer} className="w-full h-full object-contain p-1" />
              </div>
            ) : (
              <div className="w-14 h-10 rounded-md border border-border bg-muted flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-muted-foreground">{customer.slice(0, 3).toUpperCase()}</span>
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-base font-bold text-foreground truncate">{customer}</h1>
              <p className="text-[10px] text-muted-foreground truncate">
                {summary ? `Cycle-time profile · ${summary.assemblies.toLocaleString()} assemblies · ${summary.lines} lines` : 'Cycle-time profile'}
              </p>
            </div>
          </div>

          <button
            onClick={openTable}
            className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 transition-colors flex-shrink-0"
          >
            <Table2 className="h-3.5 w-3.5" /> Open data table
          </button>
        </div>
      </div>

      {/* ─── Headline summary cards ────────────────────────────────────── */}
      <div className="px-6 pt-5">
        <div className="grid grid-cols-4 gap-4">
          <SummaryCard label="Builds" value={isFetching && !summary ? null : summary?.builds.toLocaleString() ?? '—'} />
          <SummaryCard label="Revisions" value={isFetching && !summary ? null : summary?.revisions.toLocaleString() ?? '—'} />
          <SummaryCard
            label="Avg FPY"
            value={isFetching && !summary ? null : pct == null ? '—' : `${pct.toFixed(1)}%`}
            valueClass={pct == null ? undefined : pct >= 95 ? 'text-emerald-400' : pct >= 90 ? 'text-amber-400' : 'text-red-400'}
          />
          <SummaryCard
            label="Top bottleneck"
            value={isFetching && !summary ? null : bottleneck?.alias ?? 'None'}
            sub={bottleneck ? `${bottleneck.pct.toFixed(0)}% of builds` : undefined}
            small
          />
        </div>
      </div>

      {/* ─── Breakdown (counts · by-line · longest builds) ─────────────── */}
      <div className="flex-1 min-h-0">
        <CycleTimeBreakdown
          customer={customer}
          onOpenAssembly={(assembly, line) =>
            navigate(`/cycle-time?customer=${encodeURIComponent(customer)}&assembly=${encodeURIComponent(assembly)}&sub_workcenter=${encodeURIComponent(line)}`)
          }
        />
      </div>
    </div>
  );
}

// ─── Summary card ───────────────────────────────────────────────────────────────
function SummaryCard({ label, value, sub, valueClass, small }: {
  label: string; value: string | null; sub?: string; valueClass?: string; small?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</p>
      {value == null ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/50 mt-2" />
      ) : (
        <p className={cn('font-mono font-black mt-1 tabular-nums leading-none truncate', small ? 'text-lg' : 'text-3xl', valueClass ?? 'text-foreground')}>
          {value}
        </p>
      )}
      {sub && <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}
