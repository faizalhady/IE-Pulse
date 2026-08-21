/**
 * StationDrawer.tsx — one station, end to end.
 *
 * The formula trace (demand → Σ demand×CT → WCT; hours → available → takt;
 * need → allowance → need with allowances → vs have) and the assemblies that
 * put the load on it, biggest first.
 */

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { usePpqtStationAssemblies } from '@/hooks/ppqt/usePpqt';
import type { PPQTStation } from '@/lib/ppqt/ppqtApi';
import { fmt, TONE_TEXT, utilTone, varianceTone } from '@/lib/ppqt/ppqtFormat';
import { cn } from '@/lib/utils';

import { Bar, IssueBadge, Loading, TD, TH } from './ppqtUi';

function Line({ label, value, note, strong }: { label: string; value: string; note?: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/50 py-1 last:border-0">
      <span className={cn('text-[12px]', strong ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{label}</span>
      <span className="text-right">
        <span className={cn('text-[13px] tabular-nums', strong ? 'font-bold text-foreground' : 'text-foreground')}>{value}</span>
        {note && <span className="ml-1.5 text-[10px] text-muted-foreground">{note}</span>}
      </span>
    </div>
  );
}

export default function StationDrawer({ workcell, area, period, station, onClose }: {
  workcell: string; area: string; period: string; station: PPQTStation | null; onClose: () => void;
}) {
  const { data, isLoading } = usePpqtStationAssemblies(workcell, area, period, station?.station ?? null, 30);
  const s = station;
  return (
    <Sheet open={!!s} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-xl">
        {s && (
          <>
            <SheetHeader className="border-b border-border px-5 py-4 text-left">
              <SheetTitle className="flex items-center gap-2 text-base">
                {s.header}
                {s.is_bay && <span className="rounded bg-primary/10 px-1.5 py-px text-[10px] font-semibold uppercase text-primary">DL bay</span>}
                {s.is_bottleneck && <span className="rounded bg-muted px-1.5 py-px text-[10px] font-semibold uppercase text-muted-foreground">bottleneck</span>}
              </SheetTitle>
              <SheetDescription className="text-[12px]">
                {s.line_group} · {area} · {fmt.period(period)}
              </SheetDescription>
              <IssueBadge issues={s.issues} />
            </SheetHeader>

            <div className="grid grid-cols-2 gap-x-6 px-5 py-3">
              <div>
                <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Quantity × Product</h4>
                <Line label="Demand through" value={fmt.int(s.demand_through)} note="units" />
                <Line label="Σ demand × CT" value={fmt.hrs(s.sum_dem_ct / 3600, 1)} />
                <Line label="Weighted CT" value={fmt.sec(s.wct)} note="÷ demand" strong />
              </div>
              <div>
                <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Time</h4>
                <Line label="Shift hours / day" value={fmt.num(s.hours_per_day, 1)} />
                <Line label="Changeovers" value={`${fmt.int(s.co_per_day)} × ${fmt.int(s.co_min)} min`} note="per day" />
                <Line label="Daily available" value={`${fmt.int(s.daily_avail_min)} min`} />
                <Line label="Days in period" value={fmt.int(s.days)} />
                <Line label="Takt" value={fmt.sec(s.takt)} note="avail ÷ demand" strong />
              </div>
            </div>

            <div className="border-t border-border px-5 py-3">
              <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Process — resources</h4>
              <Line label="Need = WCT ÷ Takt" value={fmt.num(s.need, 3)} />
              <Line label="Allowance = 1 + (1 − FPY × Eff)" value={`× ${fmt.num(s.allowance, 4)}`} note={`FPY ${fmt.num(s.fpy, 2)} · Eff ${fmt.num(s.eff, 2)}`} />
              <Line label="Need with allowances" value={fmt.num(s.need_allow, 3)} strong />
              {s.npi > 0 && <Line label="NPI add-on" value={`+ ${fmt.num(s.npi, 1)}`} />}
              <Line label="Total requirement (ROUNDUP)" value={fmt.int(s.ttl_req)} />
              <Line label="Have" value={s.available == null ? '—' : fmt.int(s.available)} note={s.is_bay ? 'lines (Exe Summaries)' : 'equipment (footer)'} />
              <div className="mt-2 flex items-center gap-3">
                <span className={cn('rounded px-2 py-1 text-sm font-bold tabular-nums', TONE_TEXT[varianceTone(s.variance)], 'bg-muted/50')}>
                  {s.variance == null ? 'no "have" in workbook' : `variance ${fmt.signed(s.variance)}`}
                </span>
                {s.util != null && (
                  <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                    util <b className={cn('tabular-nums', TONE_TEXT[utilTone(s.util)])}>{fmt.pct(s.util, 0)}</b>
                    <Bar pct={s.util * 100} tone={utilTone(s.util)} />
                  </span>
                )}
                {s.crew != null && (
                  <span className="text-[12px] text-muted-foreground">
                    DL <b className="tabular-nums text-foreground">{fmt.num(s.dl_required, 2)}</b> = need × {fmt.int(s.crew)} crew
                  </span>
                )}
              </div>
              {Math.abs(s.delta_vs_sheet) > 1e-6 && (
                <p className={cn('mt-2 text-[11px]', TONE_TEXT.short)}>
                  Differs from the workbook cell by {fmt.num(s.delta_vs_sheet, 4)} — check the sheet.
                </p>
              )}
            </div>

            <div className="border-t border-border">
              <div className="flex items-baseline justify-between px-5 py-2">
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Assemblies loading this station
                </h4>
                {data && (
                  <span className="text-[11px] text-muted-foreground">
                    {data.assemblies} with demand · {fmt.hrs(data.total_load_sec / 3600)} total
                  </span>
                )}
              </div>
              {isLoading || !data ? (
                <Loading label="Loading assemblies…" />
              ) : (
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-muted/40">
                      <th className={cn(TH, 'text-left')}>Assembly</th>
                      <th className={TH}>Demand</th>
                      <th className={TH}>CT</th>
                      <th className={TH}>Load</th>
                      <th className={cn(TH, 'text-left')}>Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((r) => (
                      <tr key={r.sheet_row} className="border-b border-border/50 last:border-0">
                        <td className={cn(TD, 'text-left')}>
                          <div className="font-medium text-foreground">{r.assembly}</div>
                          {r.model && <div className="truncate text-[10px] text-muted-foreground">{r.model}</div>}
                        </td>
                        <td className={cn(TD, 'text-foreground')}>{fmt.int(r.demand)}</td>
                        <td className={cn(TD, 'text-foreground')}>{fmt.sec(r.ct_sec)}</td>
                        <td className={cn(TD, 'text-foreground')}>{fmt.hrs(r.load_sec / 3600, 1)}</td>
                        <td className={cn(TD, 'text-left')}>
                          <div className="flex items-center gap-1.5">
                            <Bar pct={r.share * 100} tone="none" className="w-14" />
                            <span className="text-[11px] tabular-nums text-muted-foreground">{fmt.pct(r.share, 0)}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {data.rows.length === 0 && (
                      <tr><td colSpan={5} className="py-6 text-center text-[12px] text-muted-foreground">No assembly with demand uses this station.</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
