/**
 * ProcessRegistry — what each workcell runs, and what each system calls it.
 *
 * WHY THIS PAGE EXISTS
 *   MES and IEDB name the same process differently and neither name is
 *   controlled — IEDB stores packout thirteen ways, one of them with a trailing
 *   space. The registry lines them up per workcell. Most of it is derived; a
 *   residue cannot be. Matching those by name is 38% right, by neighbouring
 *   scan 27%, by bay 55%. A wrong mapping is worse than a blank, so they come
 *   here instead, to the engineer who works the line.
 *
 * TWO TABS, NOT THREE
 *   Processes  every (workcell, MES step) couple MES scanned, with its IEDB
 *              counterpart, editable, filterable by mapped/unmapped. This IS
 *              the objective — 5,344 couples plant-wide, 983 still unmapped.
 *   Questions  the same unanswered steps, but carrying the evidence that only
 *              exists for them: which bay, what was scanned before and after,
 *              and which IEDB names live on that line.
 *
 *   A "Browse" tab used to sit between them, showing merged process keys across
 *   both systems. It answered a question nobody was asking here, and answered
 *   it wrong — 234 of LAM RESEARCH's 479 MES steps appeared in no Browse row at
 *   all, 149 of them already mapped. Removed rather than repaired: the merge it
 *   read from is built in the registry repo, not here.
 *
 * THE QUEUE IS A LIST NOW
 *   It used to serve one question at a time, keyboard-driven, auto-advancing.
 *   That is the right shape for 3,300 questions and the wrong one for the 141
 *   that actually carry evidence — you cannot see how much is left, cannot skip
 *   to the one you know, and cannot answer four spellings of one name together.
 */

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HelpCircle, Loader2, Table2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cycleTimeApi, type RegistryQuestion } from '@/lib/cycle_time/cycleTimeApi';
import { ExportButton } from '@/components/shared/ExportButton';
import type { ExportColumn } from '@/lib/cycle_time/exportTable';
import { cn } from '@/lib/utils';

import ProcessTable from './ProcessTable';

/** "FVT#2(1035) HLA#3(7)" → [{key:'FVT#2', n:1035}, …] */
/** The unanswered-step queue: what MES calls a step, how often it shows up, and
 *  what the bridge guessed. Exported so the naming decisions can be made in a
 *  spreadsheet with the people who know the floor, then typed back in. */
const QUESTION_COLS: ExportColumn<RegistryQuestion>[] = [
  { key: 'mes_step',       header: 'MES step name', width: 34 },
  { key: 'workcell',       header: 'Workcell',      width: 22 },
  { key: 'bay',            header: 'Bay',           width: 14 },
  { key: 'models',         header: 'Models',        width: 10, numFmt: '#,##0' },
  { key: 'scans',          header: 'Scans',         width: 12, numFmt: '#,##0' },
  { key: 'suggestion',     header: 'Suggested alias', width: 26 },
  { key: 'confidence',     header: 'Match on',      width: 18 },
  { key: 'candidates',     header: 'Other candidates', width: 30,
    get: q => (q.candidates ?? []).join(' · ') },
  { key: 'scanned_before', header: 'Scanned before', width: 30 },
  { key: 'scanned_after',  header: 'Scanned after',  width: 30 },
  { key: 'prior_answer',   header: 'Prior answer',   width: 16 },
  { key: 'prior_alias',    header: 'Prior alias',    width: 20 },
];

function parseNeighbours(s: string) {
  return (s || '').split(/\s+/).filter(Boolean).map((tok) => {
    const m = tok.match(/^(.*?)\((\d+)\)$/);
    return m ? { key: m[1], n: Number(m[2]) } : { key: tok, n: 0 };
  });
}

function Neighbours({ value }: { value: string }) {
  const items = parseNeighbours(value);
  if (items.length === 0) return <span className="text-muted-foreground/50">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {items.map((i) => (
        <span key={i.key} className="rounded bg-muted px-1 py-px font-mono text-[10px]">
          {i.key}{i.n > 0 && <span className="ml-0.5 text-muted-foreground">×{i.n}</span>}
        </span>
      ))}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * Questions — every unanswered step at once, with its evidence.
 *
 * Sorted by scans DESCENDING, never alphabetically. Someone who answers the
 * top 20 and stops has still covered most of the volume; alphabetical order
 * would spend their attention on a step scanned once.
 *
 * "Don't know" is a first-class answer. Without it one hard step stalls the
 * list and the tab gets closed.
 * ───────────────────────────────────────────────────────────────────────── */
function QuestionsList({ workcell }: { workcell: string }) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const { data: questions = [], isLoading } = useQuery({
    queryKey: ['registry-questions', workcell],
    queryFn: () => cycleTimeApi.registry.questions(workcell),
  });
  const { data: aliases = [] } = useQuery({
    queryKey: ['registry-aliases', workcell],
    queryFn: () => cycleTimeApi.registry.aliases(workcell),
  });

  const save = useMutation({
    mutationFn: cycleTimeApi.registry.decideBulk,
    onSuccess: () => {
      setPicked(new Set());
      qc.invalidateQueries({ queryKey: ['registry-questions'] });
      qc.invalidateQueries({ queryKey: ['registry-workcells'] });
      qc.invalidateQueries({ queryKey: ['process-list'] });
    },
  });

  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return questions;
    return questions.filter((q: RegistryQuestion) =>
      q.mes_step.toLowerCase().includes(f) ||
      q.candidates.some((c) => c.toLowerCase().includes(f)));
  }, [questions, filter]);

  const answer = (targets: RegistryQuestion[], ans: 'mapped' | 'non_iedb' | 'unknown',
                  alias?: string) =>
    save.mutate(targets.map((q) => ({
      workcell, mes_step: q.mes_step, answer: ans,
      iedb_alias: alias ?? drafts[q.mes_step],
      evidence: `before: ${q.scanned_before || '—'} | after: ${q.scanned_after || '—'} | ${q.scans} scans`,
    })));

  const pickedQs = shown.filter((q: RegistryQuestion) => picked.has(q.mes_step));

  if (isLoading) {
    return <div className="flex items-center gap-2 p-8 text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> loading…
    </div>;
  }
  if (questions.length === 0) {
    return <div className="p-8 text-center text-sm text-muted-foreground">
      Nothing left to answer for this workcell.
    </div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Input placeholder="filter a step or candidate…" value={filter}
          onChange={(e) => setFilter(e.target.value)} className="h-8 max-w-xs text-xs" />
        <span className="text-xs text-muted-foreground">
          {shown.length} of {questions.length} unanswered
        </span>
        {/* `shown` is the filtered list, so the file matches the screen. */}
        <ExportButton
          className="ml-auto"
          rows={shown}
          columns={QUESTION_COLS}
          filename={`process_registry_${workcell || 'all'}`}
          sheetName="Unanswered steps"
          title={`Process Registry — ${workcell || 'all workcells'}`}
          subtitle={`${shown.length} of ${questions.length} unanswered step names`
            + (filter.trim() ? ` · filtered by "${filter.trim()}"` : '')}
          scopeNote={shown.length !== questions.length
            ? `filtered from ${questions.length}` : undefined}
        />
      </div>

      {picked.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
          <span className="text-xs font-medium">{picked.size} selected</span>
          <select defaultValue="" disabled={save.isPending}
            onChange={(e) => { if (e.target.value) answer(pickedQs, 'mapped', e.target.value); }}
            className="h-8 rounded-md border bg-background px-2 text-xs">
            <option value="">map all to…</option>
            {aliases.map((a) => (
              <option key={a.alias} value={a.alias}>{a.alias} · {a.process}</option>
            ))}
          </select>
          <Button size="sm" variant="secondary" disabled={save.isPending}
            onClick={() => answer(pickedQs, 'non_iedb')}>Not IEDB</Button>
          <Button size="sm" variant="ghost" disabled={save.isPending}
            onClick={() => answer(pickedQs, 'unknown')}>Don’t know</Button>
          {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted/50 text-left">
            <tr className="[&>th]:px-2 [&>th]:py-2 [&>th]:text-[10px] [&>th]:font-semibold [&>th]:uppercase [&>th]:tracking-wider [&>th]:text-muted-foreground">
              <th className="w-8">
                <input type="checkbox" aria-label="Select all"
                  checked={shown.length > 0 && picked.size === shown.length}
                  onChange={(e) => setPicked(e.target.checked
                    ? new Set(shown.map((q: RegistryQuestion) => q.mes_step)) : new Set())}
                  className="h-3.5 w-3.5 accent-primary" />
              </th>
              <th>MES step</th>
              <th className="text-right">Models</th>
              <th className="text-right">Scans</th>
              <th>Bay</th>
              {/* The evidence that only exists for unanswered steps — and the
                  only reason this tab is not just the Processes filter. */}
              <th>Scanned before</th>
              <th>Scanned after</th>
              <th>IEDB names on that line</th>
              <th>Answer</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((q: RegistryQuestion) => (
              <tr key={q.mes_step}
                className={cn('border-t align-top [&>td]:px-2 [&>td]:py-1.5',
                  picked.has(q.mes_step) && 'bg-primary/5')}>
                <td>
                  <input type="checkbox" checked={picked.has(q.mes_step)}
                    aria-label={`Select ${q.mes_step}`}
                    onChange={() => setPicked((s) => {
                      const n = new Set(s);
                      if (n.has(q.mes_step)) n.delete(q.mes_step); else n.add(q.mes_step);
                      return n;
                    })}
                    className="h-3.5 w-3.5 accent-primary" />
                </td>
                {/* pre — trailing and double spaces are the evidence */}
                <td><pre className="font-mono text-[11px]">{q.mes_step}</pre></td>
                <td className="text-right tabular-nums">{q.models.toLocaleString()}</td>
                <td className="text-right tabular-nums font-medium">{q.scans.toLocaleString()}</td>
                <td className="text-muted-foreground">{q.bay || '—'}</td>
                <td><Neighbours value={q.scanned_before} /></td>
                <td><Neighbours value={q.scanned_after} /></td>
                <td>
                  <span className="flex flex-wrap gap-1">
                    {q.candidates.length === 0
                      ? <span className="text-muted-foreground/50">—</span>
                      : q.candidates.map((c) => (
                        <button key={c} type="button"
                          onClick={() => answer([q], 'mapped', c)}
                          title={`Map ${q.mes_step} → ${c}`}
                          className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-px font-mono text-[10px] text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400">
                          {c}
                        </button>
                      ))}
                  </span>
                  {q.suggestion && (
                    <Badge variant="outline" className="mt-1 text-[10px]"
                      title={`confidence: ${q.confidence}`}>
                      suggests {q.suggestion}
                    </Badge>
                  )}
                </td>
                <td>
                  <div className="flex items-center gap-1">
                    <select value={drafts[q.mes_step] ?? ''} disabled={save.isPending}
                      onChange={(e) => {
                        setDrafts((d) => ({ ...d, [q.mes_step]: e.target.value }));
                        if (e.target.value) answer([q], 'mapped', e.target.value);
                      }}
                      className="h-7 w-40 rounded-md border bg-background px-1 text-[11px]">
                      <option value="">pick IEDB…</option>
                      {aliases.map((a) => (
                        <option key={a.alias} value={a.alias}>{a.alias} · {a.process}</option>
                      ))}
                    </select>
                    <Button size="sm" variant="secondary" className="h-7 px-2 text-[10px]"
                      disabled={save.isPending}
                      onClick={() => answer([q], 'non_iedb')}>Not IEDB</Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]"
                      disabled={save.isPending}
                      title="Asked and could not say — not the same as nobody looking"
                      onClick={() => answer([q], 'unknown')}>?</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {save.isError && <div className="text-xs text-rose-600">
        Could not save: {(save.error as Error)?.message}</div>}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * The panel — used twice: standalone on /cycle-time/registry with a workcell
 * picker, and embedded in the workcell page with the workcell locked.
 *
 * Processes/Questions are PILL tabs, not another UnderlineTabs row. On the
 * workcell page this sits under the page's own underline tabs, and two
 * identical tab rows stacked is unreadable — the eye cannot tell which level it
 * is on. Pills read as a sub-control of the tab above them.
 * ───────────────────────────────────────────────────────────────────────── */
export function ProcessRegistryPanel({ workcell }: { workcell: string }) {
  const { data: workcells = [] } = useQuery({
    queryKey: ['registry-workcells'],
    queryFn: cycleTimeApi.registry.workcells,
  });
  // The workcell page passes the cycle-time spelling ('ResMed'); the registry
  // stores the MES one ('RESMED'). Match normalised, never on the raw string —
  // joining on workcell name is the trap that silently drops rows elsewhere.
  const norm = (s: string) => s.replace(/[^a-z0-9]/gi, '').toUpperCase();
  const wc = workcells.find((w) => norm(w.workcell) === norm(workcell));
  const left = wc?.questions_left ?? 0;
  const target = wc?.workcell ?? workcell;

  return (
    <Tabs defaultValue="processes" className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 sm:px-6">
        <TabsList>
          <TabsTrigger value="processes" className="gap-1.5">
            <Table2 className="h-3.5 w-3.5" /> Processes
          </TabsTrigger>
          <TabsTrigger value="questions" className="gap-1.5">
            <HelpCircle className="h-3.5 w-3.5" /> Questions
            {left > 0 && (
              <span className="ml-1 rounded bg-primary/15 px-1.5 text-xs tabular-nums">{left}</span>
            )}
          </TabsTrigger>
        </TabsList>
        {wc && (
          <div className="flex flex-wrap gap-1.5 text-xs">
            <Badge variant="outline">{wc.processes} processes</Badge>
            <Badge variant="outline"
              className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600">
              {wc.agreed} agreed</Badge>
            <Badge variant="outline"
              className="border-rose-500/20 bg-rose-500/10 text-rose-600">
              {wc.gap} no cycle time</Badge>
          </div>
        )}
      </div>

      {/* -mt-4, because ProcessTable brings its own padding — it is the same
          full-height table the models tab uses and runs its own scrollers. */}
      <TabsContent value="processes" className="mt-0 min-h-0 flex-1">
        <ProcessTable workcell={target} scope="scanned" />
      </TabsContent>
      <TabsContent value="questions" className="mt-0 min-h-0 flex-1 overflow-auto p-4 sm:p-6">
        <QuestionsList workcell={target} />
      </TabsContent>
    </Tabs>
  );
}

/* ───────────────────────────────────────────────────────────────────────── */
export default function ProcessRegistry() {
  const [workcell, setWorkcell] = useState<string>('');

  const { data: workcells = [] } = useQuery({
    queryKey: ['registry-workcells'],
    queryFn: cycleTimeApi.registry.workcells,
  });

  // Land on the workcell with the most unanswered — that is where the work is.
  const first = workcells[0]?.workcell ?? '';
  const active = workcell || first;

  return (
    <div className="flex h-full w-full flex-col">
      <div className="border-b px-4 py-4 sm:px-6">
        <h1 className="text-xl font-semibold">Process registry</h1>
        <p className="text-sm text-muted-foreground">
          Every MES step a workcell scans, and what IEDB calls it. Where nobody
          has said what a step is, answer it here.
        </p>
        <select
          value={active}
          onChange={(e) => setWorkcell(e.target.value)}
          className="mt-3 h-9 rounded-md border bg-background px-3 text-sm"
        >
          {workcells.map((w) => (
            <option key={w.workcell} value={w.workcell}>
              {w.workcell}{w.questions_left > 0 ? ` — ${w.questions_left} to answer` : ' ✓'}
            </option>
          ))}
        </select>
      </div>

      <div className="min-h-0 flex-1">
        {active && <ProcessRegistryPanel workcell={active} />}
      </div>
    </div>
  );
}
