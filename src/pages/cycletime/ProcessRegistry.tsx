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
 * THE DESIGN IS DRIVEN BY ONE NUMBER
 *   ~3,300 open questions plant-wide.
 *      3,300 x 30s = 27 hours   nobody finishes
 *      3,300 x  3s =  2.7 h     split across 24 owners = 7 min each
 *   So: one question on screen, evidence above it, keyboard, auto-advance, no
 *   save button. A mouse round-trip per question is what turns 3s into 30.
 *
 *   Sorted by scans DESCENDING, never alphabetically — someone who answers the
 *   top 20 and stops has still covered most of the volume.
 *
 *   "Don't know" is a first-class answer. Without it one hard step stalls the
 *   queue and the tab gets closed.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, HelpCircle, Link2, Loader2, Pencil, SkipForward, Table2, Wrench } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  cycleTimeApi, type RegistryAnswer, type RegistryProcess, type RegistryQuestion,
} from '@/lib/cycle_time/cycleTimeApi';

/** What each `source` means, in the words someone reading it needs. */
const SOURCE: Record<string, { label: string; cls: string }> = {
  both:         { label: 'agreed',            cls: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  iedb_only:    { label: 'IEDB only',         cls: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  mes_only:     { label: 'no cycle time',     cls: 'bg-rose-500/10 text-rose-600 border-rose-500/20' },
  mes_non_iedb: { label: 'rework / handling', cls: 'bg-muted text-muted-foreground border-border' },
};

/** "FVT#2(1035) HLA#3(7)" → [{key:'FVT#2', n:1035}, …] */
function parseNeighbours(s: string) {
  return (s || '').split(/\s+/).filter(Boolean).map((tok) => {
    const m = tok.match(/^(.*?)\((\d+)\)$/);
    return m ? { key: m[1], n: Number(m[2]) } : { key: tok, n: 0 };
  });
}

function Neighbours({ label, value }: { label: string; value: string }) {
  const items = parseNeighbours(value);
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      {items.length === 0
        ? <div className="text-sm text-muted-foreground/60">—</div>
        : (
          <div className="mt-1 flex flex-wrap gap-1">
            {items.map((i) => (
              <span key={i.key} className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                {i.key}
                {i.n > 0 && <span className="ml-1 text-muted-foreground">×{i.n}</span>}
              </span>
            ))}
          </div>
        )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * The queue — one question at a time
 * ───────────────────────────────────────────────────────────────────────── */
function AnswerQueue({ workcell }: { workcell: string }) {
  const qc = useQueryClient();
  const [i, setI] = useState(0);
  const [custom, setCustom] = useState('');

  const { data: questions = [], isLoading } = useQuery({
    queryKey: ['registry-questions', workcell],
    queryFn: () => cycleTimeApi.registry.questions(workcell),
  });
  const { data: aliases = [] } = useQuery({
    queryKey: ['registry-aliases', workcell],
    queryFn: () => cycleTimeApi.registry.aliases(workcell),
  });

  const total = questions.length;
  const q: RegistryQuestion | undefined = questions[i];

  const decide = useMutation({
    mutationFn: cycleTimeApi.registry.decide,
    // Advance immediately, refresh in the background. Waiting for a round-trip
    // between questions is exactly the 3s→30s tax this page exists to avoid.
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['registry-workcells'] }); },
  });

  const answer = useCallback((a: RegistryAnswer, alias?: string) => {
    if (!q) return;
    decide.mutate({
      workcell, mes_step: q.mes_step, answer: a, iedb_alias: alias,
      evidence: `before: ${q.scanned_before || '—'} | after: ${q.scanned_after || '—'} | ${q.scans} scans`,
    });
    setCustom('');
    setI((n) => n + 1);
  }, [q, workcell, decide]);

  // Keyboard: 1-3 pick a candidate, N = not IEDB, ? = don't know, S = skip.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;   // typing a custom alias
      if (!q) return;
      const cands = q.candidates.slice(0, 3);
      if (/^[1-9]$/.test(e.key)) {
        const c = cands[Number(e.key) - 1];
        if (c) answer('mapped', c);
      } else if (e.key.toLowerCase() === 'n') answer('non_iedb');
      else if (e.key === '?' || e.key === '/') answer('unknown');
      else if (e.key.toLowerCase() === 's') setI((n) => n + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [q, answer]);

  useEffect(() => { setI(0); }, [workcell]);

  if (isLoading) {
    return <div className="flex items-center gap-2 p-8 text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> loading…
    </div>;
  }
  if (total === 0) {
    return <Card className="p-8 text-center">
      <Check className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
      <div className="font-medium">Nothing left to answer</div>
      <div className="text-sm text-muted-foreground">
        Every MES step in {workcell} is named.
      </div>
    </Card>;
  }
  if (!q) {
    return <Card className="p-8 text-center">
      <Check className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
      <div className="font-medium">Done — {total} answered</div>
      <Button variant="outline" className="mt-3" onClick={() => setI(0)}>Start over</Button>
    </Card>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Progress value={(i / total) * 100} className="h-2 flex-1" />
        <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
          {i} of {total}
        </span>
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">MES scans</span>
          {/* pre keeps trailing / double spaces visible — they are the evidence */}
          <pre className="font-mono text-xl font-semibold">{q.mes_step}</pre>
          <span className="text-sm text-muted-foreground">
            {q.scans.toLocaleString()} times · {q.models} models{q.bay && ` · bay ${q.bay}`}
          </span>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Neighbours label="scanned just before" value={q.scanned_before} />
          <Neighbours label="scanned just after" value={q.scanned_after} />
        </div>

        <div className="mt-5 border-t pt-4">
          <div className="mb-2 text-sm font-medium">Which IEDB process is this?</div>
          <div className="flex flex-wrap gap-2">
            {q.candidates.slice(0, 3).map((c, n) => (
              <Button key={c} onClick={() => answer('mapped', c)} className="font-mono">
                <kbd className="mr-2 rounded bg-background/20 px-1 text-[10px]">{n + 1}</kbd>{c}
              </Button>
            ))}
            <Button variant="secondary" onClick={() => answer('non_iedb')}>
              <kbd className="mr-2 rounded bg-background/40 px-1 text-[10px]">N</kbd>
              <Wrench className="mr-1 h-3.5 w-3.5" /> Not IEDB work
            </Button>
            <Button variant="ghost" onClick={() => answer('unknown')}>
              <kbd className="mr-2 rounded bg-muted px-1 text-[10px]">?</kbd>
              <HelpCircle className="mr-1 h-3.5 w-3.5" /> Don't know
            </Button>
            <Button variant="ghost" onClick={() => setI((n) => n + 1)}>
              <kbd className="mr-2 rounded bg-muted px-1 text-[10px]">S</kbd>
              <SkipForward className="mr-1 h-3.5 w-3.5" /> Skip
            </Button>
          </div>

          <div className="mt-3 flex gap-2">
            <Input
              list="registry-aliases"
              placeholder="…or type another IEDB process"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && custom.trim()) answer('mapped', custom.trim()); }}
              className="max-w-sm font-mono"
            />
            {/* The alias is what gets stored; IEDB's display name rides along as
                the label, because `BIRTH 1` alone tells you nothing and
                `BIRTH 1 — Label 1` tells you what it is. Model count sorts the
                list, so the process most of the workcell runs is offered first. */}
            <datalist id="registry-aliases">
              {aliases.map((a) => (
                <option key={a.alias} value={a.alias}>
                  {a.process && a.process !== a.alias ? `${a.process} · ` : ''}{a.models} models
                </option>
              ))}
            </datalist>
            <Button variant="outline" disabled={!custom.trim()}
                    onClick={() => answer('mapped', custom.trim())}>Use this</Button>
          </div>
        </div>

        {/* The suggestion is shown LAST and never pre-selected. Measured at 27-38%
            accurate, it is a hint, not a default — a pre-filled wrong answer is
            how a bad mapping gets clicked through. */}
        {q.suggestion && (
          <div className="mt-3 text-xs text-muted-foreground">
            guess: <span className="font-mono">{q.suggestion}</span> ({q.confidence}) —
            low confidence, check the neighbours above
          </div>
        )}
      </Card>

      {decide.isError && (
        <div className="text-sm text-rose-600">
          Could not save: {(decide.error as Error)?.message}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * Browse — every process, both systems' names
 * ───────────────────────────────────────────────────────────────────────── */
function BrowseList({ workcell }: { workcell: string }) {
  const [filter, setFilter] = useState('');
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['registry-processes', workcell],
    queryFn: () => cycleTimeApi.registry.processes(workcell),
  });

  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return rows;
    return rows.filter((r: RegistryProcess) =>
      [r.process_key, r.process_name, r.iedb_aliases, r.mes_steps]
        .some((v) => String(v).toLowerCase().includes(f)));
  }, [rows, filter]);

  if (isLoading) {
    return <div className="flex items-center gap-2 p-8 text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> loading…
    </div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Input placeholder="filter by any name…" value={filter}
               onChange={(e) => setFilter(e.target.value)} className="max-w-xs" />
        <span className="text-sm text-muted-foreground">
          {shown.length} of {rows.length} processes
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:font-medium">
              <th>Process</th><th>IEDB calls it</th><th>MES calls it</th>
              <th className="text-right">Models</th><th className="text-right">Scans</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r: RegistryProcess) => {
              const s = SOURCE[r.source] ?? { label: r.source, cls: '' };
              return (
                <tr key={r.process_key} className="border-t [&>td]:px-3 [&>td]:py-2">
                  <td>
                    <div className="font-mono font-medium">{r.process_key}</div>
                    <div className="text-xs text-muted-foreground">{r.process_name}</div>
                  </td>
                  <td className="font-mono text-xs">{r.iedb_aliases || <span className="text-muted-foreground/60">—</span>}</td>
                  <td className="font-mono text-xs">{r.mes_steps || <span className="text-muted-foreground/60">—</span>}</td>
                  <td className="text-right tabular-nums">{r.iedb_models || r.mes_models || 0}</td>
                  <td className="text-right tabular-nums">{(r.mes_scans || 0).toLocaleString()}</td>
                  <td><Badge variant="outline" className={s.cls}>{s.label}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * Steps — EVERY MES step, mapped or not, and every one of them editable.
 *
 * The Answer queue only serves the unmapped, which left a wrong mapping
 * permanent: if the workbook says `POST SOLDER INSP 2 -> MSOLDER 2` and that is
 * wrong, nothing could correct it. A mapping is a decision someone made, and
 * decisions get revised.
 * ───────────────────────────────────────────────────────────────────────── */
const SRC: Record<string, { label: string; cls: string; tip: string }> = {
  decision: { label: 'engineer', cls: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
              tip: 'Someone answered this here' },
  workbook: { label: 'workbook', cls: 'bg-sky-500/10 text-sky-600 border-sky-500/20',
              tip: 'From the hand-typed Excel sheet' },
  auto:     { label: 'auto',     cls: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
              tip: 'Plant-wide guess — the weakest source, check it' },
  none:     { label: 'unmapped', cls: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
              tip: 'Nothing maps this step' },
};

function StepsList({ workcell }: { workcell: string }) {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['registry-steps', workcell, q],
    queryFn: () => cycleTimeApi.registry.steps(workcell, q),
  });
  const { data: aliases = [] } = useQuery({
    queryKey: ['registry-aliases', workcell],
    queryFn: () => cycleTimeApi.registry.aliases(workcell),
  });

  const save = useMutation({
    mutationFn: cycleTimeApi.registry.decide,
    onSuccess: () => {
      setEditing(null);
      qc.invalidateQueries({ queryKey: ['registry-steps'] });
      qc.invalidateQueries({ queryKey: ['registry-workcells'] });
      qc.invalidateQueries({ queryKey: ['registry-questions'] });
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Input placeholder="search a MES step…" value={q} onChange={(e) => setQ(e.target.value)}
               className="max-w-xs" />
        <span className="text-sm text-muted-foreground">
          {isLoading ? 'loading…' : `${rows.length} steps`}
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:font-medium">
              <th>MES step</th><th>maps to</th><th>from</th>
              <th className="text-right">Scans</th><th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const s = SRC[r.source] ?? SRC.none;
              const isEditing = editing === r.mes_step;
              return (
                <tr key={r.mes_step} className="border-t [&>td]:px-3 [&>td]:py-2 align-top">
                  {/* pre — trailing and double spaces are the evidence */}
                  <td><pre className="font-mono text-xs">{r.mes_step}</pre></td>
                  <td>
                    {isEditing ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Input list="registry-aliases-edit" autoFocus value={draft}
                               onChange={(e) => setDraft(e.target.value)}
                               onKeyDown={(e) => {
                                 if (e.key === 'Enter' && draft.trim()) {
                                   save.mutate({ workcell, mes_step: r.mes_step,
                                     answer: 'mapped', iedb_alias: draft.trim() });
                                 }
                                 if (e.key === 'Escape') setEditing(null);
                               }}
                               className="h-8 w-48 font-mono text-xs" placeholder="IEDB process…" />
                        <datalist id="registry-aliases-edit">
                          {aliases.map((a) => <option key={a} value={a} />)}
                        </datalist>
                        <Button size="sm" disabled={!draft.trim()}
                                onClick={() => save.mutate({ workcell, mes_step: r.mes_step,
                                  answer: 'mapped', iedb_alias: draft.trim() })}>Save</Button>
                        <Button size="sm" variant="secondary"
                                onClick={() => save.mutate({ workcell, mes_step: r.mes_step,
                                  answer: 'non_iedb' })}>Not IEDB</Button>
                        <Button size="sm" variant="ghost"
                                onClick={() => setEditing(null)}>Cancel</Button>
                      </div>
                    ) : (
                      <span className="font-mono text-xs">
                        {r.iedb_alias || r.process_key ||
                          <span className="text-muted-foreground/60">—</span>}
                      </span>
                    )}
                  </td>
                  <td><Badge variant="outline" className={s.cls} title={s.tip}>{s.label}</Badge>
                      {r.decided_by && <div className="mt-0.5 text-[11px] text-muted-foreground">
                        {r.decided_by}</div>}</td>
                  <td className="text-right tabular-nums">{r.scans.toLocaleString()}</td>
                  <td className="text-right">
                    {!isEditing && (
                      <Button size="sm" variant="ghost"
                              onClick={() => { setEditing(r.mes_step); setDraft(r.iedb_alias || ''); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {save.isError && <div className="text-sm text-rose-600">
        Could not save: {(save.error as Error)?.message}</div>}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * The panel — used twice: standalone on /cycle-time/registry with a workcell
 * picker, and embedded in the workcell page with the workcell locked.
 *
 * Answer/Browse are PILL tabs, not another UnderlineTabs row. On the workcell
 * page this sits under the page's own underline tabs, and two identical tab
 * rows stacked is unreadable — the eye cannot tell which level it is on. Pills
 * read as a sub-control of the tab above them.
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

  return (
    <Tabs defaultValue={left > 0 ? 'answer' : 'browse'} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TabsList>
          <TabsTrigger value="answer" className="gap-1.5">
            <HelpCircle className="h-3.5 w-3.5" /> Answer
            {left > 0 && (
              <span className="ml-1 rounded bg-primary/15 px-1.5 text-xs tabular-nums">{left}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="browse" className="gap-1.5">
            <Table2 className="h-3.5 w-3.5" /> Browse
          </TabsTrigger>
          <TabsTrigger value="steps" className="gap-1.5">
            <Link2 className="h-3.5 w-3.5" /> Mapping
          </TabsTrigger>
        </TabsList>
        {wc && (
          <div className="flex flex-wrap gap-1.5 text-xs">
            <Badge variant="outline">{wc.processes} processes</Badge>
            <Badge variant="outline" className={SOURCE.both.cls}>{wc.agreed} agreed</Badge>
            <Badge variant="outline" className={SOURCE.mes_only.cls}>{wc.gap} no cycle time</Badge>
          </div>
        )}
      </div>

      <TabsContent value="answer" className="mt-0">
        <AnswerQueue workcell={wc?.workcell ?? workcell} />
      </TabsContent>
      <TabsContent value="browse" className="mt-0">
        <BrowseList workcell={wc?.workcell ?? workcell} />
      </TabsContent>
      <TabsContent value="steps" className="mt-0">
        <StepsList workcell={wc?.workcell ?? workcell} />
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
  useEffect(() => {
    if (!workcell && workcells.length) setWorkcell(workcells[0].workcell);
  }, [workcells, workcell]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-semibold">Process registry</h1>
        <p className="text-sm text-muted-foreground">
          Every process a workcell runs, and what MES and IEDB each call it.
          Where nobody has said what a step is, answer it here.
        </p>
      </div>

      <select
        value={workcell}
        onChange={(e) => setWorkcell(e.target.value)}
        className="h-9 rounded-md border bg-background px-3 text-sm"
      >
        {workcells.map((w) => (
          <option key={w.workcell} value={w.workcell}>
            {w.workcell}{w.questions_left > 0 ? ` — ${w.questions_left} to answer` : ' ✓'}
          </option>
        ))}
      </select>

      {workcell && <ProcessRegistryPanel workcell={workcell} />}
    </div>
  );
}
