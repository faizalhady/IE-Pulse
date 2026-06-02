/**
 * CycleTimeAssemblyDrawer.tsx
 * ───────────────────────────
 * Self-contained right drawer for one assembly — shared by the Breakdown tab
 * (click an assembly row) and the Table tab (click a build row, opens with that
 * build pre-selected via `initialBuild`).
 *
 * It fetches everything it needs from the assembly name:
 *   • /assemblies?assembly=… → accurate header stats (Total CT + SMT/TH/BE)
 *   • /data?assembly=…       → the per-build process detail (waterfall)
 *
 * Content: header stats, a build picker grouped by workcenter (SMT/TH/BE), and
 * the selected build's process routing as a cycle-time waterfall.
 */

import { Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Sheet, SheetContent } from '@/components/ui/sheet';
import {
  useCycleTimeAliases,
  useCycleTimeAssemblies,
  useCycleTimeData,
} from '@/hooks/cycle_time/useCycleTimeData';
import {
  CycleTimeAliasMap,
  CycleTimePivotedRow,
  formatBuildDuration,
  formatCycleHMS,
  formatCycleSecondsLabel,
  processColumnsOf,
} from '@/lib/cycle_time/cycleTimeApi';
import { cn } from '@/lib/utils';

export interface DrawerBuildRef { revision: string; line: string }

interface Step { name: string; seconds: number }
interface Build { revision: string; line: string; workcenter: string; total: number; steps: Step[] }

/** Workcenter display order + colours (SMT → TH → BE = the build flow). */
const WORKCENTERS: { code: string; label: string; bar: string }[] = [
  { code: 'SMT', label: 'SMT',          bar: 'bg-emerald-500' },
  { code: 'TH',  label: 'Through Hole', bar: 'bg-sky-500' },
  { code: 'BE',  label: 'Backend',      bar: 'bg-violet-500' },
];

interface Props {
  customer: string | undefined;
  /** The open assembly (null = closed). */
  assembly: string | null;
  /** Optional build to pre-select (e.g. the row clicked in the Table tab). */
  initialBuild?: DrawerBuildRef;
  onClose: () => void;
}

export default function CycleTimeAssemblyDrawer({ customer, assembly, initialBuild, onClose }: Props) {
  // Gate every fetch on the drawer being open for this assembly.
  const scoped = assembly ? customer : undefined;
  const aggQ    = useCycleTimeAssemblies(scoped, undefined, assembly || undefined);
  const detailQ = useCycleTimeData(assembly ? { customer, assembly } : { customer: undefined });
  const { data: aliasMap } = useCycleTimeAliases(scoped);

  const a = aggQ.data?.[0];

  const builds = useMemo<Build[]>(() => {
    if (!assembly || !detailQ.data) return [];
    const rows = (detailQ.data as CycleTimePivotedRow[]).filter((r) => r.assembly === assembly);
    const procCols = processColumnsOf(rows);
    const out: Build[] = [];
    for (const row of rows) {
      const steps: Step[] = [];
      let total = 0;
      for (const p of procCols) {
        const v = row[p];
        if (typeof v === 'number' && !Number.isNaN(v)) { steps.push({ name: p, seconds: v }); total += v; }
      }
      if (steps.length === 0) continue;
      steps.sort((x, y) => y.seconds - x.seconds);
      out.push({ revision: row.revision, line: row.sub_workcenter, workcenter: String(row.workcenter ?? ''), total, steps });
    }
    return out.sort((x, y) => y.total - x.total);
  }, [assembly, detailQ.data]);

  const [sel, setSel] = useState(0);
  // Select the requested build once detail loads (else the longest).
  useEffect(() => {
    if (builds.length === 0) return;
    if (initialBuild) {
      const i = builds.findIndex((b) => b.revision === initialBuild.revision && b.line === initialBuild.line);
      setSel(i >= 0 ? i : 0);
    } else {
      setSel(0);
    }
  }, [builds, initialBuild]);

  const build = builds[Math.min(sel, Math.max(0, builds.length - 1))];
  const maxStep = build?.steps[0]?.seconds ?? 0;
  const detailLoading = detailQ.isFetching && builds.length === 0;

  // Build chips grouped under SMT / TH / BE (keeping their index in `builds`).
  const pickerGroups = useMemo(() => {
    const known = new Set(WORKCENTERS.map((w) => w.code));
    const groups = WORKCENTERS.map((wc) => ({
      code: wc.code, label: wc.label, bar: wc.bar,
      items: builds.map((b, i) => ({ b, i })).filter((x) => x.b.workcenter === wc.code),
    })).filter((g) => g.items.length > 0);
    const other = builds.map((b, i) => ({ b, i })).filter((x) => !known.has(x.b.workcenter));
    if (other.length) groups.push({ code: 'OTHER', label: 'Other', bar: 'bg-muted-foreground/40', items: other });
    return groups;
  }, [builds]);

  const family = a?.family ?? null;

  return (
    <Sheet open={!!assembly} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-[460px] overflow-y-auto p-0 sm:max-w-[460px]">
        {assembly && (
          <div className="flex h-full flex-col">
            {/* header */}
            <div className="border-b border-border px-5 pb-4 pt-5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Assembly</p>
              <h2 className="mt-0.5 font-mono text-lg font-bold text-foreground">{assembly}</h2>
              {family && <p className="text-xs text-muted-foreground">{family}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                <Stat label="Total CT" value={a ? formatBuildDuration(a.total ?? 0) : '…'} />
                <Stat label="SMT" value={a ? wcVal(a.smt) : '…'} valueClass={a?.smt ? 'text-emerald-400' : undefined} />
                <Stat label="TH"  value={a ? wcVal(a.th)  : '…'} valueClass={a?.th  ? 'text-sky-400'     : undefined} />
                <Stat label="BE"  value={a ? wcVal(a.be)  : '…'} valueClass={a?.be  ? 'text-violet-400'  : undefined} />
                <Stat label="Builds" value={a ? String(a.builds) : '…'} />
              </div>
            </div>

            {detailLoading ? (
              <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading process breakdown…
              </div>
            ) : !build ? (
              <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
                No per-process detail available for this assembly.
              </div>
            ) : (
              <>
                {/* build picker — grouped by workcenter (only when >1 build) */}
                {builds.length > 1 && (
                  <div className="space-y-2 border-b border-border px-5 py-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {builds.length} builds · pick one to inspect
                    </p>
                    {pickerGroups.map((g) => (
                      <div key={g.code}>
                        <p className="mb-1 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                          <span className={cn('h-1.5 w-1.5 rounded-full', g.bar)} /> {g.label} · {g.items.length}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {g.items.map(({ b, i }) => (
                            <button
                              key={`${b.revision}|${b.line}|${i}`}
                              onClick={() => setSel(i)}
                              className={cn(
                                'rounded-md border px-2 py-1 text-left text-[10px] transition-colors',
                                i === sel
                                  ? 'border-emerald-500 bg-emerald-500/10 text-foreground'
                                  : 'border-border text-muted-foreground hover:bg-muted/40',
                              )}
                              title={b.line}
                            >
                              <span className="font-mono font-semibold">{formatBuildDuration(b.total)}</span>
                              <span className="ml-1 opacity-70">rev {b.revision || '—'}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* selected build context */}
                <div className="px-5 pt-4">
                  <div className="flex items-baseline justify-between">
                    <p className="text-xs font-semibold text-foreground">Where the time goes</p>
                    <p className="font-mono text-xs text-muted-foreground" title={formatCycleHMS(build.total)}>
                      {formatBuildDuration(build.total)} total
                    </p>
                  </div>
                  <p className="mt-0.5 truncate text-[10px] text-muted-foreground" title={build.line}>
                    rev {build.revision || '—'} · {build.line} · {build.steps.length} steps
                  </p>
                </div>

                {/* process waterfall */}
                <div className="flex-1 overflow-y-auto px-5 py-3">
                  <div className="space-y-1.5">
                    {build.steps.map((s, i) => {
                      const pctOfTotal = build.total > 0 ? (s.seconds / build.total) * 100 : 0;
                      const barPct = maxStep > 0 ? (s.seconds / maxStep) * 100 : 0;
                      const isBottleneck = i === 0;
                      const info = aliasMap?.[s.name] as CycleTimeAliasMap[string] | undefined;
                      const tip = info?.processes?.length ? `Alias: ${s.name}\nProcess: ${info.processes.join(', ')}` : s.name;
                      return (
                        <div key={s.name}>
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="flex min-w-0 items-center gap-1.5">
                              {isBottleneck && <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400" />}
                              <span className="truncate text-[11px] font-medium text-foreground" title={tip}>{s.name}</span>
                            </span>
                            <span className="flex flex-shrink-0 items-baseline gap-1.5 font-mono tabular-nums">
                              <span className="text-[11px] text-foreground" title={formatCycleHMS(s.seconds)}>{formatCycleSecondsLabel(s.seconds)}</span>
                              <span className="text-[9px] text-muted-foreground">{pctOfTotal.toFixed(0)}%</span>
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted/40">
                            <div
                              className={cn('h-full rounded-full', isBottleneck ? 'bg-amber-400' : 'bg-emerald-500/70')}
                              style={{ width: `${barPct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function wcVal(v: number | null | undefined): string {
  return v && v > 0 ? formatBuildDuration(v) : '—';
}

function Stat({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn('mt-0.5 font-mono text-sm font-bold tabular-nums', valueClass ?? 'text-foreground')}>{value}</p>
    </div>
  );
}
