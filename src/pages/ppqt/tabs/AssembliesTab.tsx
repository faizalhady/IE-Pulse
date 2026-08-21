/**
 * AssembliesTab.tsx — "Which product drives the station?" (PPQT sheet body)
 *
 * Assemblies with demand for one Area + Period: demand, lead time (Σ CT),
 * bottleneck (MAX CT) and the cycle time per station, grouped by line group
 * exactly like the sheet. Bottleneck cell of each group is bold.
 */

import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { SortHeader } from '@/components/shared/SortHeader';
import { useSortable } from '@/hooks/shared/useSortable';
import { usePpqtAssemblies } from '@/hooks/ppqt/usePpqt';
import type { PPQTAssemblyRow, PPQTMeta } from '@/lib/ppqt/ppqtApi';
import { fmt } from '@/lib/ppqt/ppqtFormat';
import { cn } from '@/lib/utils';

import { CARD, Empty, ErrorBox, Kpi, Loading, PeriodChips, ROW, Segmented, TD, TH } from '../ppqtUi';
import { useAreaPeriod } from './StationsTab';

type Key = 'assembly' | 'demand' | 'lead' | 'bottleneck' | 'load';
const ACCESSORS: Record<Key, (r: PPQTAssemblyRow) => string | number | null> = {
  assembly: (r) => r.assembly,
  demand: (r) => r.demand,
  lead: (r) => r.lead_time_sec,
  bottleneck: (r) => r.bottleneck_sec,
  load: (r) => r.demand_x_lead,
};
const FIXED: { label: string; key: Key; tip: string; left?: boolean }[] = [
  { label: 'Assembly', key: 'assembly', tip: 'SAP part number (col A) and model description', left: true },
  { label: 'Demand', key: 'demand', tip: 'Demand for the period (col G)' },
  { label: 'Lead time', key: 'lead', tip: 'Σ CT across all stations' },
  { label: 'Bottleneck', key: 'bottleneck', tip: 'MAX CT and the station it sits on' },
  { label: 'Load', key: 'load', tip: 'Demand × lead time (hours)' },
];

export default function AssembliesTab({ workcell, meta }: { workcell: string; meta: PPQTMeta }) {
  const { area, period, set } = useAreaPeriod(meta);
  const [q, setQ] = useState('');
  const [scope, setScope] = useState<'demand' | 'all'>('demand');
  const { data, isLoading, isFetching, isError, error } = usePpqtAssemblies(workcell, area, period, scope === 'all');

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const all = data?.rows ?? [];
    return needle ? all.filter((r) => r.assembly.toLowerCase().includes(needle) || r.model.toLowerCase().includes(needle)) : all;
  }, [data, q]);
  const { sorted, sort, toggle } = useSortable<PPQTAssemblyRow, Key>(rows, ACCESSORS, { key: 'demand', dir: 'desc' });

  const groups = useMemo(() => {
    const st = data?.stations ?? [];
    return (data?.groups ?? []).map((g) => ({ ...g, stations: st.filter((s) => s.group_no === g.group_no) })).filter((g) => g.stations.length);
  }, [data]);
  const stations = groups.flatMap((g) => g.stations);

  const totalDemand = rows.reduce((s, r) => s + r.demand, 0);
  const totalLoad = rows.reduce((s, r) => s + r.demand_x_lead, 0) / 3600;

  return (
    <div className="space-y-3 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented ariaLabel="Area" value={area} onChange={(v) => set('area', v)}
                   options={meta.areas.map((a) => ({ value: a.code, label: a.label }))} />
        <PeriodChips periods={meta.periods} value={period} onChange={(v) => set('period', v)} />
        <Segmented ariaLabel="Scope" value={scope} onChange={(v) => setScope(v)}
                   options={[{ value: 'demand', label: 'With demand' }, { value: 'all', label: 'All assemblies', hint: 'Include assemblies with zero demand this period' }]} />
        <label className="relative ml-auto">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Part number or model…" aria-label="Find assembly"
            className="h-8 w-56 rounded-md border border-border bg-background pl-7 pr-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
      </div>

      {data && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Kpi label="Assemblies" value={fmt.int(rows.length)} sub={`of ${data.total} in the sheet`} />
          <Kpi label="Demand" value={fmt.int(totalDemand)} sub="units this period" />
          <Kpi label="Load" value={fmt.hrs(totalLoad)} sub="Σ demand × lead time" />
          <Kpi label="Stations" value={stations.length} sub={`${groups.length} line groups`} />
        </div>
      )}

      <div className={cn(CARD, 'overflow-hidden', isFetching && 'opacity-70')}>
        {isLoading ? (
          <Loading label="Loading assemblies…" />
        ) : isError ? (
          <ErrorBox error={error} />
        ) : sorted.length === 0 ? (
          <Empty>No assembly matches.</Empty>
        ) : (
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full min-w-max border-collapse">
              <thead className="sticky top-0 z-20">
                <tr className="bg-muted/60 backdrop-blur">
                  <th colSpan={FIXED.length} className={cn(TH, 'sticky left-0 z-30 bg-muted/60 text-left')}>
                    cycle time per station (s) →
                  </th>
                  {groups.map((g) => (
                    <th key={g.group_no} colSpan={g.stations.length} className={cn(TH, 'border-l border-border text-center text-foreground')} title={g.line_group}>
                      <span className="block max-w-[14rem] truncate">{g.line_group}</span>
                    </th>
                  ))}
                </tr>
                <tr className="bg-muted/60 backdrop-blur">
                  {FIXED.map((c, i) => (
                    <th key={c.key} className={cn(TH, 'p-0', i === 0 && 'sticky left-0 z-30 bg-muted/60')} title={c.tip}>
                      <SortHeader label={c.label} active={sort?.key === c.key} dir={sort?.dir} onClick={() => toggle(c.key)}
                                  className={cn('w-full px-2', c.left ? 'justify-start' : 'justify-end')} />
                    </th>
                  ))}
                  {groups.flatMap((g) =>
                    g.stations.map((s, i) => (
                      <th key={s.station} title={s.station} className={cn(TH, 'font-medium normal-case tracking-normal', i === 0 && 'border-l border-border')}>
                        <span className="block max-w-[5.5rem] truncate">{s.header}</span>
                      </th>
                    )),
                  )}
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r.sheet_row} className={ROW}>
                    <td className={cn(TD, 'sticky left-0 z-10 bg-card text-left')}>
                      <div className="font-medium text-foreground">{r.assembly}</div>
                      {r.model && <div className="max-w-[14rem] truncate text-[10px] text-muted-foreground">{r.model}</div>}
                    </td>
                    <td className={cn(TD, 'font-semibold text-foreground')}>{fmt.int(r.demand)}</td>
                    <td className={cn(TD, 'text-foreground')}>{fmt.sec(r.lead_time_sec)}</td>
                    <td className={cn(TD, 'text-foreground')}>
                      {fmt.sec(r.bottleneck_sec)}
                      {r.bottleneck_station && <span className="ml-1 text-[10px] text-muted-foreground">{r.bottleneck_station}</span>}
                    </td>
                    <td className={cn(TD, 'text-foreground')}>{fmt.hrs(r.demand_x_lead / 3600, 1)}</td>
                    {groups.flatMap((g) => {
                      const gmax = r.group_bottleneck[String(g.group_no)] ?? 0;
                      return g.stations.map((s, i) => {
                        const ct = r.cts[s.station] ?? 0;
                        const isMax = ct > 0 && ct === gmax;
                        return (
                          <td key={s.station} className={cn(TD, i === 0 && 'border-l border-border/60', ct === 0 ? 'text-muted-foreground/40' : isMax ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                            {ct === 0 ? '·' : fmt.int(ct)}
                          </td>
                        );
                      });
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
