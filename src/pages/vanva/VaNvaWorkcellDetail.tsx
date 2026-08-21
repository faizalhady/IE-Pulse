/**
 * VaNvaWorkcellDetail.tsx
 * ────────────────────────
 * One workcell in full: KPI strip, VA/NVA donut, its position against every
 * other workcell, the rollup breakdown when it has children, and the raw
 * workbook cells it was built from.
 *
 * Route: /va-nva/wc/:id
 */

import { Button } from '@/components/ui/button';
import { useVaNvaRows } from '@/hooks/va_nva/useVaNvaData';
import { getWorkcellLogo } from '@/lib/ole/oleConstants';
import { cn } from '@/lib/utils';
import { measured, plantTotals } from '@/lib/va_nva/vanvaCalc';
import {
  ACTUAL_HEX, AXIS_TICK, GRID_STROKE, NVA_HEX, NVA_TARGET, PPQT_HEX,
  STAGE_BADGE, STAGE_LABEL, TARGET_HEX, TOOLTIP_STYLE, VANVA_STATUS_BADGE,
  VANVA_STATUS_HEX, VANVA_STATUS_LABEL, VA_HEX, dl, nvaTextClass, pct, signed,
  sizingGapClass,
} from '@/lib/va_nva/vanvaConstants';
import { ChartCard, KpiTile, PanelCard, Swatches } from '@/pages/vanva/VaNvaChartKit';
import { usePeriod } from '@/pages/vanva/VaNvaSizingKit';
import type { VaNvaMetrics } from '@/pages/vanva/types';
import {
  AlertTriangle, ArrowLeft, Scissors, Target, TrendingDown, Users,
} from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Bar, BarChart, Cell, CartesianGrid, Label, Pie, PieChart, PolarAngleAxis,
  RadialBar, RadialBarChart, ReferenceLine, Tooltip, XAxis, YAxis,
} from 'recharts';

const short = (n: string) => (n.length > 13 ? `${n.slice(0, 12)}…` : n);

export default function VaNvaWorkcellDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  // Month comes from ?m= so the hop from the sizing page lands on the same sheet.
  const { dataset: ds, qs } = usePeriod();
  const { rows, dataset } = useVaNvaRows(NVA_TARGET, ds?.id);

  const row = rows.find(r => r.id === decodeURIComponent(id));
  const children = rows.filter(r => r.parentId === row?.id);
  const totals = useMemo(() => plantTotals(rows, NVA_TARGET), [rows]);

  if (!row) {
    return (
      <div className="p-10 text-center">
        <p className="text-sm text-muted-foreground">Workcell not found in {dataset?.filename ?? 'this dataset'}.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate(`/va-nva${qs}`)}>Back to sizing</Button>
      </div>
    );
  }

  const logo = getWorkcellLogo(row.workcell);
  const rank = [...measured(rows)].sort((a, b) => (b.nvaRatio ?? 0) - (a.nvaRatio ?? 0))
    .findIndex(r => r.id === row.id) + 1;

  const donut = [
    { name: 'VA', value: row.vaSizingRound ?? 0, fill: VA_HEX },
    { name: 'NVA', value: row.nvaMfg ?? 0, fill: NVA_HEX },
  ];

  const gauge = [{
    name: 'NVA', value: +(((row.nvaRatio ?? 0) * 100)).toFixed(1),
    fill: VANVA_STATUS_HEX[row.status],
  }];

  const peers = [...measured(rows)]
    .sort((a, b) => (b.nvaRatio ?? 0) - (a.nvaRatio ?? 0))
    .map(r => ({
      name: short(r.workcell), full: r.workcell, me: r.id === row.id,
      nva: +(((r.nvaRatio as number) * 100)).toFixed(1),
    }));

  const cells: [string, string, string?][] = [
    ['VA DL sizing — roundup', dl(row.vaSizingRound, 2), 'col C'],
    ['VA DL sizing — decimal', dl(row.vaSizingDecimal, 2), 'col D'],
    ['Actual headcount', dl(row.vaActual), 'col E'],
    ['Crew', row.crew === null ? '—' : String(row.crew), 'col F'],
    ['NVA actual — PPQT', dl(row.nvaPpqt), 'col K · unused by the workbook'],
    ['NVA actual — MFG', dl(row.nvaMfg), 'col L'],
    ['Overall DL — roundup', dl(row.overallRound, 2), 'col H = C + L'],
    ['Overall DL — decimal', dl(row.overallDecimal, 2), 'col I = D + L'],
    ['NVA ratio', pct(row.nvaRatio), 'col M = L / H'],
    [`NVA allowed @ ${pct(NVA_TARGET, 0)}`, dl(row.nvaTarget, 2), 'col P = H × 0.2'],
    ['DL to reduce', signed(row.toReduce, 2), 'col Q = L − P'],
    ['Actual − sizing', signed(row.sizingGap), 'derived'],
    ['PPQT − MFG', signed(row.ppqtVsMfg), 'derived'],
  ];

  return (
    <div className="relative">
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border px-6 py-3">
        <button onClick={() => navigate(`/va-nva/wc/${encodeURIComponent(row.id)}${qs}`)}
          className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft className="h-3 w-3" /> Sizing
        </button>
        <div className="flex items-center gap-3">
          {logo ? (
            <div className="w-[4.25rem] h-10 rounded-md border border-border bg-white flex items-center justify-center overflow-hidden flex-shrink-0">
              <img src={logo} alt={row.workcell} className="w-full h-full object-contain p-1" />
            </div>
          ) : (
            <div className="w-[4.25rem] h-10 rounded-md border border-border bg-muted flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-muted-foreground">{row.workcell.slice(0, 3).toUpperCase()}</span>
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-foreground truncate">{row.workcell}</h1>
            <p className="text-[10px] text-muted-foreground">
              {rank > 0 ? `#${rank} worst NVA of ${measured(rows).length}` : 'Not ranked — no NVA recorded'}
              {dataset && ` · ${dataset.periodLabel}`}
            </p>
          </div>
          <span className={cn('ml-auto text-[10px] font-semibold px-2 py-1 rounded border', VANVA_STATUS_BADGE[row.status])}>
            {VANVA_STATUS_LABEL[row.status]}
          </span>
          {row.stage && (
            <span className={cn('text-[10px] font-semibold px-2 py-1 rounded border', STAGE_BADGE[row.stage])}>
              {STAGE_LABEL[row.stage]}
            </span>
          )}
        </div>
      </div>

      <div className="p-5 space-y-4">
        {row.note && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-amber-200/90 leading-snug">{row.note}</p>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <KpiTile label="Total DL" value={dl(row.overallRound)} sub={`${pct((row.overallRound ?? 0) / totals.overall)} of plant`} icon={Users} />
          <KpiTile label="VA DL" value={dl(row.vaSizingRound)} sub={pct(row.vaRatio)} tone="good" />
          <KpiTile label="NVA DL" value={dl(row.nvaMfg)} sub={pct(row.nvaRatio)} icon={TrendingDown} tone="bad" />
          <KpiTile label="Actual heads" value={dl(row.vaActual)} sub={`${signed(row.sizingGap)} vs sizing`} tone="accent" />
          <KpiTile label={`Allowed @ ${pct(NVA_TARGET, 0)}`} value={dl(row.nvaTarget)} icon={Target} />
          <KpiTile
            label="DL to cut" value={signed(row.toReduce)} icon={Scissors}
            tone={(row.toReduce ?? 0) > 0 ? 'bad' : 'good'}
            sub={(row.toReduce ?? 0) > 0 ? 'over target' : 'under target'}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
          <ChartCard title="VA / NVA split" height={250}>
            <PieChart>
              <Pie data={donut} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%"
                paddingAngle={2} stroke="hsl(var(--card))" strokeWidth={2}>
                {donut.map((d, i) => <Cell key={i} fill={d.fill} />)}
                <Label position="center" content={() => (
                  <>
                    <text x="50%" y="46%" textAnchor="middle" fontSize={20} fontWeight={800}
                      fill={VANVA_STATUS_HEX[row.status]}>{pct(row.nvaRatio, 0)}</text>
                    <text x="50%" y="58%" textAnchor="middle" fontSize={9} fill="hsl(var(--muted-foreground))">NVA</text>
                  </>
                )} />
              </Pie>
              <Tooltip {...TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${dl(v)} DL`, n]} />
            </PieChart>
          </ChartCard>

          <ChartCard title="NVA % vs target" hint={`Ring fills to ${pct(NVA_TARGET, 0)} at the amber mark.`} height={250}>
            <RadialBarChart innerRadius="62%" outerRadius="96%" data={gauge} startAngle={210} endAngle={-30}>
              <PolarAngleAxis type="number" domain={[0, 60]} tick={false} />
              <RadialBar background={{ fill: 'hsl(var(--muted) / 0.35)' }} dataKey="value" cornerRadius={8} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => [`${v}%`, 'NVA']} />
            </RadialBarChart>
          </ChartCard>

          <ChartCard
            title="Headcount sources"
            hint="Sizing, actual and both NVA sources side by side."
            height={250}
            span="xl:col-span-2"
            actions={<Swatches items={[
              { label: 'VA sizing', color: VA_HEX }, { label: 'Actual', color: ACTUAL_HEX },
              { label: 'NVA MFG', color: NVA_HEX }, { label: 'NVA PPQT', color: PPQT_HEX },
            ]} />}
          >
            <BarChart data={[{
              name: row.workcell,
              sizing: row.vaSizingRound ?? 0, actual: row.vaActual ?? 0,
              mfg: row.nvaMfg ?? 0, ppqt: row.nvaPpqt ?? 0,
            }]} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_STROKE} />
              <XAxis dataKey="name" tick={{ ...AXIS_TICK, fontSize: 9 }} tickLine={false} axisLine={false} />
              <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={36} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Bar dataKey="sizing" name="VA sizing" fill={VA_HEX} radius={[3, 3, 0, 0]} maxBarSize={40} />
              <Bar dataKey="actual" name="Actual" fill={ACTUAL_HEX} radius={[3, 3, 0, 0]} maxBarSize={40} />
              <Bar dataKey="mfg" name="NVA MFG" fill={NVA_HEX} radius={[3, 3, 0, 0]} maxBarSize={40} />
              <Bar dataKey="ppqt" name="NVA PPQT" fill={PPQT_HEX} radius={[3, 3, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ChartCard>
        </div>

        <ChartCard
          title="Where this workcell sits"
          hint="Every measured workcell, ranked. This one is highlighted."
          height={300}
        >
          <BarChart data={peers} margin={{ top: 8, right: 16, left: 0, bottom: 44 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_STROKE} />
            <XAxis dataKey="name" tick={{ ...AXIS_TICK, fontSize: 9 }} interval={0} angle={-42} textAnchor="end" height={54} tickLine={false} axisLine={false} />
            <YAxis tick={AXIS_TICK} tickFormatter={v => `${v}%`} tickLine={false} axisLine={false} width={36} />
            <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => [`${v}%`, 'NVA']}
              labelFormatter={(_, p) => (p?.[0]?.payload as { full?: string })?.full ?? ''} />
            <ReferenceLine y={NVA_TARGET * 100} stroke={TARGET_HEX} strokeDasharray="5 3" strokeWidth={1.5} />
            <Bar dataKey="nva" radius={[3, 3, 0, 0]} maxBarSize={30}>
              {peers.map((p, i) => (
                <Cell key={i} fill={p.me ? '#38bdf8' : 'hsl(var(--muted-foreground) / 0.35)'} />
              ))}
            </Bar>
          </BarChart>
        </ChartCard>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <PanelCard title="Source cells" hint={`From ${dataset?.filename ?? 'the workbook'} · Sheet1.`}>
            {cells.map(([label, value, src], i) => (
              <div key={label} className={cn('flex items-center gap-3 px-4 py-2', i < cells.length - 1 && 'border-b border-border')}>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-foreground truncate">{label}</p>
                  {src && <p className="text-[9px] text-muted-foreground font-mono">{src}</p>}
                </div>
                <span className="text-[12px] font-mono font-semibold text-foreground tabular-nums flex-shrink-0">{value}</span>
              </div>
            ))}
          </PanelCard>

          {children.length > 0 ? (
            <PanelCard
              title="Rollup breakdown"
              hint="These rows roll into the parent above. They are shown here and excluded from plant totals so nothing is counted twice."
            >
              {children.map((c: VaNvaMetrics, i) => (
                <div key={c.id} className={cn('px-4 py-2.5', i < children.length - 1 && 'border-b border-border')}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-semibold text-foreground truncate">{c.workcell}</p>
                    <span className={cn('text-[11px] font-mono font-bold tabular-nums', nvaTextClass(c.nvaRatio))}>{pct(c.nvaRatio)}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-4 text-[10px] font-mono text-muted-foreground tabular-nums">
                    <span>VA {dl(c.vaSizingRound, 2)}</span>
                    <span>NVA {dl(c.nvaMfg)}</span>
                    <span>Actual {dl(c.vaActual)}</span>
                    <span className={sizingGapClass(c.sizingGap)}>{signed(c.sizingGap)}</span>
                  </div>
                  {c.note && <p className="mt-1 text-[9px] text-amber-400/90 leading-snug">{c.note}</p>}
                </div>
              ))}
            </PanelCard>
          ) : (
            <PanelCard title="Plant context">
              {[
                ['Plant total DL', dl(totals.overall)],
                ['Plant NVA DL', dl(totals.nvaMfg)],
                ['Plant NVA %', pct(totals.nvaRatio)],
                ['This workcell — share of plant DL', pct((row.overallRound ?? 0) / totals.overall)],
                ['This workcell — share of plant NVA', pct((row.nvaMfg ?? 0) / totals.nvaMfg)],
              ].map(([l, v], i, arr) => (
                <div key={l} className={cn('flex items-center justify-between gap-3 px-4 py-2.5', i < arr.length - 1 && 'border-b border-border')}>
                  <span className="text-[11px] text-muted-foreground">{l}</span>
                  <span className="text-[12px] font-mono font-semibold text-foreground tabular-nums">{v}</span>
                </div>
              ))}
            </PanelCard>
          )}
        </div>
      </div>
    </div>
  );
}
