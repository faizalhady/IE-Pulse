/**
 * InputsTab.tsx — "Where do the numbers come from?"
 *
 * Read-only view of every parameter the workbook feeds into the formulas:
 *   • per period: weeks, volumes, actual DL, NVA DL, non-mfg DL, NVA target
 *   • per station (area + period): shift hours, days, changeovers, FPY,
 *     efficiency, equipment available — plus the sheet's own result cell
 *   • per bay (Exe Summaries): DL/line, crew, NPI, available, per period
 * Edit the workbook and refresh to change any of them.
 */

import { useMemo } from 'react';

import { usePpqtInputs } from '@/hooks/ppqt/usePpqt';
import type { PPQTMeta } from '@/lib/ppqt/ppqtApi';
import { fmt } from '@/lib/ppqt/ppqtFormat';
import { cn } from '@/lib/utils';

import { CARD, Empty, ErrorBox, IssueBadge, Loading, PeriodChips, ROW, SectionTitle, Segmented, TD, TH } from '../ppqtUi';
import { useAreaPeriod } from './StationsTab';

export default function InputsTab({ workcell, meta }: { workcell: string; meta: PPQTMeta }) {
  const { area, period, set } = useAreaPeriod(meta);
  const { data, isLoading, isError, error } = usePpqtInputs(workcell);

  const stations = useMemo(
    () => (data?.stations ?? []).filter((s) => s.area === area && s.period === period).sort((a, b) => a.seq - b.seq),
    [data, area, period],
  );
  const bays = useMemo(() => {
    const all = data?.bays ?? [];
    const periods = data?.periods.map((p) => p.period) ?? [];
    const byKey = new Map<string, Map<string, (typeof all)[number]>>();
    const order: { area: string; bay: string; type: string; dl_per_line: number; crew: number }[] = [];
    for (const b of all) {
      const k = `${b.area}|${b.bay}`;
      if (!byKey.has(k)) { byKey.set(k, new Map()); order.push({ area: b.area, bay: b.bay, type: b.type, dl_per_line: b.dl_per_line, crew: b.crew }); }
      byKey.get(k)!.set(b.period, b);
    }
    return { periods, rows: order.map((o) => ({ ...o, per: periods.map((p) => byKey.get(`${o.area}|${o.bay}`)!.get(p)) })) };
  }, [data]);

  if (isLoading) return <Loading label="Loading inputs…" />;
  if (isError) return <ErrorBox error={error} />;
  if (!data) return <Empty>No inputs.</Empty>;

  return (
    <div className="space-y-4 p-5">
      <p className="text-[12px] text-muted-foreground">
        Everything below is read from the workbook. To change a value, edit the sheet and press <b>Refresh workbooks</b> on the PPQT landing page.
      </p>

      {/* ─── Period scalars ─────────────────────────────────────────── */}
      <div className={cn(CARD, 'overflow-hidden')}>
        <SectionTitle>Periods (Exe Summaries)</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-max border-collapse">
            <thead>
              <tr className="bg-muted/40">
                {['Period', 'Sheet date', 'Weeks', 'PCA volume', 'HLA volume', 'Actual DL', 'NVA DL', 'Non-mfg DL', 'NVA target'].map((h, i) => (
                  <th key={h} className={cn(TH, i === 0 && 'text-left')}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.periods.map((p) => (
                <tr key={p.period} className={ROW}>
                  <td className={cn(TD, 'text-left font-semibold text-foreground')}>{fmt.period(p.period)}</td>
                  <td className={cn(TD, 'text-muted-foreground')}>{fmt.date(p.period_date)}</td>
                  <td className={cn(TD, 'text-foreground')}>{fmt.int(p.weeks)}</td>
                  <td className={cn(TD, 'text-foreground')}>{fmt.int(p.pca_vol)}</td>
                  <td className={cn(TD, 'text-foreground')}>{fmt.int(p.hla_vol)}</td>
                  <td className={cn(TD, 'text-foreground')}>{fmt.int(p.actual_dl)}</td>
                  <td className={cn(TD, 'text-foreground')}>{fmt.int(p.nva_dl)}</td>
                  <td className={cn(TD, 'text-foreground')}>{fmt.int(p.non_mfg_dl)}</td>
                  <td className={cn(TD, 'text-foreground')}>{fmt.pct(p.nva_target, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Station parameters ─────────────────────────────────────── */}
      <div className={cn(CARD, 'overflow-hidden')}>
        <SectionTitle right={
          <div className="flex flex-wrap items-center gap-2">
            <Segmented size="xs" ariaLabel="Area" value={area} onChange={(v) => set('area', v)}
                       options={meta.areas.map((a) => ({ value: a.code, label: a.label }))} />
            <PeriodChips periods={meta.periods} value={period} onChange={(v) => set('period', v)} />
          </div>
        }>
          Station parameters (PPQT sheet footer)
        </SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-max border-collapse">
            <thead>
              <tr className="bg-muted/40">
                {['Station', 'Line group', 'Shift h/day', 'Days', 'CO/day', 'CO min', 'Daily avail (min)', 'FPY', 'Eff', 'Eq avail', 'Sheet: need +allow', 'Sheet: demand'].map((h, i) => (
                  <th key={h} className={cn(TH, i < 2 && 'text-left')}>{h}</th>
                ))}
                <th className={TH} aria-label="flags" />
              </tr>
            </thead>
            <tbody>
              {stations.map((s) => (
                <tr key={s.station} className={cn(ROW, s.is_bottleneck && 'bg-muted/20')}>
                  <td className={cn(TD, 'text-left font-medium text-foreground')}>{s.header}</td>
                  <td className={cn(TD, 'max-w-[14rem] truncate text-left text-muted-foreground')} title={s.line_group}>{s.line_group}</td>
                  <td className={cn(TD, 'text-foreground')}>{fmt.num(s.hours_per_day, 1)}</td>
                  <td className={cn(TD, s.days ? 'text-foreground' : 'text-red-500')}>{fmt.int(s.days)}</td>
                  <td className={cn(TD, 'text-foreground')}>{fmt.int(s.co_per_day)}</td>
                  <td className={cn(TD, 'text-foreground')}>{fmt.int(s.co_min)}</td>
                  <td className={cn(TD, 'text-foreground')}>{fmt.int(s.hours_per_day * 60 - s.co_per_day * s.co_min)}</td>
                  <td className={cn(TD, 'text-foreground')}>{fmt.num(s.fpy, 2)}</td>
                  <td className={cn(TD, 'text-foreground')}>{fmt.num(s.eff, 2)}</td>
                  <td className={cn(TD, 'text-foreground')}>{s.is_bottleneck ? '—' : fmt.int(s.eq_avail)}</td>
                  <td className={cn(TD, 'text-muted-foreground')}>{fmt.num(s.sheet_need_allow, 3)}</td>
                  <td className={cn(TD, 'text-muted-foreground')}>{fmt.int(s.sheet_demand_through)}</td>
                  <td className="px-2"><IssueBadge issues={s.issues} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Bays ───────────────────────────────────────────────────── */}
      <div className={cn(CARD, 'overflow-hidden')}>
        <SectionTitle>Bays (Exe Summaries) — crew, NPI and lines available</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-max border-collapse">
            <thead>
              <tr className="bg-muted/40">
                <th rowSpan={2} className={cn(TH, 'text-left')}>Area</th>
                <th rowSpan={2} className={cn(TH, 'text-left')}>Bay</th>
                <th rowSpan={2} className={cn(TH, 'text-left')}>Type</th>
                <th rowSpan={2} className={TH}>DL / line</th>
                <th rowSpan={2} className={TH}>Crew</th>
                {bays.periods.map((p) => (
                  <th key={p} colSpan={2} className={cn(TH, 'border-l border-border text-center text-foreground')}>{fmt.period(p)}</th>
                ))}
              </tr>
              <tr className="bg-muted/40">
                {bays.periods.flatMap((p) => [
                  <th key={`${p}-npi`} className={cn(TH, 'border-l border-border')}>NPI</th>,
                  <th key={`${p}-av`} className={TH}>Available</th>,
                ])}
              </tr>
            </thead>
            <tbody>
              {bays.rows.map((r) => (
                <tr key={`${r.area}|${r.bay}`} className={ROW}>
                  <td className={cn(TD, 'text-left text-muted-foreground')}>{r.area}</td>
                  <td className={cn(TD, 'text-left font-medium text-foreground')}>{r.bay}</td>
                  <td className={cn(TD, 'text-left text-muted-foreground')}>{r.type || '—'}</td>
                  <td className={cn(TD, 'text-foreground')}>{fmt.int(r.dl_per_line)}</td>
                  <td className={cn(TD, 'text-foreground')}>{fmt.int(r.crew)}</td>
                  {r.per.map((b, i) => [
                    <td key={`${i}-npi`} className={cn(TD, 'border-l border-border/60 text-muted-foreground')}>{b?.npi ? fmt.num(b.npi, 1) : '·'}</td>,
                    <td key={`${i}-av`} className={cn(TD, 'text-foreground')}>{b ? fmt.int(b.available) : '—'}</td>,
                  ])}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
