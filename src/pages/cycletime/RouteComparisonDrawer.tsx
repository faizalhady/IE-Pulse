/**
 * RouteComparisonDrawer.tsx
 * ─────────────────────────
 * Right-side drawer — the PROOF behind a model's completion + LBR/IPK badges.
 * Three tabs:
 *   • Route — MES actual route ‖ IEDB route (which steps have cycle time)
 *   • LBR   — per-line Yamazumi (station CTs) with the balance target line
 *   • IPK   — buffer/trolley need along the process flow, where each sits
 * Data: /completion/steps + /completion/line-metrics.
 */

import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useCycleTimeCompletionSteps, useCycleTimeLineMetrics } from '@/hooks/cycle_time/useCycleTimeData';
import { formatCycleSecondsLabel } from '@/lib/cycle_time/cycleTimeApi';
import type { CompletionMesStep, IpkLine, LineMetrics, LineMetricsLine } from '@/lib/cycle_time/cycleTimeApi';
import { cn } from '@/lib/utils';
import { AlertTriangle, ArrowUpRight, Loader2, ShoppingCart } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const LBR_TARGET = 85;
const lbrColor = (v: number | null) =>
  v == null ? 'text-muted-foreground' : v >= LBR_TARGET ? 'text-emerald-600' : v >= 70 ? 'text-amber-600' : 'text-red-500';

/** v1 said `missing` for two different problems; v2 splits them into `no_ct`
 *  (step is in IEDB's route, cycle time blank) and `not_in_iedb` (route doesn't
 *  list the step at all). Both spellings are kept — the drawer reads v2 first
 *  but falls back to v1 per side, so a single render can mix them. */
const MES_STATUS: Record<string, { label: string; row: string; pill: string }> = {
  present:     { label: 'in IEDB',    row: 'bg-emerald-500/5', pill: 'bg-emerald-500/15 text-emerald-600' },
  missing:     { label: 'missing CT', row: 'bg-red-500/5',     pill: 'bg-red-500/15 text-red-600' },
  no_ct:       { label: 'missing CT', row: 'bg-red-500/5',     pill: 'bg-red-500/15 text-red-600' },
  // 'not in route' was ambiguous the moment the IEDB column grew its own
  // 'not in MES route' badge — two opposite gaps reading as the same words.
  // Each badge now names the route the step is MISSING FROM.
  not_in_iedb: { label: 'not in IEDB route', row: 'bg-violet-500/5', pill: 'bg-violet-500/15 text-violet-600' },
  non_iedb:    { label: 'not IEDB',   row: '',                 pill: 'bg-muted text-muted-foreground' },
  unmapped:    { label: 'unmapped',   row: 'bg-amber-500/5',   pill: 'bg-amber-500/15 text-amber-600' },
};

/** Position badge — simply 1..N down the list as shown. NOT the source `order`
 *  field: IEDB's is a sparse routing rank (10, 20, 25…) and MES's restarts per
 *  route, so both read as arbitrary next to a step you are counting through.
 *
 *  Sky = MES (what the floor ran), violet = IEDB (the route on paper). Same
 *  shape both sides so the eye pairs them; colour says which list a number
 *  belongs to. */
function OrderDot({ n, side }: { n: number | null; side: 'mes' | 'iedb' }) {
  return (
    <span className={cn(
      'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold tabular-nums',
      n == null ? 'bg-muted text-muted-foreground'
        : side === 'mes' ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
          : 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
    )}>{n ?? '·'}</span>
  );
}

/** Mirrors `_code` in modules/cycle_time/completion_v2.py — the alias CODE is
 *  the only identifier both sides share. Take the part before the first dash,
 *  drop the trailing instance number, strip punctuation. */
const aliasCode = (s: string | null | undefined) =>
  (s ?? '').split('-')[0].trim().toUpperCase().replace(/[\s\d./]+$/, '').replace(/[^A-Z0-9]/g, '');

type Tab = 'route' | 'lbr' | 'ipk';

export function RouteComparisonDrawer({
  customer, assembly, onClose, tab: initialTab = 'route',
}: { customer: string; assembly: string; onClose: () => void; tab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const steps = useCycleTimeCompletionSteps(customer, assembly);
  const lm = useCycleTimeLineMetrics(customer, assembly);

  return (
    <Sheet open onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-3xl">
        <div className="border-b border-border px-5 py-3 pr-12">
          <h2 className="truncate text-sm font-bold text-foreground">{assembly}</h2>
          <p className="truncate text-[11px] text-muted-foreground">{customer}</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="flex gap-1">
              {(['route', 'lbr', 'ipk'] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn('rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors',
                    tab === t ? 'bg-emerald-500/15 text-emerald-600' : 'text-muted-foreground hover:text-foreground')}
                >
                  {t === 'route' ? 'Route' : t.toUpperCase()}
                </button>
              ))}
            </div>
            {/* The drawer was a dead end: everything it showed was un-linkable,
                un-bookmarkable, and impossible to send to the engineer who owns
                the model. The same three views live on the model page, which
                has a URL — so the drawer is a preview OF that page.
                Solid, not a text link: the way OUT of a drawer has to be as
                findable as the tabs inside it, or nobody finds it at all. */}
            <Link
              to={`/cycle-time/${encodeURIComponent(customer)}/${encodeURIComponent(assembly)}`}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1 focus-visible:ring-offset-background"
            >
              Open full page <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {tab === 'route' && <RouteView q={steps} />}
        {tab === 'lbr' && <MetricsGate q={lm}>{(m) => <LbrView lm={m} />}</MetricsGate>}
        {tab === 'ipk' && <MetricsGate q={lm}>{(m) => <IpkView lm={m} />}</MetricsGate>}
      </SheetContent>
    </Sheet>
  );
}

// ─── Route tab (MES ‖ IEDB) ──────────────────────────────────────────────────
export function RouteView({ q }: { q: ReturnType<typeof useCycleTimeCompletionSteps> }) {
  const [hideNoise, setHideNoise] = useState(true);
  const data = q.data;
  const mes = data?.mes ?? [];
  const mesShown = hideNoise ? mes.filter((s) => s.status !== 'non_iedb') : mes;
  const iedb = [...(data?.iedb ?? [])].sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9));
  // The backend tags a step `iedb:<assembly>` when resolve() fell back to another
  // model's route — K_CTEC AE3649-66500EV10 has no IEDB rows of its own and was
  // handed AE3649-66500's 13 timed steps. Rendering those unlabelled is how a
  // model nobody ever timed gets signed off as priced.
  const borrowedFrom = iedb.find((s) => s.source?.startsWith('iedb:'))?.source?.slice(5) ?? null;

  // alias CODE -> the POSITION of the IEDB step it points at, so a MES row can
  // show WHICH row on the right it was judged against — 1..N, the number the
  // reader can actually count to. First one wins, matching the backend: IEDB
  // numbers a step per-model ("MA 1", "MA 2") but the code is the identity.
  const byCode = new Map<string, number>();
  iedb.forEach((s, i) => {
    const c = aliasCode(s.alias);
    if (c && !byCode.has(c)) byCode.set(c, i + 1);
  });
  const iedbSeqOf = (alias: string | null) => {
    const c = aliasCode(alias);
    return c ? byCode.get(c) ?? null : null;
  };

  // The reverse direction. `iedbSeqOf` answers "which IEDB step does this MES row
  // point at"; this answers "did ANY MES row point here". An IEDB step nothing
  // points at is a step we have priced and the floor never ran — the route on
  // paper and the route in reality have drifted, and until now the only way to
  // spot one was to read both columns and diff them by eye.
  //
  // Built from the FULL mes list, not `mesShown`: "hide logistics" is a display
  // filter, and letting it change whether a step counts as found would make the
  // shading flicker with a checkbox.
  const mesCodes = new Set<string>();
  for (const s of mes) {
    const c = aliasCode(s.alias);
    if (c) mesCodes.add(c);
  }
  // No alias at all counts as unlinked too: there is nothing for MES to match on,
  // so no scan can ever reach it. Same consequence, same shading.
  const notInMes = (alias: string | null) => {
    const c = aliasCode(alias);
    return !c || !mesCodes.has(c);
  };
  const missingCount = iedb.filter((s) => notInMes(s.alias)).length;

  if (q.isLoading) return <Center><Loader2 className="h-5 w-5 animate-spin" /></Center>;
  if (q.isError || !data) return <Center><span className="text-sm text-muted-foreground">No route data available for this model.</span></Center>;

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-2">
      <div className="flex min-h-0 flex-col border-b border-border md:border-b-0 md:border-r">
        <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">MES route (actual) · {mesShown.length}</span>
          <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <input type="checkbox" checked={hideNoise} onChange={(e) => setHideNoise(e.target.checked)} className="h-3 w-3" /> hide logistics
          </label>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {mes.length === 0 && (
            <p className="p-4 text-center text-xs text-muted-foreground">
              MES data not available for this model (not built recently) — showing IEDB cycle time only.
            </p>
          )}
          {mesShown.map((s, i) => {
            // Fallback, not decoration: an unknown status used to read as
            // undefined and crash the whole drawer on `m.row`.
            const m = MES_STATUS[s.status] ?? MES_STATUS.unmapped;
            const iedbSeq = iedbSeqOf(s.alias);
            return (
              <div key={i} className={cn('grid grid-cols-[1.25rem_1fr_auto] items-center gap-2 border-b border-border px-4 py-1.5 last:border-0', m.row)}>
                {/* Numbered over the SHOWN rows, so "hide logistics" leaves
                    1..N contiguous rather than a list full of gaps. */}
                <OrderDot n={i + 1} side="mes" />
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-medium text-foreground">{s.step}</p>
                  {s.alias && (
                    <p className="flex items-center gap-1 truncate text-[10px] text-muted-foreground">
                      <span className="truncate">→ {s.alias}</span>
                      {/* Which IEDB step this one answers to. Absent = the alias
                          matched nothing in the route on the right. */}
                      {iedbSeq != null && <OrderDot n={iedbSeq} side="iedb" />}
                    </p>
                  )}
                </div>
                <span className={cn('rounded-full px-1.5 py-px text-[8px] font-semibold uppercase tracking-wide whitespace-nowrap', m.pill)}>{m.label}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex min-h-0 flex-col">
        <div className="border-b border-border bg-muted/40 px-4 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">IEDB route (cycle time) · {iedb.length}</span>
          {missingCount > 0 && mes.length > 0 && (
            <span className="ml-2 rounded-full bg-red-500/15 px-1.5 py-px text-[9px] font-semibold text-red-600 dark:text-red-400">
              {missingCount} not in MES route
            </span>
          )}
        </div>
        {borrowedFrom && (
          <div className="flex items-start gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2">
            <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0 text-amber-600" />
            <p className="text-[11px] leading-snug text-amber-700 dark:text-amber-500">
              Borrowed route — these steps belong to <span className="font-semibold">{borrowedFrom}</span>, not this model.
              This model has no cycle time of its own in IEDB. Do not sign it off on these numbers.
            </p>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-auto">
          {iedb.map((s, i) => {
            // Only meaningful when there IS a MES route to compare against. With
            // no MES data every step would shade red and say the floor skipped
            // them, when the truth is the model has not been built recently.
            const orphan = mes.length > 0 && notInMes(s.alias);
            return (
            <div key={i} className={cn('grid grid-cols-[1.25rem_1fr_auto] items-center gap-2 border-b border-border px-4 py-1.5 last:border-0',
                                       orphan && 'bg-red-500/5')}>
              {/* Still SORTED by the source `order` — only the label is the
                  position, so the route sequence is unchanged. */}
              <OrderDot n={i + 1} side="iedb" />
              <div className="min-w-0">
                <p className="truncate text-[12px] font-medium text-foreground">{s.process}</p>
                {/* Alias, not sub_workcenter: the alias is what the MES side is
                    actually matched against, so it belongs next to the step. */}
                <p className="flex items-center gap-1.5 truncate text-[10px] text-muted-foreground">
                  {s.alias && <span className="truncate">{s.alias}</span>}
                  {orphan && (
                    <span className="shrink-0 rounded-full bg-red-500/15 px-1.5 py-px text-[8px] font-semibold uppercase tracking-wide text-red-600 dark:text-red-400"
                          title="No step in the MES route matches this one — priced, but the floor did not run it">
                      not in MES route
                    </span>
                  )}
                </p>
              </div>
              <span className="ct-num tabular-nums text-[11px] font-semibold text-foreground whitespace-nowrap">{formatCycleSecondsLabel(s.cycle_time)}</span>
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── LBR tab — per-line Yamazumi with balance line ───────────────────────────
export function LbrView({ lm }: { lm: LineMetrics }) {
  return (
    <div className="min-h-0 flex-1 space-y-5 overflow-auto p-4">
      <p className="text-xs text-muted-foreground">
        Headline LBR <span className={cn('font-bold', lbrColor(lm.lbr))}>{lm.lbr ?? '—'}%</span> · {lm.lines.length} line(s) ·
        each bar = a station's operator CT; dashed line = the balanced target (≥{LBR_TARGET}% is healthy).
      </p>
      {lm.lines.map((line) => <LineYamazumi key={line.sub_workcenter} line={line} />)}
    </div>
  );
}

function CtBarLabel(props: { x?: number; y?: number; width?: number; value?: number }) {
  const { x = 0, y = 0, width = 0, value } = props;
  if (value == null) return null;
  const text = `${Number(value).toFixed(0)}s`;
  const cx = x + width / 2;
  const boxW = text.length * 7 + 8;
  const boxH = 15;
  const boxY = y - boxH - 3;
  return (
    <g>
      <rect x={cx - boxW / 2} y={boxY} width={boxW} height={boxH} rx={3}
        className="fill-background stroke-border" strokeWidth={1} opacity={0.9} />
      <text x={cx} y={boxY + boxH / 2 + 0.5} textAnchor="middle" dominantBaseline="central"
        className="fill-foreground" fontSize={11} fontWeight={700}>{text}</text>
    </g>
  );
}

function LineYamazumi({ line }: { line: LineMetricsLine }) {
  const data = line.stations.map((s) => ({ step: s.step, ct: s.ct, bottleneck: s.is_bottleneck }));
  return (
    <div className="rounded-lg border border-border p-2">
      <div className="mb-1 flex items-center justify-between px-1 text-xs">
        <span className="truncate font-medium text-foreground">{line.sub_workcenter}</span>
        <span className="whitespace-nowrap text-muted-foreground">
          <span className={cn('font-bold', lbrColor(line.lbr))}>{line.lbr ?? '—'}%</span> · {line.n0} ops · bn {line.bottleneck_step}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={168}>
        <BarChart data={data} margin={{ top: 22, right: 8, bottom: 2, left: -18 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
          <XAxis dataKey="step" interval={0} angle={-30} textAnchor="end" height={52} tick={{ fontSize: 9 }} />
          <YAxis tick={{ fontSize: 9 }} domain={[0, (max: number) => Math.ceil(max * 1.18)]} />
          <Tooltip formatter={(v: number) => [`${Number(v).toFixed(0)}s`, 'CT']} contentStyle={{ fontSize: 11 }} />
          {line.balance_line != null && (
            <ReferenceLine y={line.balance_line} stroke="#64748b" strokeDasharray="4 3"
              label={{ value: `balance ${line.balance_line}s`, position: 'insideTopRight', fontSize: 9, fill: '#64748b' }} />
          )}
          <Bar dataKey="ct" radius={[2, 2, 0, 0]}>
            <LabelList dataKey="ct" content={<CtBarLabel />} />
            {data.map((d, i) => <Cell key={i} fill={d.bottleneck ? '#f59e0b' : '#10b981'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── IPK tab — full per-line flow: every process + UPH, trolley gap between each ──
export function IpkView({ lm }: { lm: LineMetrics }) {
  const ipkLines = lm.ipk_lines ?? [];
  return (
    <div className="min-h-0 flex-1 space-y-5 overflow-auto p-4">
      <p className="text-xs text-muted-foreground">
        Total <span className="font-bold text-foreground">{lm.ipk_trolleys}</span> trolleys ·
        {' '}{lm.boards_per_trolley} boards/trolley · lot {lm.loading} · a trolley buffer sits where an upstream process outruns the next (UPH gap).
      </p>
      {ipkLines.map((line) => <IpkLineFlow key={line.sub_workcenter} line={line} />)}
      {ipkLines.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">No route steps with cycle time.</p>}
    </div>
  );
}

function IpkLineFlow({ line }: { line: IpkLine }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="mb-2 flex items-center justify-between px-1 text-xs">
        <span className="truncate font-medium text-foreground">{line.sub_workcenter}</span>
        <span className="whitespace-nowrap text-muted-foreground">
          <span className={cn('font-bold', line.trolleys > 0 ? 'text-amber-600' : 'text-emerald-600')}>{line.trolleys}</span> trolley{line.trolleys === 1 ? '' : 's'}
        </span>
      </div>
      {/* HORIZONTAL flow: station (UPH) → gap → next station.
          It was vertical, which meant a 20-station line was 20 rows of scrolling
          for what is physically a straight line on the floor. Left-to-right
          matches how the board actually travels, and a whole line now fits on
          one screen. Overflow scrolls INSIDE this box, so the page itself never
          scrolls sideways. */}
      <div className="overflow-x-auto pb-1">
        <div className="flex min-w-max items-stretch gap-1">
          {line.stations.map((s, i) => (
            <div key={i} className="flex items-stretch gap-1">
              <div className="flex min-w-[7.5rem] max-w-[11rem] flex-col justify-center rounded-md border border-border bg-card px-2.5 py-1.5">
                <span className="truncate text-[12px] font-medium text-foreground" title={s.step}>{s.step}</span>
                <span className="ct-num tabular-nums text-[10px] text-muted-foreground">{s.uph} UPH</span>
              </div>
              {i < line.buffers.length && (
                <div className="flex flex-col items-center justify-center px-0.5 text-[10px] leading-tight">
                  {line.buffers[i].trolleys > 0 ? (
                    <span title={`${line.buffers[i].ipk_units} boards waiting`}
                      className="inline-flex flex-col items-center gap-0.5 rounded-md bg-amber-500/15 px-1.5 py-1 font-semibold text-amber-600">
                      <ShoppingCart className="h-3 w-3" />
                      <span className="tabular-nums">{line.buffers[i].trolleys}</span>
                    </span>
                  ) : (
                    <span title="balanced — no buffer" className="text-emerald-600/60">→</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────────
export function MetricsGate({ q, children }: { q: ReturnType<typeof useCycleTimeLineMetrics>; children: (m: LineMetrics) => React.ReactNode }) {
  if (q.isLoading) return <Center><Loader2 className="h-5 w-5 animate-spin" /></Center>;
  if (q.isError || !q.data) return <Center><span className="text-sm text-muted-foreground">No LBR/IPK — needs complete cycle-time data.</span></Center>;
  return <>{children(q.data)}</>;
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-0 flex-1 items-center justify-center p-6">{children}</div>;
}
