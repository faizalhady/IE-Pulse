/**
 * SummaryTab.tsx — the PPQT objective (Exe Summaries).
 *
 * "Do we have enough DL and equipment for the demand?"
 * Per period: DL required vs actual DL, variance, NVA ratio vs target, bays
 * short. Then the bay table by area with the periods side by side:
 *   Req = need with allowances · NPI · Ttl = ROUNDUP(Req + NPI) · Avail ·
 *   Var = Avail − Ttl (negative = short) · DL = Req × crew
 * Footer = the sheet's own totals block (Σ DL, actual, NVA math).
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { usePpqtSummary } from '@/hooks/ppqt/usePpqt';
import type { PPQTBay, PPQTMeta, PPQTPeriodSummary } from '@/lib/ppqt/ppqtApi';
import { fmt, TONE_TEXT, varianceTone, type Tone } from '@/lib/ppqt/ppqtFormat';
import { cn } from '@/lib/utils';

import { CARD, Empty, ErrorBox, Kpi, Loading, Segmented, TD, TH } from '../ppqtUi';

const PERIOD_COLS = ['Demand', 'Req', 'NPI', 'Ttl', 'Avail', 'Var', 'DL'] as const;
const PERIOD_TIPS: Record<(typeof PERIOD_COLS)[number], string> = {
  Demand: 'Demand through the bay = Σ demand of assemblies that have a cycle time at this station',
  Req: 'Line requirement = resources needed with allowances (fractional)',
  NPI: 'Manual NPI add-on from the workbook',
  Ttl: 'Total requirement = ROUNDUP(Req + NPI)',
  Avail: 'Lines / equipment available (workbook)',
  Var: 'Variance = Avail − Ttl. Negative = short',
  DL: 'DL required = Req × crew',
};

interface GroupRow { bay: string; type: string; crew: number; per: (PPQTBay | undefined)[] }
interface Group { area: string; area_code: string | null; is_overhead: boolean; rows: GroupRow[] }

function buildGroups(periods: PPQTPeriodSummary[]): Group[] {
  if (!periods.length) return [];
  const maps = periods.map((p) => new Map(p.bays.map((b) => [`${b.area}|${b.bay}`, b])));
  const order: string[] = [];
  const groups = new Map<string, Group>();
  for (const b of periods[0].bays) {
    if (!groups.has(b.area)) { groups.set(b.area, { area: b.area, area_code: b.area_code, is_overhead: b.is_overhead, rows: [] }); order.push(b.area); }
    groups.get(b.area)!.rows.push({ bay: b.bay, type: b.type, crew: b.crew, per: maps.map((m) => m.get(`${b.area}|${b.bay}`)) });
  }
  return order.map((a) => groups.get(a)!);
}

const FOOTER: { label: string; get: (p: PPQTPeriodSummary) => number | null; d?: number; pct?: boolean; tone?: (p: PPQTPeriodSummary) => Tone; strong?: boolean }[] = [
  { label: 'Σ DL required', get: (p) => p.dl_required, d: 1, strong: true },
  { label: 'Actual DL', get: (p) => p.actual_dl, d: 0 },
  { label: 'Variance (actual − required)', get: (p) => p.dl_variance, d: 1, tone: (p) => varianceTone(p.dl_variance), strong: true },
  { label: 'NVA DL', get: (p) => p.nva_dl, d: 0 },
  { label: 'Non-mfg DL', get: (p) => p.non_mfg_dl, d: 0 },
  { label: 'NVA ratio (NVA ÷ Σ DL)', get: (p) => p.nva_ratio, pct: true, tone: (p) => (p.nva_ratio != null && p.nva_ratio > p.nva_target ? 'short' : 'ok') },
  { label: 'In-line VA (Σ DL − NVA)', get: (p) => p.inline_va, d: 1 },
  { label: 'Allowable NVA at target', get: (p) => p.nva_allow, d: 1 },
  { label: 'NVA excess (allowable − NVA)', get: (p) => p.nva_excess, d: 1, tone: (p) => varianceTone(p.nva_excess) },
];

export default function SummaryTab({ workcell, meta }: { workcell: string; meta: PPQTMeta }) {
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = usePpqtSummary(workcell);
  const [filter, setFilter] = useState<'all' | 'short'>('all');
  const periods = data?.periods ?? [];
  const groups = useMemo(() => buildGroups(periods), [periods]);

  if (isLoading) return <Loading label="Loading report…" />;
  if (isError) return <ErrorBox error={error} />;
  if (!periods.length) return <Empty>No Exe Summaries sheet in this workbook.</Empty>;

  const visible = groups
    .map((g) => ({ ...g, rows: filter === 'short' ? g.rows.filter((r) => r.per.some((b) => b && b.variance < 0)) : g.rows }))
    .filter((g) => g.rows.length > 0);
  const areaTotal = (p: PPQTPeriodSummary, area: string) => p.dl_by_area.find((x) => x.area === area)?.dl_required ?? 0;
  const areaDemand = (p: PPQTPeriodSummary, code: string | null) =>
    code ? p.demand_by_area.find((x) => x.area_code === code)?.total_demand ?? null : null;
  const openStation = (g: Group, r: GroupRow) => {
    const b = r.per.find(Boolean);
    if (!b || !b.area_code || !b.station) return;
    navigate(`/ppqt/${encodeURIComponent(workcell)}/stations?area=${b.area_code}&period=${meta.latest ?? ''}&station=${encodeURIComponent(b.station)}`);
  };

  return (
    <div className="space-y-4 p-5">
      {/* ─── One card per period ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {periods.map((p, i) => {
          const tone = varianceTone(p.dl_variance);
          const nvaTone: Tone = p.nva_ratio == null ? 'none' : p.nva_ratio > p.nva_target ? 'short' : 'ok';
          // Demand is the input everything else reacts to — it leads the card,
          // with its change against the previous period.
          const prev = i > 0 ? periods[i - 1].total_demand : null;
          const delta = prev ? (p.total_demand - prev) / prev : null;
          return (
            <div key={p.period} className={cn(CARD, 'p-3')}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-base font-bold text-foreground">{fmt.period(p.period)}</span>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {p.weeks ? `${p.weeks} wk` : ''}{p.period_date ? ` · sheet ${fmt.date(p.period_date)}` : ''}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
                <Kpi
                  label="Demand"
                  value={fmt.int(p.total_demand)}
                  sub={
                    delta == null ? 'units · first period' : (
                      <span className="tabular-nums">
                        <span className={cn('font-semibold', delta > 0 ? TONE_TEXT.short : delta < 0 ? TONE_TEXT.ok : '')}>
                          {fmt.signed(delta * 100, 1)}%
                        </span>{' '}vs {fmt.period(periods[i - 1].period)}
                      </span>
                    )
                  }
                />
                <Kpi label="DL required" value={fmt.num(p.dl_required, 1)} sub={`actual ${fmt.int(p.actual_dl)}`} />
                <Kpi label="Variance" value={fmt.signed(p.dl_variance, 1)} tone={tone} sub="actual − required" />
                <Kpi label="NVA ratio" value={fmt.pct(p.nva_ratio)} tone={nvaTone} sub={`target ${fmt.pct(p.nva_target, 0)}`} />
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                <span className="tabular-nums">PCA <b className="text-foreground">{fmt.int(p.pca_vol)}</b> · HLA <b className="text-foreground">{fmt.int(p.hla_vol)}</b></span>
                <span>Bays short <b className={cn('tabular-nums', p.bays_short ? TONE_TEXT.short : TONE_TEXT.ok)}>{p.bays_short}</b> / {p.bays_total}</span>
                <span>Equipment short <b className={cn('tabular-nums', p.equipment_short ? TONE_TEXT.short : TONE_TEXT.ok)}>{p.equipment_short}</b></span>
                <span>DL per 1,000 units <b className="tabular-nums text-foreground">{p.total_demand ? fmt.num(p.dl_required / p.total_demand * 1000, 2) : '—'}</b></span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── Bay table ───────────────────────────────────────────────── */}
      <div className={cn(CARD, 'overflow-hidden')}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2">
          <h2 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
            DL plan by bay — {periods.length} periods
          </h2>
          <div className="flex items-center gap-3">
            <span className="hidden text-[11px] text-muted-foreground sm:inline">Var = Avail − Ttl · click a bay to open its station</span>
            <Segmented size="xs" ariaLabel="Filter" value={filter} onChange={(v) => setFilter(v)}
                       options={[{ value: 'all', label: 'All bays' }, { value: 'short', label: 'Short only' }]} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-max border-collapse">
            <thead>
              <tr className="bg-muted/50">
                <th rowSpan={2} className={cn(TH, 'sticky left-0 z-10 bg-muted/50 backdrop-blur')}>Bay</th>
                <th rowSpan={2} className={cn(TH, 'text-left')}>Type</th>
                <th rowSpan={2} className={TH}>Crew</th>
                {periods.map((p) => (
                  <th key={p.period} colSpan={PERIOD_COLS.length} className={cn(TH, 'border-l border-border text-center text-foreground')}>
                    {fmt.period(p.period)}
                  </th>
                ))}
              </tr>
              <tr className="bg-muted/50">
                {periods.flatMap((p) =>
                  PERIOD_COLS.map((c, i) => (
                    <th key={`${p.period}-${c}`} title={PERIOD_TIPS[c]} className={cn(TH, i === 0 && 'border-l border-border')}>{c}</th>
                  )),
                )}
              </tr>
            </thead>
            <tbody>
              {visible.map((g) => (
                <GroupRows key={g.area} g={g} periods={periods} areaTotal={areaTotal} areaDemand={areaDemand} onOpen={openStation} />
              ))}
              {visible.length === 0 && (
                <tr><td colSpan={3 + periods.length * PERIOD_COLS.length} className="py-10 text-center text-sm text-muted-foreground">No bay is short. Every bay has at least as many lines as it needs.</td></tr>
              )}
            </tbody>
            <tfoot className="border-t-2 border-border bg-muted/20">
              {FOOTER.map((f) => (
                <tr key={f.label} className="border-b border-border/60 last:border-0">
                  <td colSpan={3} className={cn(TD, 'sticky left-0 z-10 bg-card text-left', f.strong ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{f.label}</td>
                  {periods.map((p) => {
                    const v = f.get(p);
                    const tone = f.tone?.(p) ?? 'none';
                    return (
                      <td key={p.period} colSpan={PERIOD_COLS.length}
                          className={cn(TD, 'border-l border-border', f.strong && 'font-semibold', tone !== 'none' ? TONE_TEXT[tone] : 'text-foreground')}>
                        {f.pct ? fmt.pct(v) : f.tone && !f.pct && f.label.startsWith('Variance') ? fmt.signed(v, f.d) : fmt.num(v, f.d ?? 1)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

function GroupRows({ g, periods, areaTotal, areaDemand, onOpen }: {
  g: Group; periods: PPQTPeriodSummary[];
  areaTotal: (p: PPQTPeriodSummary, area: string) => number;
  areaDemand: (p: PPQTPeriodSummary, code: string | null) => number | null;
  onOpen: (g: Group, r: GroupRow) => void;
}) {
  return (
    <>
      <tr className="bg-muted/30">
        <td colSpan={3} className={cn(TD, 'sticky left-0 z-10 bg-muted/30 text-left font-semibold text-foreground backdrop-blur')}>
          {g.area}{g.is_overhead && <span className="ml-2 text-[10px] font-normal uppercase text-muted-foreground">overhead</span>}
        </td>
        {periods.map((p) => {
          const d = areaDemand(p, g.area_code);
          return (
            <td key={p.period} colSpan={PERIOD_COLS.length} className={cn(TD, 'border-l border-border text-[11px] text-muted-foreground')}>
              {d != null && <span className="mr-3" title="Demand on this area's PPQT sheet (units)">demand <b className="text-foreground">{fmt.int(d)}</b></span>}
              DL <b className="text-foreground">{fmt.num(areaTotal(p, g.area), 1)}</b>
            </td>
          );
        })}
      </tr>
      {g.rows.map((r) => {
        const clickable = !g.is_overhead && r.per.some((b) => b?.station);
        return (
          <tr
            key={r.bay}
            onClick={clickable ? () => onOpen(g, r) : undefined}
            className={cn('border-b border-border/60 last:border-0 transition-colors', clickable && 'cursor-pointer hover:bg-muted/40')}
          >
            <td className={cn(TD, 'sticky left-0 z-10 bg-card text-left font-medium text-foreground')}>{r.bay}</td>
            <td className={cn(TD, 'text-left text-muted-foreground')}>{r.type || '—'}</td>
            <td className={TD}>{fmt.int(r.crew)}</td>
            {r.per.map((b, i) =>
              b ? (
                <PeriodCells key={periods[i].period} b={b} />
              ) : (
                <td key={periods[i].period} colSpan={PERIOD_COLS.length} className={cn(TD, 'border-l border-border text-center text-muted-foreground')}>—</td>
              ),
            )}
          </tr>
        );
      })}
    </>
  );
}

function PeriodCells({ b }: { b: PPQTBay }) {
  const tone = varianceTone(b.variance);
  return (
    <>
      <td className={cn(TD, 'border-l border-border', b.demand_through ? 'text-foreground' : 'text-muted-foreground')}>
        {b.demand_through == null ? '—' : fmt.int(b.demand_through)}
      </td>
      <td className={cn(TD, 'text-foreground')} title={b.source === 'sheet' ? 'Value from the workbook (no matching station column)' : undefined}>
        {fmt.num(b.line_req, 2)}{b.source === 'sheet' && !b.is_overhead && <span className="ml-0.5 text-[9px] text-amber-600">*</span>}
      </td>
      <td className={cn(TD, 'text-muted-foreground')}>{b.npi ? fmt.num(b.npi, 1) : '·'}</td>
      <td className={cn(TD, 'text-foreground')}>{fmt.int(b.ttl_req)}</td>
      <td className={cn(TD, 'text-foreground')}>{fmt.int(b.available)}</td>
      <td className={cn(TD, 'font-semibold', TONE_TEXT[tone])}>{fmt.signed(b.variance)}</td>
      <td className={cn(TD, 'text-foreground')}>{fmt.num(b.dl_required, 1)}</td>
    </>
  );
}
