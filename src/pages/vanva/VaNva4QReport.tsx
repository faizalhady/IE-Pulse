/**
 * VaNva4QReport.tsx
 * ─────────────────
 * The VA/NVA 4Q — same shell as the OLE and Cycle Time 4Qs, different story.
 *
 *   Q1  where we stand      plant NVA % by month vs target, the last 12 months
 *   Q2  where it is going   heads to cut by workcell, averaged over the last 3
 *                           months (OLE's "avg of the last 4 weeks", in months),
 *                           then the top 3 by heads and the top 3 by NVA %
 *   Q3  what we will do     the improvement plan (saved; everything else is live)
 *   Q4  the 100% view       the NVA % tracker, workcell × month
 *
 * VA/NVA has no loss categories — the only dimension is the workcell. So the
 * "loss" is NVA heads above target, the Pareto is by workcell, and the plan is
 * written against the two biggest owners, exactly where OLE writes it against
 * its two biggest man-hour buckets.
 *
 * The report is pinned to a MONTH and a TARGET (both part of the saved scope),
 * but Q1/Q2/Q4 still rebuild from the datasets on every open — only the plan
 * is persisted, same as the other two.
 *
 * Route: /va-nva/4q
 */

import { FourQPreview } from '@/components/shared/FourQPreview';
import type { ActionItem } from '@/components/shared/ImprovementPlan';
import { ImprovementEditor, ImprovementTable } from '@/components/shared/ImprovementPlan';
import { ParetoChart, buildPareto } from '@/components/shared/ParetoChart';
import { Quadrant } from '@/components/shared/Quadrant';
import { ReportDrawer } from '@/components/shared/ReportDrawer';
import { ReportStartScreen } from '@/components/shared/ReportStartScreen';
import { ScopeFields } from '@/components/shared/ScopePicker';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useVaNvaDatasets } from '@/hooks/va_nva/useVaNvaData';
import { useSavedReport } from '@/hooks/shared/useSavedReport';
import { savedReports } from '@/lib/shared/savedReportsApi';
import { cn } from '@/lib/utils';
import { countable } from '@/lib/va_nva/vanvaCalc';
import { NVA_TARGET, VANVA_STATUS_HEX, getVaNvaStatus, pct } from '@/lib/va_nva/vanvaConstants';
import {
  Q1_MONTHS, Q2_MONTHS, monthlyTrend, nvaTracker, threeMonthAverage, type WorkcellAvg,
} from '@/lib/va_nva/vanvaFourQ';
import { NoMonthsYet, NvaHeadline, NvaTrackerTable, Q1Trend } from '@/pages/vanva/VaNvaFourQuadrant';
import { TargetControl, fmtPeriod } from '@/pages/vanva/VaNvaSizingKit';
import { ChevronLeft, Loader2, Pencil, Save, Scale } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

// Module scope, not per-render: the factory returns a fresh object each call.
const reportsApi = savedReports('va_nva', '4q');

type ReportScope = { workcells: string[]; period?: string; target?: number };
type SavedPlan = { actions: ActionItem[]; scope?: ReportScope; title?: string };

/** "4Q Report 08-10-26" — MM-DD-YY, the same name shape as the other two 4Qs. */
function defaultReportTitle(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `4Q Report ${p(d.getMonth() + 1)}-${p(d.getDate())}-${String(d.getFullYear()).slice(-2)}`;
}

/** ScopePicker thinks in plants. The workbook has none, so: one group. */
const ONE_PLANT = 'all';

export default function VaNva4QReport() {
  const location = useLocation();
  const [tab, setTab] = useState<'start' | 'editor'>('start');
  // Re-navigating here (sidebar click while already on it) returns to the start screen.
  useEffect(() => { setTab('start'); }, [location.key]);

  const [title, setTitle] = useState(defaultReportTitle);
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleBeforeEdit, setTitleBeforeEdit] = useState('');
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [target, setTarget] = useState(NVA_TARGET);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(true);
  const [scopeNote, setScopeNote] = useState('');

  const { data: datasets = [], isLoading } = useVaNvaDatasets();
  const periods = useMemo(() => [...new Set(datasets.map(d => d.period))].sort().reverse(), [datasets]);
  /** The report always runs on the latest month on record — the scope UI has no
   *  month picker, so a saved report reopens on today's data, not the data it
   *  was written against. Month browsing lives on the sizing pages. */
  const period = periods[0];
  /** Every workcell that can be sized in a month — same rows the sizing page lists. */
  const workcellsIn = (p?: string) => {
    const d = datasets.find(x => x.period === p);
    return d ? countable(d.rows).filter(r => r.nvaMfg !== null).map(r => r.workcell) : [];
  };
  const allWorkcells = useMemo(() => workcellsIn(period), [datasets, period]); // eslint-disable-line react-hooks/exhaustive-deps

  // The Settings tab edits a DRAFT (target, workcells) and applies on "Update",
  // same as OLE. The draft follows the applied scope whenever that changes
  // (load, update, new report).
  const [draft, setDraft] = useState({ picked: [] as string[], target: NVA_TARGET });
  useEffect(() => { setDraft({ picked, target }); }, [picked, target]);
  const draftWorkcells = allWorkcells;
  const draftIsApplied = draft.target === target
    && [...draft.picked].sort().join('|') === [...picked].sort().join('|');

  const trend = useMemo(() => period ? monthlyTrend(datasets, period, target, picked) : [], [datasets, period, target, picked]);
  const tracker = useMemo(() => period ? nvaTracker(datasets, period, target, picked) : null, [datasets, period, target, picked]);

  /* Q2 — three Paretos, same arrangement as OLE's and Cycle Time's.
       1. heads to cut by workcell, AVERAGED over the last 3 months
       2. top 3 workcells by those heads         (the volume lens)
       3. top 3 workcells by NVA % over the same months (the ratio lens —
          a 7-head COHU at 39% never shows up by heads, but it is a problem)
     Whole heads, because that is the work list. Averaged over three months so
     one odd upload does not pick the plan's issues, the way OLE averages four
     weeks instead of reading the latest one. */
  const q2 = useMemo(() => {
    const avg = period ? threeMonthAverage(datasets, period, target, picked) : [];
    const color = (r: number) => VANVA_STATUS_HEX[getVaNvaStatus(r)];
    const item = (a: WorkcellAvg) => ({ name: a.workcell, value: +a.reduce.toFixed(1), color: color(a.nvaRatio) });
    // Top 5 get a bar each; the tail of one-head workcells collapses into one so
    // an 18-bar Pareto stays legible on the sheet (six bars, the same count as
    // Cycle Time's). The plan's two issues come from the full ranking, never
    // from "Other".
    const TOP = 5;
    const head = avg.slice(0, TOP).map(item);
    const rest = avg.slice(TOP).reduce((s, a) => s + a.reduce, 0);
    const dist = buildPareto(rest > 0
      ? [...head, { name: `Other (${avg.length - TOP})`, value: +rest.toFixed(1), color: '#94a3b8' }]
      : head);
    const p2 = buildPareto(avg.slice(0, 3).map(item));
    const p3 = buildPareto([...avg].sort((x, y) => y.nvaRatio - x.nvaRatio).slice(0, 3)
      .map(a => ({ name: a.workcell, value: +(a.nvaRatio * 100).toFixed(1), color: color(a.nvaRatio) })));
    const avgReduce = avg.reduce((s, a) => s + a.reduce, 0);
    const ranked = avg.filter(a => a.reduce > 0);
    return { dist, p2, p3, avgReduce, top1: ranked[0]?.workcell ?? '', top2: ranked[1]?.workcell ?? '' };
  }, [datasets, period, target, picked]);

  // The two biggest owners are what the plan is written against. Taken from the
  // Q2 Pareto so the chart and the plan can never name different workcells.
  const issues = useMemo(() => [q2.top1, q2.top2].filter(Boolean), [q2]);

  const planFingerprint = useMemo(() => JSON.stringify({ actions, title }), [actions, title]);

  const saved = useSavedReport<SavedPlan>({
    api: reportsApi,
    name: title,
    payload: { actions, scope: { workcells: picked, period, target }, title },
    dirtyKey: planFingerprint,
    autosave: tab === 'editor',
  });
  const { user, savedList, autoState, saveMsg, dirty } = saved;

  async function handleLoadSaved(id: number) {
    try {
      const rec = await saved.load(id);
      if (!rec) return;
      const loadedActions = rec.payload?.actions ?? [];
      const loadedTitle = rec.payload?.title ?? title;
      setActions(loadedActions);
      if (rec.payload?.title) setTitle(rec.payload.title);
      saved.markSaved(JSON.stringify({ actions: loadedActions, title: loadedTitle }));

      const sc = rec.payload?.scope;
      setTarget(sc?.target ?? NVA_TARGET);

      // A saved scope can name workcells no longer in the sheet. Drop them, SAY
      // which, and open the report anyway — silently empty charts are worse.
      const wanted = sc?.workcells ?? [];
      const known = wanted.filter(w => allWorkcells.includes(w));
      const gone = wanted.filter(w => !allWorkcells.includes(w));
      setPicked(known);
      const notes = [
        gone.length ? `Ignored ${gone.length} workcell(s) no longer in the data: ${gone.join(', ')}` : '',
        sc?.period && sc.period !== period ? `Saved against ${fmtPeriod(sc.period)} — showing ${fmtPeriod(period)}, the latest on record` : '',
      ].filter(Boolean);
      setScopeNote(notes.join(' · '));
      setTab('editor');
    } catch (e) {
      console.error(e);
      saved.setSaveMsg(e instanceof Error ? e.message : 'Load failed');
    }
  }

  const preview = tracker && trend.length > 0 && (
    <FourQPreview
      title={title}
      brand="JABIL VA / NVA 4Q"
      headings={['First Quadrant - NVA Trend', 'Second Quadrant - Pareto Three Months',
        'Fourth Quadrant - NVA % Tracker', 'Third Quadrant - Improvement Plan']}
      quadrants={[
        <Q1Trend trend={trend} target={target} height="100%" />,
        <div className="flex h-full min-h-0 gap-2">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <ParetoChart title={`Heads to Cut by Workcell (avg/month, last ${Q2_MONTHS})`} data={q2.dist}
              fillHeight unit="Heads" unitLabel="heads" emptyText="Nothing over target in this scope." />
          </div>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
            <ParetoChart title="Top 3 Workcells - Heads to Cut" data={q2.p2} fillHeight unit="Heads" unitLabel="heads" />
            <ParetoChart title="Top 3 Workcells - NVA %" data={q2.p3} fillHeight unit="NVA %" unitLabel="%" />
          </div>
        </div>,
        <NvaTrackerTable t={tracker} target={target} isPrint />,
        <ImprovementTable actions={actions} issues={issues} isPrint />,
      ]}
    />
  );

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  const scopeLine = `${picked.length ? `${picked.length} workcells` : 'All workcells'} · ${period ? fmtPeriod(period) : '—'} · target ${pct(target, 0)}`;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="relative flex flex-shrink-0 items-center justify-between border-b border-border bg-card px-6 py-4">
        <div className="flex items-center gap-3">
          {tab === 'editor' && (
            <button onClick={() => setTab('start')} title="Back to start"
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground">
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
              VA / NVA 4Q
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                Testing Phase
              </span>
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {tab === 'start' ? 'Create a new report or open a saved one' : `Scope: ${scopeLine}`}
            </p>
          </div>
        </div>

        {tab === 'editor' && (
          <div className="absolute left-1/2 max-w-[38%] -translate-x-1/2">
            {titleEditing ? (
              <input autoFocus value={title} onChange={e => setTitle(e.target.value)}
                onBlur={() => { if (!title.trim()) setTitle(defaultReportTitle()); setTitleEditing(false); }}
                onKeyDown={e => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  if (e.key === 'Escape') { setTitle(titleBeforeEdit); setTitleEditing(false); }
                }}
                className="w-full min-w-[20rem] border-b-2 border-primary bg-transparent px-2 py-1 text-center text-lg font-semibold text-foreground outline-none" />
            ) : (
              <button onClick={() => { setTitleBeforeEdit(title); setTitleEditing(true); }}
                title="Click to rename this report"
                className="group flex max-w-full items-center gap-2 rounded-md px-2 py-1 text-lg font-semibold text-foreground transition-colors hover:bg-muted/60">
                <span className="truncate">{title}</span>
                <Pencil className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/50 transition-colors group-hover:text-muted-foreground" />
              </button>
            )}
          </div>
        )}

        {tab === 'editor' && (
          <div className="flex items-center gap-2">
            {saveMsg && <span className="text-[11px] text-muted-foreground">{saveMsg}</span>}
            {user ? (
              <span aria-live="polite"
                title={autoState === 'error' ? 'Autosave failed - retrying every 5s' : undefined}
                className={cn('flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium',
                  autoState === 'error' ? 'bg-red-500/10 text-red-500'
                    : autoState === 'saving' ? 'bg-muted text-muted-foreground'
                      : dirty ? 'bg-amber-400/15 text-amber-600 dark:text-amber-400'
                        : 'text-muted-foreground')}>
                <span className={cn('h-1.5 w-1.5 rounded-full',
                  autoState === 'error' ? 'bg-red-500'
                    : autoState === 'saving' ? 'animate-pulse bg-muted-foreground'
                      : dirty ? 'bg-amber-500' : 'bg-emerald-500')} />
                {autoState === 'error' ? 'Retrying save...'
                  : autoState === 'saving' ? 'Saving...' : dirty ? 'Unsaved changes' : 'Saved'}
              </span>
            ) : (
              <div className="relative">
                <Button onClick={saved.save} variant={dirty ? 'default' : 'outline'} size="sm" className="gap-2"
                  title="Autosave is off until we can identify you - click to save">
                  <Save className="h-4 w-4" />{dirty ? 'Save' : 'Saved'}
                </Button>
                {dirty && <span aria-label="Unsaved changes"
                  className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-card" />}
              </div>
            )}
            {preview}
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {tab === 'start' && (
          <ReportStartScreen
            icon={Scale}
            title="VA / NVA 4Q"
            badge="Testing Phase"
            subtitle="Monthly NVA review — trend, heads to cut, improvement plan."
            savedList={savedList}
            onNew={() => {
              const t = defaultReportTitle();
              setActions([]); setTitle(t); setPicked([]); setTarget(NVA_TARGET); setScopeNote('');
              saved.startNew(JSON.stringify({ actions: [], title: t }));
              setScopeOpen(true);
            }}
            onLoad={handleLoadSaved}
            onDeleteSave={saved.remove} />
        )}

        {/* ── Scope dialog ─────────────────────────────────────────────────── */}
        <Dialog open={scopeOpen} onOpenChange={setScopeOpen}>
          <DialogContent className="max-w-2xl">
            <h3 className="mb-4 text-base font-semibold">New report</h3>

            <div className="mb-5 space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Report name
              </Label>
              <Input value={title} onChange={e => setTitle(e.target.value)}
                placeholder={defaultReportTitle()} className="h-9 text-sm" />
            </div>

            <ScopeFields
              plants={[ONE_PLANT]} byPlant={{ [ONE_PLANT]: allWorkcells }}
              picked={picked} onChange={setPicked} labelPlant={() => 'All workcells'}
              allCount={allWorkcells.length} gridClassName="grid-cols-2 md:grid-cols-3">
              <div className="mb-5">
                <TargetControl value={target} onChange={setTarget} />
              </div>
            </ScopeFields>

            <Button className="mt-3 w-full" disabled={!period}
              onClick={() => { setScopeOpen(false); setTab('editor'); }}>
              Generate Report
            </Button>
          </DialogContent>
        </Dialog>

        {/* ── Editor ───────────────────────────────────────────────────────── */}
        {tab === 'editor' && (
          <>
            <div className="flex-1 overflow-y-auto p-8">
              <div className="mx-auto max-w-5xl space-y-12 pb-16">
                {scopeNote && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-600 dark:text-amber-400">
                    {scopeNote}
                  </div>
                )}

                {!tracker || !trend.length ? <NoMonthsYet /> : (
                  <>
                    <NvaHeadline trend={trend} target={target} avgReduce={q2.avgReduce} />

                    <Quadrant n="1" title="First Quadrant - NVA Trend" card
                      sub={`Plant NVA % by month, last ${Q1_MONTHS} months, target ${pct(target, 0)}`}>
                      <Q1Trend trend={trend} target={target} />
                    </Quadrant>

                    <Quadrant n="2" title="Second Quadrant - Pareto Three Months"
                      sub={`Whole heads to cut per workcell, averaged over the last ${Q2_MONTHS} months — then the top 3 by heads and the top 3 by NVA %.`}>
                      <div className="space-y-2">
                        <ParetoChart title={`Heads to Cut by Workcell (avg/month, last ${Q2_MONTHS})`} data={q2.dist}
                          height={200} unit="Heads" unitLabel="heads" emptyText="Nothing over target in this scope." />
                        <div className="grid grid-cols-2 gap-3">
                          <ParetoChart title="Top 3 Workcells - Heads to Cut" data={q2.p2}
                            height={180} unit="Heads" unitLabel="heads" />
                          <ParetoChart title="Top 3 Workcells - NVA %" data={q2.p3}
                            height={180} unit="NVA %" unitLabel="%" />
                        </div>
                      </div>
                    </Quadrant>

                    <Quadrant n="3" title="Third Quadrant - Improvement Plan"
                      sub="Corrective actions and ownership — the only part that is saved">
                      <ImprovementTable actions={actions} issues={issues} />
                    </Quadrant>

                    <Quadrant n="4" title="Fourth Quadrant - NVA % Tracker"
                      sub="NVA % per workcell per month. Plant row is head-weighted. Δ is month on month; down is good.">
                      <NvaTrackerTable t={tracker} target={target} />
                    </Quadrant>
                  </>
                )}
              </div>
            </div>

            {/* ── Editor drawer: plan + settings, same shape as OLE's ─────────── */}
            <ReportDrawer open={rightOpen} onToggle={() => setRightOpen(o => !o)} tabs={[
              {
                value: 'q3', label: 'Q3 Improvements', accent: 'data-[state=active]:border-emerald-500',
                content: (
                  <ImprovementEditor
                    actions={actions} onChange={setActions} issues={issues}
                    blurb="Track corrective actions against the two workcells carrying the most NVA above target." />
                ),
              },
              {
                // Same fields as the launch dialog — one component, so the two
                // cannot drift. The title is edited in place in the header.
                value: 'settings', label: 'Settings', end: true, accent: 'data-[state=active]:border-muted-foreground',
                content: (
                  <>
                    <ScopeFields
                      plants={[ONE_PLANT]} byPlant={{ [ONE_PLANT]: draftWorkcells }}
                      picked={draft.picked} onChange={p => setDraft(d => ({ ...d, picked: p }))}
                      labelPlant={() => 'All workcells'} allCount={draftWorkcells.length}
                      maxH="max-h-[18rem]" gridClassName="grid-cols-1 sm:grid-cols-2">
                      <div className="mb-5">
                        <TargetControl value={draft.target} onChange={t => setDraft(d => ({ ...d, target: t }))} />
                      </div>
                    </ScopeFields>
                    <Button className="mt-3 w-full" disabled={draftIsApplied}
                      onClick={() => {
                        // Workcells that exist only in the old month are dropped silently
                        // here — the Settings tab shows the draft month's list, so the
                        // user already saw what was on offer.
                        setPicked(draft.picked.filter(w => draftWorkcells.includes(w)));
                        setTarget(draft.target); setScopeNote('');
                      }}>
                      Update Report Scope
                    </Button>
                  </>
                ),
              },
            ]} />
          </>
        )}
      </div>
    </div>
  );
}
