/**
 * VaNvaSizing.tsx
 * ───────────────
 * DL headcount sizing for the whole plant: what we have, what the split is, and
 * how many heads move to sit at the target NVA %. Click a row for the same
 * view on one workcell (VaNvaWorkcellSizing).
 *
 * Route: /va-nva                   (?t=30 target, ?m=2026-06 month — see VaNvaSizingKit)
 *
 * LAYOUT — answer first, detail last
 *   1. Target slider in the sticky header — every number below answers to it.
 *   2. KPI strip: total / VA / NVA / plant NVA %.
 *   3. "Today → after the plan" as two 100% stacked bars with the target marker,
 *      beside the four plan figures (reduce / add / net / DL after).
 *   4. Per-workcell table, worst first, each row a bullet bar against the target.
 *   Stacked bars + bullet rows instead of a donut: exact values matter here, and
 *   a donut cannot show a target.
 *
 * THE PLAN IS PER WORKCELL, THEN SUMMED
 *   Sizing the plant as one number lets a lean workcell cancel a heavy one and
 *   produces no list of who actually moves.
 *
 * IT DOES NOT LAND ON THE TARGET, AND THE PAGE SAYS SO
 *   `nvaTarget` is a share of TODAY's total (the workbook's formula, kept so this
 *   page and the tracker never disagree). Removing NVA heads shrinks that total,
 *   so the result sits ABOVE the target: 5 VA + 5 NVA cutting 3 leaves 2/7 =
 *   28.6%, not 20%. The "after" bar shows where it really lands.
 */

import { useMemo } from 'react';
import { ChevronRight, Factory, Scale, Scissors, Target, TrendingDown, UserPlus, Users } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import {
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { sizingPlan } from '@/lib/va_nva/vanvaCalc';
import {
  NVA_HEX, TARGET_HEX, VA_HEX, nvaTextClass, pct,
} from '@/lib/va_nva/vanvaConstants';
import { KpiTile, NoData, PanelCard, Swatches } from '@/pages/vanva/VaNvaChartKit';
import {
  BAD, Bullet, GOOD, Logo, Move, SizingControls, SplitBar, TD, TH, n0, n1, useSizingData,
} from '@/pages/vanva/VaNvaSizingKit';

export default function VaNvaSizing() {
  const navigate = useNavigate();
  const { target, setTarget, period, periods, setPeriod, dataset, rows, isLoading, qs } = useSizingData();
  const plan = useMemo(() => sizingPlan(rows, target), [rows, target]);
  const offTarget = Math.abs(plan.projectedRatio - target) > 0.005;
  const href = (id: string) => `/va-nva/wc/${encodeURIComponent(id)}${qs}`;

  return (
    <div className="relative">
      <div className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-3">
          <div>
            <h1 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Scale className="h-4 w-4 text-teal-500" /> VA / NVA — HC Sizing
            </h1>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Plant direct labour sized per workcell at the NVA target, then summed
              {dataset && <> · <span className="font-mono">{dataset.filename}</span></>}
            </p>
          </div>
          <SizingControls period={period} periods={periods} onPeriod={setPeriod} target={target} onTarget={setTarget} />
        </div>
      </div>

      <div className="space-y-4 p-5">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-muted/40" />)}
          </div>
        ) : !plan.rows.length ? (
          <div className="h-40"><NoData text="No workcells with NVA recorded." /></div>
        ) : (
          <>
            {/* 2. What we have */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <KpiTile label="Total DL" value={n0(plan.overall)} sub={`${plan.rows.length} workcells`} icon={Users} />
              <KpiTile label="VA DL (sizing)" value={n0(plan.vaSizing)} sub={pct(1 - plan.nvaRatio)} icon={Factory} tone="good" />
              <KpiTile label="NVA DL (MFG)" value={n0(plan.nvaMfg)} sub={pct(plan.nvaRatio)} icon={TrendingDown} tone="bad" />
              <KpiTile label="Plant NVA %" value={pct(plan.nvaRatio)} sub={`target ${pct(target, 0)}`} icon={Target}
                tone={plan.nvaRatio > target ? 'bad' : 'good'} />
            </div>

            {/* 3. Today → after, beside the move */}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
              <PanelCard span="xl:col-span-3" title="Actual → after the plan"
                hint="NVA share of total DL. The amber caret marks the target.">
                <div className="space-y-4 p-4">
                  <SplitBar label="Actual" nva={plan.nvaMfg} va={plan.vaSizing} target={target} />
                  <SplitBar label={`After plan @ ${pct(target, 0)}`} nva={plan.projectedNva} va={plan.vaSizing} target={target} />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Swatches items={[{ label: 'NVA', color: NVA_HEX }, { label: 'VA', color: VA_HEX }, { label: 'Target', color: TARGET_HEX }]} />
                    {offTarget && (
                      <p className="text-[10px] text-muted-foreground">
                        Lands at <span className="font-mono font-bold text-foreground">{pct(plan.projectedRatio)}</span>, not {pct(target, 0)}:
                        the target is a share of the actual total (the tracker&apos;s formula), and cutting NVA shrinks that total.
                      </p>
                    )}
                  </div>
                </div>
              </PanelCard>

              <div className="grid grid-cols-2 gap-3 xl:col-span-2">
                <KpiTile label="Reduce" value={`−${n0(plan.totalReduce)}`} sub={`${plan.over} workcells over target`} icon={Scissors} tone="bad" />
                <KpiTile label="Add" value={`+${n0(plan.totalAdd)}`} sub={`${plan.under} workcells under target`} icon={UserPlus} tone="good" />
                <KpiTile label="Net change" value={`${plan.netChange > 0 ? '−' : plan.netChange < 0 ? '+' : ''}${n0(Math.abs(plan.netChange))}`}
                  sub="whole heads, rounded up" />
                <KpiTile label="DL after the plan" value={n0(plan.projectedOverall)} sub={`was ${n0(plan.overall)}`} />
              </div>
            </div>

            {/* 4. Who moves */}
            <PanelCard title="By workcell" hint="Each workcell sized against its own total. Worst first. Click a row for that workcell.">
              <Table className="min-w-[760px] text-xs">
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className={cn(TH, 'px-4')}>Workcell</TableHead>
                    <TableHead className={cn(TH, 'text-right')}>VA</TableHead>
                    <TableHead className={cn(TH, 'text-right')}>NVA</TableHead>
                    <TableHead className={cn(TH, 'text-right')}>Total</TableHead>
                    <TableHead className={cn(TH, 'min-w-[13rem] text-center')}>NVA % vs target</TableHead>
                    <TableHead className={cn(TH, 'text-right')}>NVA allowed</TableHead>
                    <TableHead className={cn(TH, 'text-right')}>Move</TableHead>
                    <TableHead className={cn(TH, 'w-8 px-2')}><span className="sr-only">Open</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plan.rows.map(r => (
                    <TableRow key={r.id} onClick={() => navigate(href(r.id))} className="group h-11 cursor-pointer">
                      <TableCell className="px-4 py-0">
                        <span className="flex items-center gap-2.5">
                          <Logo name={r.workcell} />
                          {/* The link is the keyboard path; the row click is the mouse path. */}
                          <Link to={href(r.id)} onClick={e => e.stopPropagation()}
                            className="truncate font-semibold text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
                            {r.workcell}
                          </Link>
                        </span>
                      </TableCell>
                      <TableCell className={cn(TD, 'text-right', GOOD)}>{n0(r.vaSizing)}</TableCell>
                      <TableCell className={cn(TD, 'text-right', BAD)}>{n0(r.nvaMfg)}</TableCell>
                      <TableCell className={cn(TD, 'text-right text-muted-foreground')}>{n0(r.overall)}</TableCell>
                      <TableCell className="px-3 py-0">
                        <span className="flex items-center gap-2">
                          <span className={cn('w-12 shrink-0 text-right font-mono text-xs font-black tabular-nums', nvaTextClass(r.nvaRatio))}>
                            {pct(r.nvaRatio)}
                          </span>
                          <Bullet ratio={r.nvaRatio} target={target} />
                        </span>
                      </TableCell>
                      <TableCell className={cn(TD, 'text-right text-muted-foreground')}>{n1(r.nvaTarget)}</TableCell>
                      <TableCell className="px-3 py-0 text-right"><Move r={r} /></TableCell>
                      <TableCell className="px-2 py-0">
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 transition-all group-hover:translate-x-0.5 group-hover:text-teal-500" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="h-10 hover:bg-muted/50">
                    <TableCell className="px-4 py-0 text-xs font-semibold">Plant total</TableCell>
                    <TableCell className={cn(TD, 'text-right font-semibold')}>{n0(plan.vaSizing)}</TableCell>
                    <TableCell className={cn(TD, 'text-right font-semibold')}>{n0(plan.nvaMfg)}</TableCell>
                    <TableCell className={cn(TD, 'text-right font-semibold')}>{n0(plan.overall)}</TableCell>
                    <TableCell className="px-3 py-0">
                      <span className={cn('block w-12 text-right font-mono text-xs font-black tabular-nums', nvaTextClass(plan.nvaRatio))}>
                        {pct(plan.nvaRatio)}
                      </span>
                    </TableCell>
                    <TableCell className={cn(TD, 'text-right text-muted-foreground')}>{n1(plan.overall * target)}</TableCell>
                    <TableCell className={cn(TD, 'text-right font-bold')}>
                      <span className={BAD}>−{n0(plan.totalReduce)}</span>
                      {plan.totalAdd > 0 && <span className={cn('ml-2', GOOD)}>+{n0(plan.totalAdd)}</span>}
                    </TableCell>
                    <TableCell className="px-2 py-0" />
                  </TableRow>
                </TableFooter>
              </Table>
              {/* Footer band — kept empty on purpose. */}
              <div className="border-t border-border px-4 py-2" />
            </PanelCard>
          </>
        )}
      </div>
    </div>
  );
}
