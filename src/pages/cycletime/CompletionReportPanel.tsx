/**
 * CompletionReportPanel — the completion report, on screen instead of in Excel.
 *
 * WHY IT IS ON SCREEN
 *   The report used to be one .xlsx per workcell, built by hand and mailed
 *   around. Twenty-four files drift apart the moment one is rebuilt, and on
 *   14 Aug three rebuilds in one afternoon produced three different answers.
 *   This reads the SAME module the Excel builder does — one implementation,
 *   two renderers — so a model cannot read Complete here and Incomplete there.
 *
 * WHY FRESHNESS IS AT THE TOP AND NOT IN A FOOTNOTE
 *   `assembly_catalog` sat five weeks stale and silently turned real models
 *   into "Not in IEDB". Nothing in the statuses themselves would tell you —
 *   they looked completely normal. So the age of the inputs is shown above the
 *   numbers, loudly, whenever anything is over two weeks old.
 *
 * WHY THE GAP IS THREE COLUMNS
 *   Missing CT and Not in route are IEDB's gap. Unmapped is OURS — the naming
 *   bridge could not identify the step. Folding them into one number blames
 *   IEDB for our own mapping holes; roughly 6% of LAM RESEARCH's gap was ours.
 */

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Loader2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { cycleTimeApi, type CompletionReportRow } from '@/lib/cycle_time/cycleTimeApi';

/** Worst first — the gap is what people open this for. */
const STATUS: Record<string, string> = {
  'Incomplete':            'bg-rose-500/10 text-rose-600 border-rose-500/20',
  'No cycle time in IEDB': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  'Not in IEDB':           'bg-orange-500/10 text-orange-600 border-orange-500/20',
  'Cannot be checked':     'bg-muted text-muted-foreground border-border',
  'Not built yet':         'bg-sky-500/10 text-sky-600 border-sky-500/20',
  'Complete':              'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
};

const n = (v: number | null | undefined) =>
  v === null || v === undefined ? '' : Number(v).toLocaleString();

export function CompletionReportPanel({ workcell }: { workcell: string }) {
  const [filter, setFilter] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['completion-report', workcell],
    queryFn: () => cycleTimeApi.report.get(workcell),
  });

  const rows = useMemo(() => {
    let r: CompletionReportRow[] = data?.rows ?? [];
    if (status) r = r.filter((x) => x.status === status);
    const f = filter.trim().toLowerCase();
    if (f) r = r.filter((x) => x.assembly.toLowerCase().includes(f));
    return r;
  }, [data, status, filter]);

  const stale = (data?.freshness ?? []).filter((f) => (f.days_old ?? 0) > 14);

  if (isLoading) {
    return <div className="flex items-center gap-2 p-8 text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> building the report…
    </div>;
  }
  if (isError) {
    return <div className="p-6 text-sm text-rose-600">
      Could not build the report: {(error as Error)?.message}
    </div>;
  }
  if (!data || data.models === 0) {
    return <div className="p-8 text-center text-sm text-muted-foreground">
      {workcell} has no models with forward demand — nothing to report.
    </div>;
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      {/* Stale inputs, above the numbers. A stale mart distorts them and the
          statuses themselves look completely normal. */}
      {stale.length > 0 && (
        <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="text-sm">
            <div className="font-medium text-amber-700">
              These numbers rest on data that has not been refreshed
            </div>
            {stale.map((f) => (
              <div key={f.mart} className="text-xs text-muted-foreground">
                <span className="font-mono">{f.mart}</span> — {f.days_old} days old · {f.drives}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{data.models.toLocaleString()}</span> models
          with forward demand
        </span>
        {status && (
          <button onClick={() => setStatus(null)}
                  className="text-xs text-muted-foreground underline">clear filter</button>
        )}
      </div>

      {/* Summary — click one to filter the table under it */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {data.summary.map((s) => (
          <button
            key={s.status}
            onClick={() => setStatus(status === s.status ? null : s.status)}
            className={cn('rounded-lg border p-3 text-left transition',
              status === s.status ? 'ring-2 ring-primary' : 'hover:bg-muted/40')}
          >
            <div className="flex items-baseline justify-between gap-2">
              <Badge variant="outline" className={STATUS[s.status] ?? ''}>{s.status}</Badge>
              <span className="text-lg font-semibold tabular-nums">{n(s.models)}</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {s.pct}% · {n(s.planner_units)} planner units
              {s.gap_steps > 0 && <> · <span className="text-rose-600">{n(s.gap_steps)} gap steps</span></>}
              {s.unmapped_steps > 0 && <> · {n(s.unmapped_steps)} unmapped (ours)</>}
            </div>
          </button>
        ))}
      </div>

      <Input placeholder="find a model…" value={filter}
             onChange={(e) => setFilter(e.target.value)} className="max-w-xs" />

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr className="[&>th]:whitespace-nowrap [&>th]:px-3 [&>th]:py-2 [&>th]:font-medium">
              <th>Model</th><th>Status</th>
              <th className="text-right">MES steps</th>
              <th className="text-right">Matched</th>
              {/* IEDB's gap */}
              <th className="text-right">Missing CT</th>
              <th className="text-right">Not in route</th>
              {/* ours */}
              <th className="text-right">Unmapped</th>
              <th className="text-right">Gap</th>
              <th className="text-right">Planner</th>
              <th>Upcoming</th><th>Last built</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 400).map((r) => (
              <tr key={r.assembly} className="border-t [&>td]:whitespace-nowrap [&>td]:px-3 [&>td]:py-1.5">
                <td className="font-mono text-xs">{r.assembly}</td>
                <td><Badge variant="outline" className={STATUS[r.status] ?? ''}>{r.status}</Badge></td>
                <td className="text-right tabular-nums">{n(r.mes_steps)}</td>
                <td className="text-right tabular-nums">{n(r.matched)}</td>
                <td className="text-right tabular-nums">{n(r.missing_ct)}</td>
                <td className="text-right tabular-nums">{n(r.not_in_route)}</td>
                <td className="text-right tabular-nums text-muted-foreground">{n(r.unmapped)}</td>
                <td className="text-right font-medium tabular-nums">{n(r.gap)}</td>
                <td className="text-right tabular-nums">{n(r.planner_units)}</td>
                <td className="text-xs text-muted-foreground">{r.upcoming_build}</td>
                <td className="text-xs text-muted-foreground">{r.last_build}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 400 && (
        <div className="text-xs text-muted-foreground">
          showing the first 400 of {rows.length.toLocaleString()} — filter to narrow
        </div>
      )}
    </div>
  );
}
