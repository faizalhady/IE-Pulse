import { cn } from '@/lib/utils';
import { useOleResults } from '@/hooks/useOleData';
import { fmtDate } from '@/lib/oleConstants';
import { ArrowLeft, AlertTriangle, RefreshCw, WifiOff } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import type { OleResult } from '@/lib/oleApi';

function getOleStatus(pct: number | null): 'optimal' | 'warning' | 'critical' | 'idle' {
  if (pct === null) return 'idle';
  if (pct >= 80)   return 'optimal';
  if (pct >= 60)   return 'warning';
  return 'critical';
}

const OLE_COLOR: Record<string, string> = {
  optimal:  'text-emerald-500',
  warning:  'text-amber-400',
  critical: 'text-red-400',
  idle:     'text-muted-foreground',
};

const OLE_BAR: Record<string, string> = {
  optimal:  'bg-emerald-500',
  warning:  'bg-amber-400',
  critical: 'bg-red-500',
  idle:     'bg-muted',
};

const QUALITY_BADGE: Record<OleResult['data_quality'], string> = {
  OK:              'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  PARTIAL_SMH:     'bg-amber-500/15  text-amber-400  border-amber-500/30',
  NO_INPUT_HOURS:  'bg-red-500/15    text-red-400    border-red-500/30',
  NO_OUTPUT_SMH:   'bg-red-500/15    text-red-400    border-red-500/30',
};

const QUALITY_LABEL: Record<OleResult['data_quality'], string> = {
  OK:             'OK',
  PARTIAL_SMH:    'Partial SMH',
  NO_INPUT_HOURS: 'No Input Hrs',
  NO_OUTPUT_SMH:  'No Output SMH',
};

export default function OLEWorkcell() {
  const { workcell } = useParams<{ workcell: string }>();
  const navigate     = useNavigate();

  const { data, loading, error, refetch } = useOleResults({
    workcell: workcell ? decodeURIComponent(workcell) : undefined,
  });

  const rows = data ?? [];

  // Aggregate stats
  const validRows   = rows.filter(r => r.ole_pct !== null);
  const totalQty    = rows.reduce((s, r) => s + r.total_qty, 0);
  const totalOutput = rows.reduce((s, r) => s + r.effective_output_smh, 0);
  const totalInput  = rows.reduce((s, r) => s + r.total_input_hours, 0);
  const avgOle      = totalInput > 0 ? ((totalOutput / totalInput) * 100).toFixed(2) : '—';
  const stageLabel  = rows[0]?.stage_label ?? '—';

  return (
    <div className="space-y-0">

      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-background border-b border-border px-6 mb-6">
        <div className="pt-4 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/ole')}
                className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-foreground">{decodeURIComponent(workcell ?? '')}</h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {loading ? 'Loading…' : error ? 'Backend unreachable' : `OLE breakdown by shift · Final scan: ${stageLabel}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
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
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-4 gap-4 pb-4">
          {[
            { label: 'Avg OLE',       value: avgOle !== '—' ? `${avgOle}%` : '—', sub: `${rows.length} shifts` },
            { label: 'Total Qty',     value: totalQty.toLocaleString(),             sub: 'units produced' },
            { label: 'Output SMH',    value: totalOutput.toFixed(1),               sub: 'effective man-hrs' },
            { label: 'Input Hours',   value: totalInput.toFixed(1),                sub: 'total paid hrs' },
          ].map(({ label, value, sub }) => (
            <div key={label} className="rounded-lg border border-border bg-card px-4 py-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-xl font-mono font-bold text-foreground mt-0.5">{value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && rows.length === 0 && (
        <div className="px-6 pb-8 space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      )}

      {/* Shift table */}
      {(!loading || rows.length > 0) && (
        <div className="px-6 pb-8">
          <div className="rounded-xl border border-border overflow-hidden">

            {/* Header */}
            <div
              className="grid bg-muted/50 border-b border-border text-xs text-muted-foreground font-medium uppercase tracking-wider"
              style={{ gridTemplateColumns: '2.5rem 7rem 4rem 7rem 6rem 7rem 7rem 7rem 7rem 7rem' }}
            >
              <div className="px-4 py-3 text-center">#</div>
              <div className="px-3 py-3">Date</div>
              <div className="px-3 py-3 text-center">Shift</div>
              <div className="px-3 py-3 text-center">OLE %</div>
              <div className="px-3 py-3 text-center">SMH Cov.</div>
              <div className="px-3 py-3 text-center">Output SMH</div>
              <div className="px-3 py-3 text-center">Input Hrs</div>
              <div className="px-3 py-3 text-center">Total Qty</div>
              <div className="px-3 py-3 text-center">Assemblies</div>
              <div className="px-3 py-3 text-center">Quality</div>
            </div>

            {rows.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                {error ? 'Could not load shift data' : 'No shift data found'}
              </div>
            ) : rows.map((row, idx) => {
              const calcOle = row.total_input_hours > 0 ? (row.effective_output_smh / row.total_input_hours) * 100 : 0;
              const status = getOleStatus(calcOle);
              return (
                <div
                  key={`${row.date}-${row.shift}`}
                  className="grid items-center text-sm border-b border-border last:border-0 hover:bg-muted/40 transition-colors"
                  style={{ gridTemplateColumns: '2.5rem 7rem 4rem 7rem 6rem 7rem 7rem 7rem 7rem 7rem' }}
                >
                  <div className="px-4 py-4 text-center text-xs text-muted-foreground font-mono">{idx + 1}</div>

                  {/* Date */}
                  <div className="px-3 py-4">
                    <span className="font-mono text-xs text-foreground">{fmtDate(row.date)}</span>
                  </div>

                  {/* Shift */}
                  <div className="px-3 py-4 text-center">
                    <span className="font-mono font-semibold text-foreground">{row.shift}</span>
                  </div>

                  {/* OLE % */}
                  <div className="px-3 py-4 text-center">
                    <span className={cn('text-lg font-mono font-bold', OLE_COLOR[status])}>
                      {row.total_input_hours > 0 ? `${calcOle.toFixed(2)}%` : '—'}
                    </span>
                    <div className="mt-1 h-1 rounded-full bg-muted/50 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', OLE_BAR[status])}
                        style={{ width: `${Math.min(calcOle, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* SMH coverage */}
                  <div className="px-3 py-4 text-center">
                    <span className={cn('text-xs font-mono font-semibold',
                      (row.smh_coverage_pct ?? 0) >= 90 ? 'text-emerald-400' :
                      (row.smh_coverage_pct ?? 0) >= 70 ? 'text-amber-400' : 'text-red-400'
                    )}>
                      {row.smh_coverage_pct !== null ? `${row.smh_coverage_pct}%` : '—'}
                    </span>
                  </div>

                  {/* Output SMH */}
                  <div className="px-3 py-4 text-center">
                    <span className="font-mono text-sm text-foreground">
                      {row.effective_output_smh.toFixed(2)}
                    </span>
                  </div>

                  {/* Input hours */}
                  <div className="px-3 py-4 text-center">
                    <span className="font-mono text-sm text-foreground">
                      {row.total_input_hours.toFixed(2)}
                    </span>
                  </div>

                  {/* Total qty */}
                  <div className="px-3 py-4 text-center">
                    <span className="font-mono text-sm text-foreground">
                      {row.total_qty.toLocaleString()}
                    </span>
                  </div>

                  {/* Assembly count */}
                  <div className="px-3 py-4 text-center">
                    <span className="font-mono text-sm text-foreground">{row.assembly_count}</span>
                    {row.assemblies_missing_smh > 0 && (
                      <span className="ml-1 text-[10px] text-amber-400">
                        <AlertTriangle className="inline w-3 h-3" /> {row.assemblies_missing_smh}
                      </span>
                    )}
                  </div>

                  {/* Data quality */}
                  <div className="px-3 py-4 flex justify-center">
                    <span className={cn('text-[10px] font-semibold px-2 py-1 rounded-full border', QUALITY_BADGE[row.data_quality])}>
                      {QUALITY_LABEL[row.data_quality]}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Missing SMH link */}
          {rows.some(r => r.data_quality === 'PARTIAL_SMH') && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-400/90">
                Some shifts have partial SMH coverage — OLE is understated.{' '}
                <button
                  onClick={() => navigate(`/ole/smh-status?workcell=${encodeURIComponent(workcell ?? '')}`)}
                  className="underline hover:text-amber-300 transition-colors"
                >
                  View missing assemblies →
                </button>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
