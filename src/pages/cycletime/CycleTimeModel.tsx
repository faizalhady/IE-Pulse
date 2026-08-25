/**
 * CycleTimeModel.tsx
 * ──────────────────
 * Everything about ONE model, on its own page.
 *
 * Route: /cycle-time/wc/:customer/:assembly
 *
 * WHY A PAGE AND NOT JUST THE DRAWER
 *   The drawer is fine for a glance from a table row, but it cannot be linked,
 *   bookmarked, or sent to the engineer who owns the model — and "go to the
 *   cycle time page, pick the workcell, find the model, click the row" is how a
 *   question stops being asked. A model is a real entity in the domain, so it
 *   gets a real URL.
 *
 * WHY IT REUSES THE DRAWER'S VIEWS
 *   RouteView / LbrView / IpkView are imported from RouteComparisonDrawer rather
 *   than reimplemented. Two renderings of the same comparison is exactly how one
 *   workcell came to report three different Complete counts on three screens.
 *   The drawer stays for the quick look; both read the same components.
 */

import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Search } from 'lucide-react';

import { UnderlineTabs } from '@/components/shared/UnderlineTabs';
import { ExportButton } from '@/components/shared/ExportButton';
import type { ExportColumn } from '@/lib/cycle_time/exportTable';
import { cn } from '@/lib/utils';
import { cycleTimeApi } from '@/lib/cycle_time/cycleTimeApi';
import {
  useCycleTimeAssemblyBuilds,
  useCycleTimeBom,
  useCycleTimeCompletionSteps,
  useCycleTimeLineMetrics,
} from '@/hooks/cycle_time/useCycleTimeData';
import { IpkView, LbrView, MetricsGate, RouteView } from './RouteComparisonDrawer';

const TABS = [
  // Overview is gone: it restated the header — status, revision, workcenter —
  // for a reader who had just read them, and made "Cycle time" cost a click.
  { key: 'ct',       label: 'Cycle time' },
  { key: 'steps',    label: 'Steps' },
  { key: 'bom',      label: 'BOM' },
  { key: 'lbr',      label: 'LBR' },
  { key: 'ipk',      label: 'IPK' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

/** Same six answers, same colours, as every other cycle-time screen. */
const STATUS: Record<string, { label: string; cls: string }> = {
  complete:      { label: 'Complete',          cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  incomplete:    { label: 'Incomplete',        cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
  no_cycle_time: { label: 'No cycle time',     cls: 'bg-orange-500/15 text-orange-600 dark:text-orange-400' },
  not_in_iedb:   { label: 'Not in IEDB',       cls: 'bg-red-500/15 text-red-600 dark:text-red-400' },
  not_built:     { label: 'Not built yet',     cls: 'bg-sky-500/15 text-sky-600 dark:text-sky-400' },
  cannot_check:  { label: 'Cannot be checked', cls: 'bg-muted text-muted-foreground' },
};

/** One shade per LINE (sub_workcenter). A model's route hops between lines and
 *  the boundary is invisible in a flat table — you cannot see that six rows are
 *  one station and the next four are somewhere else. Assigned by order of first
 *  appearance, so the colours follow the route rather than the alphabet.
 *
 *  Shades, not hues: these are grouping bands, not statuses. Reusing the
 *  red/amber/green vocabulary here would read as a verdict on the line. */
const LINE_SHADES = [
  { bar: 'bg-sky-500',     row: 'bg-sky-500/[0.04]',     text: 'text-sky-700 dark:text-sky-400' },
  { bar: 'bg-violet-500',  row: 'bg-violet-500/[0.04]',  text: 'text-violet-700 dark:text-violet-400' },
  { bar: 'bg-teal-500',    row: 'bg-teal-500/[0.04]',    text: 'text-teal-700 dark:text-teal-400' },
  { bar: 'bg-amber-500',   row: 'bg-amber-500/[0.05]',   text: 'text-amber-700 dark:text-amber-400' },
  { bar: 'bg-rose-500',    row: 'bg-rose-500/[0.04]',    text: 'text-rose-700 dark:text-rose-400' },
  { bar: 'bg-indigo-500',  row: 'bg-indigo-500/[0.04]',  text: 'text-indigo-700 dark:text-indigo-400' },
  { bar: 'bg-lime-600',    row: 'bg-lime-500/[0.05]',    text: 'text-lime-700 dark:text-lime-400' },
  { bar: 'bg-fuchsia-500', row: 'bg-fuchsia-500/[0.04]', text: 'text-fuchsia-700 dark:text-fuchsia-400' },
];

const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
const n = (v: number | null | undefined) =>
  v === null || v === undefined ? '—' : Number(v).toLocaleString();

export default function CycleTimeModel() {
  const navigate = useNavigate();
  const { customer = '', assembly = '' } = useParams();
  const [tab, setTab] = useState<TabKey>('ct');

  // The workcell's full model list, filtered to this one. Cached and shared with
  // the workcell page, so arriving here costs no extra request in practice.
  const { data: wc, isLoading } = useQuery({
    queryKey: ['ct-universe-workcell', customer],
    queryFn: () => cycleTimeApi.universe.workcell(customer),
    staleTime: 1000 * 60 * 10,
  });
  const model = useMemo(
    () => (wc?.rows ?? []).find(r => norm(r.assembly) === norm(assembly)),
    [wc, assembly]);

  const steps = useCycleTimeCompletionSteps(customer, assembly);
  const lm = useCycleTimeLineMetrics(customer, assembly);
  const builds = useCycleTimeAssemblyBuilds(customer, assembly);

  // A model can carry several revisions and they are NOT interchangeable — a
  // step present on F0 may not exist on A0. Newest first via a numeric-aware
  // sort, because revision formats vary by customer ('A0', '10', 'REV-2').
  const revisions = useMemo(() => {
    const set = new Set((builds.data ?? [])
      .map(b => String((b as unknown as Record<string, unknown>).revision ?? ''))
      .filter(Boolean));
    return [...set].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  }, [builds.data]);
  const [rev, setRev] = useState<string | null>(null);
  const activeRev = rev && revisions.includes(rev) ? rev : revisions[0] ?? null;

  // The BOM comes from MES, the revision picker from IEDB. They do not always
  // hold the same revisions, so the server falls back and flags it rather than
  // returning an empty BOM for a model that has one.
  const bom = useCycleTimeBom(customer, assembly, activeRev);

  const meta = model?.verdict ? STATUS[model.verdict] : undefined;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border">
        <div className="flex items-start gap-3 px-6 pt-4 pb-3">
          <button
            onClick={() => navigate(`/cycle-time/${encodeURIComponent(customer)}`)}
            title="Back to the workcell"
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate font-mono text-lg font-bold">{assembly}</h1>
              {meta && (
                <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', meta.cls)}>
                  {meta.label}
                </span>
              )}
              {model?.has_cycle_time === false && (
                <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-[11px] font-medium text-orange-600 dark:text-orange-400">
                  No cycle time in IEDB
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">{customer}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 px-6">
          <UnderlineTabs tabs={TABS} active={tab} onChange={(k) => setTab(k as TabKey)} />
          {/* Drives every tab below. Hidden at one revision, because a picker
              with a single option is furniture, not a control. */}
          {revisions.length > 1 && (
            <label className="flex items-center gap-2 pb-1 text-[11px] text-muted-foreground">
              Revision
              <select
                value={activeRev ?? ''}
                onChange={(e) => setRev(e.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1 font-mono text-xs text-foreground"
              >
                {revisions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <span className="text-muted-foreground/60">of {revisions.length}</span>
            </label>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : tab === 'ct' ? (
          <CycleTimeTab q={builds} revision={activeRev} />
        ) : tab === 'steps' ? (
          <RouteView q={steps} />
        ) : tab === 'bom' ? (
          <BomTab q={bom} />
        ) : tab === 'lbr' ? (
          <MetricsGate q={lm}>{(m) => <LbrView lm={m} />}</MetricsGate>
        ) : (
          <MetricsGate q={lm}>{(m) => <IpkView lm={m} />}</MetricsGate>
        )}
      </div>
    </div>
  );
}

/**
 * The MES BOM for this model — what actually goes onto the board.
 *
 * WHY THE EMPTY STATES ARE THREE AND NOT ONE
 *   "No BOM" hides which of three different things happened, and they need
 *   different people to fix them:
 *     - the assembly is not in MES at all            -> a naming/mapping problem
 *     - MES has it but no BOM was ever loaded        -> nothing we can do; all of
 *       LAMGB and ~26% of MES look like this, and it is not an error
 *     - the mart has not been pulled yet             -> run the pipeline
 *   Collapsing them into one grey message is how "the BOM tab is broken" gets
 *   reported for a model whose BOM genuinely does not exist.
 */
/** BOM lines as MES holds them. Kept loose on the value types — this table is
 *  rendered straight from the API rows, so the export mirrors it rather than
 *  re-deriving anything. */
const BOM_COLS: ExportColumn<Record<string, unknown>>[] = [
  { key: 'material',    header: 'Material',     width: 22, get: r => r.material ?? '' },
  { key: 'description', header: 'Description',  width: 46, get: r => r.description ?? '' },
  { key: 'qty',         header: 'Qty',          width: 10, numFmt: '#,##0.###', get: r => r.qty ?? null },
  { key: 'uom',         header: 'UOM',          width: 9,  get: r => r.uom ?? '' },
  { key: 'ref_des',     header: 'Ref des',      width: 30, get: r => r.ref_des ?? '' },
  { key: 'item_no',     header: 'Item no',      width: 11, get: r => r.item_no ?? null },
];

function BomTab({ q }: { q: ReturnType<typeof useCycleTimeBom> }) {
  const { data, isLoading, error } = q;
  const [find, setFind] = useState('');

  const rows = useMemo(() => {
    const all = data?.materials ?? [];
    const k = find.trim().toUpperCase();
    if (!k) return all;
    return all.filter(m =>
      String(m.material ?? '').toUpperCase().includes(k) ||
      String(m.description ?? '').toUpperCase().includes(k));
  }, [data, find]);

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }
  if (error) {
    return <div className="p-6 text-sm text-rose-600">{(error as Error).message}</div>;
  }
  // Checked BEFORE in_mes/has_bom: without the bridge every model looks like a
  // model MES has no BOM for, and that reads as a fact about MES rather than a
  // pipeline that has not run here yet.
  if (data && !data.bridge_ready) {
    return <div className="p-8 text-center text-sm text-muted-foreground">
      BOMs are not available on this server yet — the MES assembly map has not been
      rebuilt with its BOM ids. Nothing is wrong with this model.
    </div>;
  }
  if (!data?.in_mes) {
    return <div className="p-8 text-center text-sm text-muted-foreground">
      This assembly is not in MES under this name, so there is no BOM to read.
    </div>;
  }
  if (!data.has_bom) {
    return <div className="p-8 text-center text-sm text-muted-foreground">
      MES has this assembly but no BOM was ever loaded for it.
    </div>;
  }
  // A real BOM we simply have not fetched. Saying "no BOM" here would blame MES
  // for our own pull scope, and send someone to fix a BOM that is already fine.
  if (!data.in_mart) {
    return <div className="p-8 text-center text-sm text-muted-foreground">
      MES has BOM <span className="font-mono text-foreground">{data.bom_id}</span> for this model,
      but we have not pulled its materials yet — the mart currently covers the planner list only.
    </div>;
  }

  const total = data.materials.length;
  return (
    <div className="space-y-3 overflow-x-auto p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px]">
        <span className="text-muted-foreground">
          BOM <span className="font-mono font-medium text-foreground">{data.bom_id}</span>
        </span>
        <span className="text-muted-foreground">
          rev <span className="font-mono font-medium text-foreground">{data.revision}</span>
        </span>
        <span className="text-muted-foreground">
          <span className="font-medium text-foreground">{total.toLocaleString()}</span> materials
        </span>
        {/* MES reuses one BOM across revisions. Saying so stops an engineer
            hunting for a difference that does not exist. */}
        {data.revisions.filter(r => r.bom_id === data.bom_id).length > 1 && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
            shared by rev{' '}
            {data.revisions.filter(r => r.bom_id === data.bom_id).map(r => r.revision).join(', ')}
          </span>
        )}
        {/* The picker asked for a revision MES does not have. */}
        {data.revision_matched === false && data.requested_revision && (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-medium text-amber-700 dark:text-amber-400">
            MES has no rev {data.requested_revision} — showing {data.revision}
          </span>
        )}
        <label className="relative ml-auto">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <input
            value={find}
            onChange={(e) => setFind(e.target.value)}
            placeholder="Filter material or description"
            className="w-56 rounded-md border border-border bg-background py-1 pl-7 pr-2 text-xs text-foreground placeholder:text-muted-foreground"
          />
        </label>
        {/* `rows` is the filtered list the table draws next. */}
        <ExportButton
          rows={rows}
          columns={BOM_COLS}
          filename={`bom_${data.assembly ?? 'model'}`}
          sheetName="BOM"
          title={`BOM — ${data.assembly ?? ''}${data.revision ? ` rev ${data.revision}` : ''}`}
          subtitle={[
            data.revision_matched === false && data.requested_revision
              ? `MES has no rev ${data.requested_revision} — showing ${data.revision}` : '',
            find.trim() ? `Filtered by "${find.trim()}"` : '',
          ].filter(Boolean).join(' · ')}
          scopeNote={rows.length !== (data.materials?.length ?? 0)
            ? `filtered from ${(data.materials?.length ?? 0).toLocaleString()}` : undefined}
        />
      </div>

      <table className="w-full text-xs">
        <thead className="bg-muted/50 text-left">
          <tr className="[&>th]:whitespace-nowrap [&>th]:px-3 [&>th]:py-2 [&>th]:font-medium">
            <th className="text-right">#</th>
            <th>Material</th>
            <th>Description</th>
            <th className="text-right">Qty</th>
            <th className="text-right">Level</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 1000).map((m, i) => (
            <tr key={m.bom_material_id ?? i}
                className="border-t border-border [&>td]:px-3 [&>td]:py-1.5">
              <td className="text-right tabular-nums text-muted-foreground/60">{i + 1}</td>
              <td className="whitespace-nowrap font-mono font-medium">{m.material ?? '—'}</td>
              <td className="text-muted-foreground">{m.description ?? '—'}</td>
              <td className="whitespace-nowrap text-right font-semibold tabular-nums">{n(m.qty)}</td>
              <td className="whitespace-nowrap text-right tabular-nums text-muted-foreground">{m.bom_level ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {!rows.length && (
        <div className="p-6 text-center text-sm text-muted-foreground">
          No material matches "{find}".
        </div>
      )}
      {rows.length > 1000 && (
        <div className="pt-2 text-[11px] text-muted-foreground">
          showing the first 1,000 of {rows.length.toLocaleString()} rows
        </div>
      )}
    </div>
  );
}

/** The IEDB cycle times themselves, per step, for every routing this model has. */
/** The IEDB route as stored: one row per step, in route order. mach/imt/hand
 *  go out as raw seconds so the reader can do their own arithmetic in Excel —
 *  the same reason the original pivoted export does it. */
const STEP_COLS: ExportColumn<Record<string, unknown>>[] = [
  { key: 'revision',       header: 'Rev',        width: 10, get: r => r.revision ?? '' },
  { key: 'sub_workcenter', header: 'Line',       width: 26, get: r => r.sub_workcenter ?? '' },
  { key: 'step_order',     header: 'Order',      width: 9,  numFmt: '#,##0', get: r => r.step_order ?? null },
  { key: 'alias',          header: 'Alias',      width: 18, get: r => r.alias ?? '' },
  { key: 'process',        header: 'Process',    width: 30, get: r => r.process ?? '' },
  { key: 'mach',           header: 'Mach (s)',   width: 11, numFmt: '#,##0.00', get: r => r.mach ?? null },
  { key: 'imt',            header: 'IMT (s)',    width: 11, numFmt: '#,##0.00', get: r => r.imt ?? null },
  { key: 'hand',           header: 'Hand (s)',   width: 11, numFmt: '#,##0.00', get: r => r.hand ?? null },
  { key: 'lct',            header: 'LCT (s)',    width: 11, numFmt: '#,##0.00', get: r => r.lct ?? null },
  { key: 'hc',             header: 'HC',         width: 8,  numFmt: '#,##0.##', get: r => r.hc ?? null },
  { key: 'cap',            header: 'Cap',        width: 8,  numFmt: '#,##0', get: r => r.cap ?? null },
  { key: 'sampling',       header: 'S %',        width: 8,  numFmt: '#,##0.#', get: r => r.sampling ?? null },
  { key: 'fpy',            header: 'FPY',        width: 9,  numFmt: '#,##0.##', get: r => r.fpy ?? null },
  { key: 'updated_on',     header: 'Updated',    width: 13,
    get: r => (r.updated_on ? String(r.updated_on).slice(0, 10) : '') },
];

function CycleTimeTab({ q, revision }: {
  q: ReturnType<typeof useCycleTimeAssemblyBuilds>; revision: string | null;
}) {
  const { data, isLoading, error } = q;
  if (isLoading) {
    return <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }
  if (error) {
    return <div className="p-6 text-sm text-rose-600">{(error as Error).message}</div>;
  }
  const all = data ?? [];
  // Only the selected revision. Mixing revisions in one list silently implies
  // they share a route, and they frequently do not.
  const rows = revision
    ? all.filter(r => String((r as unknown as Record<string, unknown>).revision ?? '') === revision)
    : all;
  if (!all.length) {
    return <div className="p-8 text-center text-sm text-muted-foreground">
      IEDB has no cycle time for this model. Nothing to show here until someone times it.
    </div>;
  }
  // Route order. IEDB stores the order per routing, and reading a route out of
  // sequence makes it impossible to follow.
  const sorted = [...rows].sort((a, b) => {
    const x = a as unknown as Record<string, number | string | null>;
    const y = b as unknown as Record<string, number | string | null>;
    return Number(x.step_order ?? 1e9) - Number(y.step_order ?? 1e9);
  });

  // Line -> shade, in route order of first appearance.
  const shadeOf = new Map<string, typeof LINE_SHADES[number]>();
  for (const r of sorted) {
    const line = String((r as unknown as Record<string, unknown>).sub_workcenter ?? '—');
    if (!shadeOf.has(line)) shadeOf.set(line, LINE_SHADES[shadeOf.size % LINE_SHADES.length]);
  }

  return (
    <div className="space-y-3 overflow-x-auto p-4">
      <div className="flex items-center">
        {/* `sorted` is the route in IEDB's own step order — the same sequence
            the table shows, because a route read out of sequence is unusable. */}
        <ExportButton
          className="ml-auto"
          rows={sorted as unknown as Record<string, unknown>[]}
          columns={STEP_COLS}
          filename="cycle_time_steps"
          sheetName="Cycle time"
          title="Cycle Time — Route steps"
          subtitle={revision ? `Revision ${revision}` : 'All revisions'}
          scopeNote={rows.length !== all.length
            ? `filtered from ${all.length.toLocaleString()}` : undefined}
        />
      </div>

      {/* Legend: which colour is which line, and how many steps each holds. */}
      {shadeOf.size > 1 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
          {[...shadeOf.entries()].map(([line, sh]) => (
            <span key={line} className="flex items-center gap-1.5">
              <span className={cn('h-2.5 w-2.5 rounded-sm', sh.bar)} />
              <span className={cn('font-medium', sh.text)}>{line}</span>
              <span className="text-muted-foreground">
                {sorted.filter(r => String((r as unknown as Record<string, unknown>).sub_workcenter ?? '—') === line).length}
              </span>
            </span>
          ))}
        </div>
      )}
      <table className="w-full text-xs">
        <thead className="bg-muted/50 text-left">
          <tr className="[&>th]:whitespace-nowrap [&>th]:px-3 [&>th]:py-2 [&>th]:font-medium">
            <th>Rev</th><th>Line</th>
            {/* The ALIAS — IEDB's own name for the step, and the key everything
                else joins on. `step` is COALESCE(alias, process) server-side. */}
            <th>Alias</th>
            {/* THE cycle time. Everything to its right is a component of it —
                showing only the components (and not this) is what made the table
                look like it was ignoring IEDB entirely. */}
            <th className="text-right">Cycle time (s)</th>
            <th className="text-right">Mach</th><th className="text-right">IMT</th>
            <th className="text-right">Hand</th><th className="text-right">LCT</th>
            <th className="text-right">HC</th><th className="text-right">Cap</th>
            <th className="text-right">S%</th>
          </tr>
        </thead>
        <tbody>
          {sorted.slice(0, 500).map((r, i) => {
            const x = r as unknown as Record<string, number | string | null>;
            const line = String(x.sub_workcenter ?? '—');
            const sh = shadeOf.get(line) ?? LINE_SHADES[0];
            // Only the FIRST row of a run prints the line name and the colour
            // bar. Repeating it on every row is what buries the boundary.
            const prev = i > 0
              ? String((sorted[i - 1] as unknown as Record<string, unknown>).sub_workcenter ?? '—')
              : null;
            const isFirst = line !== prev;
            return (
              <tr key={i} className={cn('border-border [&>td]:whitespace-nowrap [&>td]:px-3 [&>td]:py-1.5',
                sh.row, isFirst ? 'border-t-2 border-t-border' : 'border-t')}>
                <td className="font-mono">{x.revision ?? '—'}</td>
                <td className={cn('relative', isFirst ? cn('font-medium', sh.text) : 'text-muted-foreground/40')}>
                  <span className={cn('absolute inset-y-0 left-0 w-1', sh.bar)} />
                  {isFirst ? line : '↳'}
                </td>
                <td className="font-medium">{x.step ?? '—'}</td>
                <td className="text-right font-semibold tabular-nums">{n(x.seconds as number)}</td>
                <td className="text-right tabular-nums text-muted-foreground">{n(x.mach as number)}</td>
                <td className="text-right tabular-nums text-muted-foreground">{n(x.imt as number)}</td>
                <td className="text-right tabular-nums text-muted-foreground">{n(x.hand as number)}</td>
                <td className="text-right tabular-nums text-muted-foreground">{n(x.lct as number)}</td>
                <td className="text-right tabular-nums text-muted-foreground">{n(x.hc as number)}</td>
                <td className="text-right tabular-nums text-muted-foreground">{n(x.cap as number)}</td>
                <td className="text-right tabular-nums text-muted-foreground">{n(x.sampling as number)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length > 500 && (
        <div className="pt-2 text-[11px] text-muted-foreground">
          showing the first 500 of {rows.length.toLocaleString()} rows
        </div>
      )}
    </div>
  );
}
