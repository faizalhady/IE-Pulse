/**
 * VaNvaWorkcellSizing.tsx
 * ────────────────────────
 * One workcell through the same sizing logic as the plant page: its split
 * today, the whole-head move at the target, where it actually lands, and the
 * same move re-run at every other target. Reached by clicking a row on
 * VaNvaSizing; the full workbook view of the workcell stays on /va-nva/wc/:id.
 *
 * Route: /va-nva/wc/:id            (?t=30 target, ?m=2026-06 month — see VaNvaSizingKit)
 *
 * Same formula, same rounding, same honesty about the landing point — all of
 * it comes from sizingPlan() on this one row, nothing is re-derived here.
 */

import { useMemo } from 'react';
import { ArrowLeft, ArrowUpRight, Factory, Target, TrendingDown, Users } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { sizingPlan } from '@/lib/va_nva/vanvaCalc';
import { NVA_HEX, TARGET_HEX, VA_HEX, nvaTextClass, pct } from '@/lib/va_nva/vanvaConstants';
import { KpiTile, PanelCard, Swatches } from '@/pages/vanva/VaNvaChartKit';
import {
  BAD, GOOD, Logo, Move, SizingControls, SplitBar, TD, TH, n0, n1, useSizingData,
} from '@/pages/vanva/VaNvaSizingKit';

/** Rungs of the "at every target" table. The live target is spliced in when it is not one of them. */
const SWEEP = [0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40];
const key = (t: number) => Math.round(t * 100);

export default function VaNvaWorkcellSizing() {
  const { id = '' } = useParams();
  const wcId = decodeURIComponent(id);
  const navigate = useNavigate();
  const { target, setTarget, period, periods, setPeriod, rows, isLoading, qs } = useSizingData();

  const plant = useMemo(() => sizingPlan(rows, target), [rows, target]);
  const mine = useMemo(() => rows.filter(r => r.id === wcId), [rows, wcId]);
  const plan = useMemo(() => sizingPlan(mine, target), [mine, target]);
  const sweep = useMemo(() => {
    const ts = SWEEP.some(s => key(s) === key(target)) ? SWEEP : [...SWEEP, target].sort((a, b) => a - b);
    return ts.map(t => ({ t, p: sizingPlan(mine, t) }));
  }, [mine, target]);

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  const row = plan.rows[0];
  if (!row) {
    return (
      <div className="p-10 text-center">
        <p className="text-sm text-muted-foreground">No sizing for this workcell — it is not a counted row, or has no NVA recorded.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate(`/va-nva${qs}`)}>Back to plant sizing</Button>
      </div>
    );
  }

  const meta = rows.find(r => r.id === wcId);
  const rank = plant.rows.findIndex(r => r.id === wcId) + 1;
  const offTarget = Math.abs(plan.projectedRatio - target) > 0.005;
  const moveValue = row.reduce > 0 ? `−${n0(row.reduce)}` : row.add > 0 ? `+${n0(row.add)}` : '0';
  const moveWord = row.reduce > 0 ? 'cut' : row.add > 0 ? 'add' : 'hold';

  return (
    <div className="relative">
      <div className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => navigate(`/va-nva${qs}`)} aria-label="Back to plant sizing"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <Logo name={row.workcell} size="lg" />
            <div>
              <h1 className="flex items-center gap-2 text-sm font-bold text-foreground">
                {row.workcell}
                <span className="text-[10px] font-normal text-muted-foreground">HC Sizing{meta?.role === 'parent' && ' · rollup'}</span>
              </h1>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                #{rank} of {plant.rows.length} by NVA %, worst first ·{' '}
                <Link to={`/va-nva/wc/${id}/detail${qs}`}
                  className="inline-flex items-center gap-0.5 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
                  full detail <ArrowUpRight className="h-3 w-3" />
                </Link>
              </p>
            </div>
          </div>
          <SizingControls period={period} periods={periods} onPeriod={setPeriod} target={target} onTarget={setTarget} />
        </div>
      </div>

      <div className="space-y-4 p-5">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiTile label="Total DL" value={n0(row.overall)} sub={`${pct(plant.overall ? row.overall / plant.overall : 0)} of plant`} icon={Users} />
          <KpiTile label="VA DL (sizing)" value={n0(row.vaSizing)} sub={pct(1 - (row.nvaRatio ?? 0))} icon={Factory} tone="good" />
          <KpiTile label="NVA DL (MFG)" value={n0(row.nvaMfg)} sub={pct(row.nvaRatio)} icon={TrendingDown} tone="bad" />
          <KpiTile label="NVA %" value={pct(row.nvaRatio)} sub={`target ${pct(target, 0)}`} icon={Target}
            tone={(row.nvaRatio ?? 0) > target ? 'bad' : 'good'} />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
          <PanelCard span="xl:col-span-3" title="Actual → after the plan"
            hint="NVA share of this workcell's DL. The amber line is the target.">
            <div className="space-y-4 p-4">
              <SplitBar label="Actual" nva={row.nvaMfg} va={row.vaSizing} target={target} />
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
            <KpiTile label="Move" value={moveValue} sub={`${moveWord} · whole heads, rounded up`}
              tone={row.reduce > 0 ? 'bad' : row.add > 0 ? 'good' : 'neutral'} />
            <KpiTile label={`NVA allowed @ ${pct(target, 0)}`} value={n1(row.nvaTarget)} sub={`${n0(row.nvaMfg)} actual`} icon={Target} />
            <KpiTile label="DL after the plan" value={n0(plan.projectedOverall)} sub={`was ${n0(row.overall)}`} />
            <KpiTile label="Lands at" value={pct(plan.projectedRatio)} sub={offTarget ? `${pct(target, 0)} asked` : 'on target'}
              tone={plan.projectedRatio > target + 0.005 ? 'warn' : 'good'} />
          </div>
        </div>

        <PanelCard title="Same move at every target"
          hint="The workbook's formula re-run at each rung. Click a row to set the slider there.">
          <Table className="min-w-[560px] text-xs">
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className={cn(TH, 'px-4')}>Target</TableHead>
                <TableHead className={cn(TH, 'text-right')}>NVA allowed</TableHead>
                <TableHead className={cn(TH, 'text-right')}>Move</TableHead>
                <TableHead className={cn(TH, 'text-right')}>DL after</TableHead>
                <TableHead className={cn(TH, 'px-4 text-right')}>Lands at</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sweep.map(({ t, p }) => {
                const r = p.rows[0];
                const live = key(t) === key(target);
                return (
                  <TableRow key={key(t)} onClick={() => setTarget(t)} aria-current={live || undefined}
                    className={cn('h-10 cursor-pointer', live && 'bg-muted/40 font-semibold')}>
                    <TableCell className={cn(TD, 'px-4 text-foreground')}>
                      {pct(t, 0)}{live && <span className="ml-2 font-sans text-[9px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">live</span>}
                    </TableCell>
                    <TableCell className={cn(TD, 'text-right text-muted-foreground')}>{n1(r.nvaTarget)}</TableCell>
                    <TableCell className="px-3 py-0 text-right"><Move r={r} /></TableCell>
                    <TableCell className={cn(TD, 'text-right')}>{n0(p.projectedOverall)}</TableCell>
                    <TableCell className={cn(TD, 'px-4 text-right font-bold', nvaTextClass(p.projectedRatio))}>{pct(p.projectedRatio)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {/* Footer band — kept empty on purpose. */}
          <div className="border-t border-border px-4 py-2" />
        </PanelCard>

        <p className="text-[10px] text-muted-foreground">
          <span className={BAD}>Cut</span> / <span className={GOOD}>add</span> use the plant page&apos;s rule exactly: NVA allowed = total DL × target, move = NVA − allowed.
        </p>
      </div>
    </div>
  );
}
