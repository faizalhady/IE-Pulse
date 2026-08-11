/**
 * CycleTime4QReport.tsx
 * ─────────────────────
 * The Cycle Time 4Q — same shell as the OLE 4Q, different content.
 *
 *   Q1  where we stand      completion % by week, against target
 *   Q2  where it is going   split by plant and workcell
 *   Q3  what we will do     the improvement plan (saved; everything else is live)
 *   Q4  the 100% view       complete + every loss, back to 100%
 *
 * The loss ranking that USED to be Q3 now sits under Q2 as its evidence: it is
 * what picks the two issues the plan is written against, exactly as OLE's
 * paretos pick its top two man-hour buckets.
 *
 * Only the plan is persisted. Q1/Q2/Q4 rebuild from the live mart on every load,
 * so opening last month's plan shows it against THIS week's numbers.
 *
 * Route: /cycle-time/4q
 */

import { FourQPreview } from '@/components/shared/FourQPreview';
import type { ActionItem } from '@/components/shared/ImprovementPlan';
import { ImprovementEditor, ImprovementTable } from '@/components/shared/ImprovementPlan';
import { ParetoChart, buildPareto } from '@/components/shared/ParetoChart';
import { ReportStartScreen } from '@/components/shared/ReportStartScreen';
import { ScopePicker } from '@/components/shared/ScopePicker';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCycleTimeCompletionDemand, useCycleTimeCompletionHistory } from '@/hooks/cycle_time/useCycleTimeData';
import { useSavedReport } from '@/hooks/shared/useSavedReport';
import { savedReports } from '@/lib/shared/savedReportsApi';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, FileSpreadsheet, Loader2, Pencil, Save } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  CompletionHeadline, NoHistoryYet, Q1Trend, Q2Splits, Q4Stack,
  Quadrant, TARGET, buildQuadrantModel, lossColor, lossLabel,
} from './CompletionFourQuadrant';

// Module scope, not per-render: the factory returns a fresh object each call.
const reportsApi = savedReports('cycle_time', '4q');

/** Same plant naming as the Incompletion Report. Duplicated knowingly — delete
 *  when the shared workcell reference data lands (see the deferred to-do). */
const PLANT_ORDER = ['Plant 1', 'JPE', 'JBK'];
const PLANT_LABEL: Record<string, string> = { 'Plant 1': 'Plant 1', JPE: 'Plant 2', JBK: 'Batu Kawan' };
const plantLabel = (p: string) => PLANT_LABEL[p] ?? p;

type ReportScope = { workcells: string[] };
type SavedPlan = { actions: ActionItem[]; scope?: ReportScope; title?: string };

/** "4Q Report 08-10-26" — MM-DD-YY, matching how reports are named by hand. */
function defaultReportTitle(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `4Q Report ${p(d.getMonth() + 1)}-${p(d.getDate())}-${String(d.getFullYear()).slice(-2)}`;
}

export default function CycleTime4QReport() {
  const location = useLocation();
  const [tab, setTab] = useState<'start' | 'editor'>('start');
  // Re-navigating here (e.g. clicking the sidebar link while already on it)
  // returns to the start screen. location.key changes on every navigate().
  useEffect(() => { setTab('start'); }, [location.key]);

  const [title, setTitle] = useState(defaultReportTitle);
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleBeforeEdit, setTitleBeforeEdit] = useState('');
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(true);
  const [scopeNote, setScopeNote] = useState('');

  // Scope comes from the demand report — same source as the Incompletion
  // Report, so the two can never offer different workcell lists.
  const { data: demand, isLoading: scopeLoading } = useCycleTimeCompletionDemand();
  const scope = demand?.scope;
  const allWorkcells = useMemo(() => scope?.workcells ?? [], [scope]);
  const plants = useMemo(() => {
    const keys = Object.keys(scope?.plants ?? {});
    const rank = (p: string) => { const i = PLANT_ORDER.indexOf(p); return i < 0 ? PLANT_ORDER.length : i; };
    return keys.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  }, [scope]);

  const { data, isLoading, error } = useCycleTimeCompletionHistory(13, picked);
  const m = data ? buildQuadrantModel(data) : null;

  /* Q2 — three Paretos, same shape as OLE's.
       1. every negative (everything that is not complete), by MODEL COUNT
       2. top 3 workcells for the #1 negative, by model count
       3. top 3 workcells for the #2 negative, by model count
     Counted in MODELS, not demand units: this quadrant answers "how many
     standards are missing and who owns them", which is a work list. Units
     answer a different question and would let one high-volume runner outweigh
     fifty missing standards. The units view stays on the headline and Q4.

     Built from the DEMAND models, not the history mart: history is rolled up to
     (week, plant, workcell, status, reason) with no way back to a workcell ×
     one-specific-loss cut, and the demand rows carry customer + status + reason
     per model. Same source the Data Table reads, so the two cannot disagree. */
  const q2 = useMemo(() => {
    const wanted = picked.length ? new Set(picked) : null;
    const rows = (demand?.models ?? []).filter(r =>
      r.status !== 'complete' && (!wanted || wanted.has(r.customer)));

    // Bucket by (status, reason) — the same pairing Q4 stacks by. One per model.
    const byLoss = new Map<string, { label: string; models: number; status: string; reason: string }>();
    for (const r of rows) {
      const reason = r.reason ?? '';
      const k = `${r.status}|${reason}`;
      const hit = byLoss.get(k)
        ?? { label: lossLabel({ status: r.status, reason, units: 0, models: 0, pct: 0 }), models: 0, status: r.status, reason };
      hit.models += 1;
      byLoss.set(k, hit);
    }
    const buckets = [...byLoss.values()];
    const dist = buildPareto(buckets.map(b => ({ name: b.label, value: b.models, color: lossColor(b.status) })));

    /** Top 3 workcells by how many MODELS carry one specific loss. */
    const top3 = (label: string) => {
      const b = buckets.find(x => x.label === label);
      if (!b) return [];
      const byWc = new Map<string, number>();
      for (const r of rows) {
        if (r.status !== b.status || (r.reason ?? '') !== b.reason) continue;
        byWc.set(r.customer, (byWc.get(r.customer) ?? 0) + 1);
      }
      return buildPareto([...byWc.entries()]
        .sort((x, y) => y[1] - x[1]).slice(0, 3)
        .map(([wc, models]) => ({ name: wc, value: models, color: lossColor(b.status) })));
    };

    const top1 = dist[0]?.name ?? '';
    const top2 = dist[1]?.name ?? '';
    return { dist, top1, top2, p2: top3(top1), p3: top3(top2) };
  }, [demand, picked]);

  // The two biggest losses are what the plan is written against — same idea as
  // OLE's top two man-hour buckets driving its Q3 sections. Taken from the Q2
  // Pareto so the chart and the plan can never name different issues.
  const issues = useMemo(() => [q2.top1, q2.top2].filter(Boolean), [q2]);

  const planFingerprint = useMemo(() => JSON.stringify({ actions, title }), [actions, title]);

  const saved = useSavedReport<SavedPlan>({
    api: reportsApi,
    name: title,
    payload: { actions, scope: { workcells: picked }, title },
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

      // A saved scope can name workcells that no longer exist — renames are
      // pending across the platform. Drop the unknown ones, SAY which, and open
      // the report anyway. Silently empty charts are the worse failure.
      const wanted = rec.payload?.scope?.workcells ?? [];
      const known = wanted.filter(w => allWorkcells.includes(w));
      const gone = wanted.filter(w => !allWorkcells.includes(w));
      setPicked(known);
      setScopeNote(gone.length ? `Ignored ${gone.length} workcell(s) no longer in the data: ${gone.join(', ')}` : '');

      if (!known.length) {
        setScopeOpen(true);   // nothing usable left — make them pick
        return;
      }
      setTab('editor');
    } catch (e) {
      console.error(e);
      saved.setSaveMsg(e instanceof Error ? e.message : 'Load failed');
    }
  }

  const preview = m && (
    <FourQPreview
      title={title}
      brand="JABIL CYCLE TIME 4Q"
      headings={['First Quadrant - Completion Trend', 'Second Quadrant - Pareto of Negatives',
        'Fourth Quadrant - The 100% View', 'Third Quadrant - Improvement Plan']}
      bareQuadrants={[false, false, false, true]}
      quadrants={[
        <Q1Trend m={m} height={200} />,
        /* Same three-chart arrangement as OLE's Q2 on the sheet: the
           distribution on the left, the two workcell breakdowns stacked right. */
        <div className="flex h-full min-h-0 gap-2">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <ParetoChart title="Incomplete Models by Reason (model count)" data={q2.dist}
              fillHeight unit="Models" unitLabel="models"
              emptyText="Nothing incomplete in this scope." />
          </div>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
            <ParetoChart title={`Top 3 Workcells - ${q2.top1 || '#1 Negative'}`} data={q2.p2}
              fillHeight unit="Models" unitLabel="models" />
            <ParetoChart title={`Top 3 Workcells - ${q2.top2 || '#2 Negative'}`} data={q2.p3}
              fillHeight unit="Models" unitLabel="models" />
          </div>
        </div>,
        <Q4Stack m={m} />,
        <ImprovementTable actions={actions} issues={issues} isPrint />,
      ]}
    />
  );

  if (scopeLoading) {
    return <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

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
            <h1 className="text-xl font-semibold text-foreground">Cycle Time 4Q</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {tab === 'start' ? 'Create a new report or open a saved one'
                : `Scope: ${picked.length ? `${picked.length} workcells` : 'All workcells'}`}
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
            icon={FileSpreadsheet}
            title="Cycle Time 4Q"
            subtitle="Completion against demand — trend, losses, improvement plan."
            savedList={savedList}
            onNew={() => {
              const t = defaultReportTitle();
              setActions([]); setTitle(t); setPicked([]); setScopeNote('');
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

            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Report scope
            </Label>
            <div className="mt-1.5 max-h-[26rem] space-y-4 overflow-y-auto pr-1">
              <ScopePicker
                plants={plants} byPlant={scope?.plants ?? {}}
                picked={picked} onChange={setPicked} labelPlant={plantLabel}
                gridClassName="grid-cols-2 md:grid-cols-3" />
            </div>

            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {picked.length || allWorkcells.length} workcell{(picked.length || allWorkcells.length) === 1 ? '' : 's'} selected
                {picked.length === 0 && ' (all)'}
              </span>
              <button onClick={() => setPicked([])} disabled={!picked.length}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40">
                Clear
              </button>
            </div>

            <Button className="mt-3 w-full"
              onClick={() => { setScopeOpen(false); setTab('editor'); }}>
              Generate Report
            </Button>
          </DialogContent>
        </Dialog>

        {/* ── Editor ───────────────────────────────────────────────────────── */}
        {tab === 'editor' && (
          <>
            <div className="flex-1 overflow-y-auto p-8">
              <div className="mx-auto max-w-5xl space-y-8 pb-16">
                {scopeNote && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-600 dark:text-amber-400">
                    {scopeNote}
                  </div>
                )}

                {isLoading ? (
                  <div className="flex h-64 items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : error || !m ? <NoHistoryYet /> : (
                  <>
                    <CompletionHeadline m={m} />

                    <Quadrant n="Q1" title="Where we stand" sub={`Completion % by week, target ${TARGET}%`}>
                      <Q1Trend m={m} />
                    </Quadrant>

                    <Quadrant n="Q2" title="Where it is going"
                      sub="Every negative by model count, then the top 3 workcells behind each of the two biggest">
                      <div className="space-y-2">
                        <ParetoChart title="Incomplete Models by Reason (model count)" data={q2.dist}
                          height={200} unit="Models" unitLabel="models"
                          emptyText="Nothing incomplete in this scope." />
                        <div className="grid grid-cols-2 gap-3">
                          <ParetoChart title={`Top 3 Workcells - ${q2.top1 || '#1 Negative'}`} data={q2.p2}
                            height={180} unit="Models" unitLabel="models" />
                          <ParetoChart title={`Top 3 Workcells - ${q2.top2 || '#2 Negative'}`} data={q2.p3}
                            height={180} unit="Models" unitLabel="models" />
                        </div>
                      </div>
                    </Quadrant>

                    <Quadrant n="Q2b" title="By plant and workcell"
                      sub="The same completion %, split by where it is built">
                      <Q2Splits m={m} listHeight={200} />
                    </Quadrant>

                    <Quadrant n="Q3" title="What we will do"
                      sub="Corrective actions against the two biggest losses — the only part that is saved">
                      <ImprovementTable actions={actions} issues={issues} />
                    </Quadrant>

                    <Quadrant n="Q4" title="The 100% view" sub="Complete plus every loss, back to 100%">
                      <Q4Stack m={m} />
                    </Quadrant>
                  </>
                )}
              </div>
            </div>

            {/* ── Plan editor panel ──────────────────────────────────────────── */}
            <div className={cn('z-10 flex flex-shrink-0 flex-col border-l border-border bg-card/95 shadow-xl backdrop-blur-sm transition-all duration-300',
              rightOpen ? 'w-[460px]' : 'w-12')}>
              <div className={cn('flex cursor-pointer items-center border-b border-border transition-colors hover:bg-muted/40',
                rightOpen ? 'justify-between px-5' : 'justify-center')}
                style={{ height: 52 }} onClick={() => setRightOpen(!rightOpen)}>
                {rightOpen && <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Improvement Plan</span>}
                <div className="rounded-md bg-muted p-1.5 text-muted-foreground">
                  {rightOpen ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
                </div>
              </div>
              {rightOpen && (
                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                  <ImprovementEditor
                    actions={actions} onChange={setActions} issues={issues}
                    blurb="Track corrective actions against the two biggest completion losses." />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
