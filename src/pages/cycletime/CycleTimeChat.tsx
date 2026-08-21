/**
 * CycleTimeChat.tsx
 * ─────────────────
 * Ask the cycle-time data a question in English.
 *
 * Route: /cycle-time/ask
 *
 * WHAT IT IS, AND WHAT IT IS NOT
 *   A local model (llama3.1:8b via Ollama) picks which of nine existing endpoints
 *   answers your question and extracts its arguments. It does NOT write SQL and
 *   it does NOT do arithmetic — every number comes from the same marts these
 *   pages already read, so the chat cannot disagree with the screen.
 *
 * WHY EVERY ANSWER SHOWS ITS SOURCE
 *   This is meant to replace IEDB. Nobody moves onto a system whose numbers they
 *   cannot check, so the tool that ran and the mart it read are printed under
 *   every reply — not hidden behind a "details" toggle.
 *
 * WHY AMBIGUITY COMES BACK AS A QUESTION
 *   "arista" is two real workcells building different models. The server refuses
 *   to pick and returns the candidates; the answer asks which one. A confident
 *   wrong number is worse than a question, because it reads exactly like a right
 *   one.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Streamdown } from 'streamdown';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ArrowUp, Bot, Loader2, User } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cycleTimeApi } from '@/lib/cycle_time/cycleTimeApi';
import type { ChatAnswer } from '@/lib/cycle_time/cycleTimeApi';
import { useCycleTimeCustomers } from '@/hooks/cycle_time/useCycleTimeData';
import { cn } from '@/lib/utils';

// ─── entity links ────────────────────────────────────────────────────────────
// A workcell name in an answer is a door, not a word: click it, land on that
// workcell's page. Same for part numbers when the workcell is known. Matching
// is done here in the FE against the customers list the app already caches —
// the backend stays a text API.

const normKey = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** A part number: letters/digits with at least one dash and one digit. */
const PART_SRC = '[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+';

const LINK_CLS = 'underline decoration-dotted underline-offset-2 hover:text-primary';

function wcHref(display: string) { return `/cycle-time/${encodeURIComponent(display)}`; }
function modelHref(wc: string, asm: string) {
  return `/cycle-time/${encodeURIComponent(wc)}/${encodeURIComponent(asm)}`;
}

/** Answer text -> text with workcell names and part numbers as links. */
function linkify(text: string, names: string[], byKey: Map<string, string>,
                 ctxWc?: string): ReactNode {
  if (!names.length) return text;
  const wcAlt = [...names].sort((a, b) => b.length - a.length).map(escapeRe).join('|');
  const re = new RegExp(`(${wcAlt})|(${PART_SRC})`, 'gi');
  const out: ReactNode[] = [];
  let last = 0, m: RegExpExecArray | null, k = 0;
  while ((m = re.exec(text)) !== null) {
    const s = m[0];
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) {
      const display = byKey.get(normKey(s)) ?? s;
      out.push(<Link key={k++} className={LINK_CLS} to={wcHref(display)}>{s}</Link>);
    } else if (/\d/.test(s) && s.length >= 6 && ctxWc) {
      out.push(<Link key={k++} className={LINK_CLS} to={modelHref(ctxWc, s)}>{s}</Link>);
    } else {
      out.push(s);                              // part-shaped but no workcell to anchor it
    }
    last = m.index + s.length;
  }
  if (!out.length) return text;
  out.push(text.slice(last));
  return out;
}

/** The one workcell this turn is about, as a display name — from the tool call
 *  arguments first, else the single workcell named in the answer. */
function turnWorkcell(t: Turn, names: string[], byKey: Map<string, string>): string | undefined {
  const arg = t.meta?.calls?.[0]?.args?.workcell;
  if (typeof arg === 'string' && arg) {
    const hit = byKey.get(normKey(arg));
    if (hit) return hit;
  }
  const found = new Set<string>();
  for (const n of names) {
    if (t.content.toUpperCase().includes(n.toUpperCase())) found.add(byKey.get(normKey(n)) ?? n);
  }
  return found.size === 1 ? [...found][0] : undefined;
}

interface Turn {
  role: 'user' | 'assistant';
  content: string;
  meta?: Pick<ChatAnswer, 'calls' | 'sources' | 'elapsed_s' | 'error' | 'grounded' | 'sql' | 'lane' | 'table' | 'intent' | 'model'>;
}

/** Assistant markdown, streamed-safe. Streamdown styles incomplete blocks as
 *  tokens arrive (bold is bold before the closing **), renders GFM tables, and
 *  is hardened by default. The overrides keep our entity links alive inside
 *  markdown text; table cells keep streamdown's own styling (links there come
 *  from the structured meta.table instead). Headings are stepped down to
 *  bubble scale — a chat answer with an h1 shouts. */
function MdAnswer({ text, names, byKey, ctxWc }: {
  text: string;
  names: string[];
  byKey: Map<string, string>;
  ctxWc?: string;
}) {
  const wrap = (children: ReactNode): ReactNode => {
    const one = (c: ReactNode, i: number): ReactNode =>
      typeof c === 'string' ? <span key={i}>{linkify(c, names, byKey, ctxWc)}</span> : c;
    return Array.isArray(children) ? children.map(one) : one(children, 0);
  };
  const mk = (Tag: keyof JSX.IntrinsicElements, cls?: string) =>
    (props: { children?: ReactNode }) => <Tag className={cls}>{wrap(props.children)}</Tag>;
  return (
    <Streamdown
      className="space-y-2 [&_table]:text-xs"
      components={{
        p: mk('p'),
        li: mk('li', 'my-0.5'),
        strong: mk('strong', 'font-semibold'),
        em: mk('em'),
        h1: mk('h3', 'mt-2 text-sm font-bold'),
        h2: mk('h4', 'mt-2 text-sm font-semibold'),
        h3: mk('h4', 'mt-1.5 text-[13px] font-semibold'),
      }}
    >
      {text}
    </Streamdown>
  );
}

/** Where to go for the full picture — one deterministic suggestion per answer,
 *  mapped from the intent that produced it. */
function suggestion(t: Turn, ctxWc?: string): { label: string; to: string } | null {
  const intent = t.meta?.intent;
  if (!intent || t.meta?.error) return null;
  const asm = t.meta?.calls?.[0]?.args?.assembly;
  if (['model_status', 'model_bom', 'model_cycle_time'].includes(intent)
      && ctxWc && typeof asm === 'string' && asm) {
    return { label: `the ${asm} model page`, to: modelHref(ctxWc, asm) };
  }
  if (['workcell_completion', 'models_by_status'].includes(intent) && ctxWc) {
    return { label: `the ${ctxWc} workcell page`, to: wcHref(ctxWc) };
  }
  if (intent === 'completion_trend') return { label: 'the 4Q report', to: '/cycle-time/4q' };
  if (intent === 'plant_completion') return { label: 'the plant report', to: '/cycle-time/home' };
  if (intent === 'open_query') {
    return ctxWc
      ? { label: `the ${ctxWc} workcell page`, to: wcHref(ctxWc) }
      : { label: 'the plant report', to: '/cycle-time/home' };
  }
  return null;
}

/** A query result as a real table. Numbers right-aligned; the raw text answer
 *  above it is only the model's one-sentence lead-in. Workcell and assembly
 *  cells link to their pages. */
function ResultTable({ table, byKey, ctxWc }: {
  table: NonNullable<ChatAnswer['table']>;
  byKey: Map<string, string>;
  ctxWc?: string;
}) {
  const numeric = table.columns.map(c =>
    table.rows.every(r => r[c] === null || typeof r[c] === 'number'));

  function cell(r: Record<string, unknown>, c: string): ReactNode {
    const v = r[c];
    if (v === null || v === undefined) return '—';
    if (typeof v === 'number') return v.toLocaleString();
    const s = String(v);
    if (c === 'workcell' || c === 'customer') {
      return <Link className={LINK_CLS} to={wcHref(s)}>{s}</Link>;
    }
    if (c === 'workcell_key') {
      const display = byKey.get(s) ?? s;
      return <Link className={LINK_CLS} to={wcHref(display)}>{s}</Link>;
    }
    if (c === 'assembly') {
      const rowWc = (typeof r.workcell === 'string' && r.workcell)
        || (typeof r.workcell_key === 'string' && (byKey.get(r.workcell_key) ?? r.workcell_key))
        || ctxWc;
      if (rowWc) return <Link className={LINK_CLS} to={modelHref(rowWc, s)}>{s}</Link>;
    }
    return s;
  }
  return (
    <div className="mt-2 overflow-x-auto rounded border border-border/60">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-muted/50">
            {table.columns.map((c, i) => (
              <th key={c} className={cn('px-2.5 py-1.5 font-medium text-muted-foreground',
                numeric[i] ? 'text-right' : 'text-left')}>
                {c.replace(/_/g, ' ')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r, i) => (
            <tr key={i} className="border-t border-border/40">
              {table.columns.map((c, j) => (
                <td key={c} className={cn('px-2.5 py-1',
                  numeric[j] ? 'text-right font-mono tabular-nums' : '')}>
                  {cell(r, c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Questions that exercise a different tool each — a blank chat box is the
 *  fastest way to make someone close the page. */
const EXAMPLES = [
  'How complete is KEYSIGHT?',
  'Which LAMRESEARCH models have no cycle time?',
  'Show me the BOM for PCA-01156-15',
  'Are we improving week on week?',
];

export default function CycleTimeChat({ inDrawer = false }: { inDrawer?: boolean }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  /** What the server is doing right now ("routing…", "reading the mart…"),
   *  and the partial answer while it streams. */
  const [stage, setStage] = useState('');
  const [live, setLive] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const health = useQuery({
    queryKey: ['ct-chat-health'],
    queryFn: () => cycleTimeApi.chat.health(),
    staleTime: 60_000,
    retry: false,
  });

  // The entity dictionary: display names + normalised-key lookup, from the
  // customer list the app already caches for an hour.
  const customers = useCycleTimeCustomers();
  const { wcNames, byKey } = useMemo(() => {
    const names = [...new Set((customers.data ?? []).map(c => c.customer).filter(Boolean))];
    return { wcNames: names, byKey: new Map(names.map(n => [normKey(n), n])) };
  }, [customers.data]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [turns, busy]);

  // Text only, and only the last few. Replaying tool payloads would fill an 8k
  // context window in about three questions.
  const history = useMemo(
    () => turns.slice(-6).map(t => ({ role: t.role, content: t.content })),
    [turns]);

  async function send(q: string) {
    const question = q.trim();
    if (!question || busy) return;
    setDraft('');
    setTurns(t => [...t, { role: 'user', content: question }]);
    setBusy(true);
    setStage('routing…');
    setLive('');
    try {
      let r: ChatAnswer;
      try {
        // Streamed: stage lines while the server works, tokens as the answer
        // is written. Falls back to the plain call — an old server without
        // /chat/stream must degrade to slow, never to broken.
        let acc = '';
        r = await cycleTimeApi.chat.stream(question, history, (e) => {
          if (e.type === 'stage') setStage(e.text ?? '');
          if (e.type === 'delta') { acc += e.text ?? ''; setLive(acc); }
        });
      } catch {
        r = await cycleTimeApi.chat.ask(question, history);
      }
      setTurns(t => [...t, { role: 'assistant', content: r.answer, meta: r }]);
    } catch (e) {
      setTurns(t => [...t, {
        role: 'assistant',
        content: `The request failed: ${(e as Error).message}`,
        meta: { calls: [], sources: [], elapsed_s: 0, error: 'request_failed',
                grounded: false, lane: 'error', intent: 'none' },
      }]);
    } finally {
      setBusy(false);
      setStage('');
      setLive('');
    }
  }

  const down = health.data && !health.data.ok;

  return (
    <div className="flex h-full flex-col">
      {/* In the drawer the Sheet's X sits top-right, so the header slims down,
          keeps clear of it (pr-12) and drops the tagline — a drawer needs a
          label, not a landing page. */}
      <div className={cn('border-b border-border', inDrawer ? 'px-4 py-3 pr-12' : 'px-6 py-4')}>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className={cn('font-bold', inDrawer ? 'text-base' : 'text-lg')}>Ask the data</h1>
          {health.data?.ok && (
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              {health.data.model} · {health.data.tools.length} tools
            </span>
          )}
        </div>
        {!inDrawer && (
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Answers come from the same marts these pages read. Every reply shows which one.
          </p>
        )}
      </div>

      {/* A dead model must say so. A spinner that never resolves is how someone
          concludes the whole module is broken. */}
      {down && (
        <div className={cn(inDrawer ? 'mx-4' : 'mx-6',
          'mt-4 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400')}>
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-medium">The local model is not reachable.</div>
            <div className="mt-0.5 opacity-90">{health.data?.detail}</div>
          </div>
        </div>
      )}

      <div className={cn('min-h-0 flex-1 space-y-4 overflow-auto py-5', inDrawer ? 'px-4' : 'px-6')}>
        {!turns.length && (
          <div className="mx-auto max-w-lg pt-8 text-center">
            <Bot className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">
              Ask about completion, models, cycle times or BOMs.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {EXAMPLES.map(x => (
                <button key={x} onClick={() => send(x)} disabled={busy || down}
                  className="rounded-full border border-border px-3 py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-50">
                  {x}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((t, i) => {
          const ctxWc = t.role === 'assistant' ? turnWorkcell(t, wcNames, byKey) : undefined;
          return (
          <div key={i} className={cn('flex gap-3', t.role === 'user' && 'justify-end')}>
            {t.role === 'assistant' && (
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                <Bot className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
            <div className={cn('min-w-0 max-w-[42rem] rounded-xl px-3.5 py-2.5 text-sm',
              t.role === 'user' ? 'bg-primary text-primary-foreground' : 'border border-border bg-card')}>
              <div className="break-words">
                {t.role === 'assistant'
                  ? <MdAnswer text={t.content} names={wcNames} byKey={byKey} ctxWc={ctxWc} />
                  : <span className="whitespace-pre-wrap">{t.content}</span>}
              </div>

              {/* An ungrounded answer must not dress like a sourced one — the
                  two read identically, which is exactly the danger. */}
              {t.meta && t.meta.grounded === false && t.meta.lane === 'general' && (
                <div className="mt-2 border-t border-border/60 pt-2 text-[10px] italic text-muted-foreground">
                  general answer — not from your data
                </div>
              )}

              {t.meta?.table && <ResultTable table={t.meta.table} byKey={byKey} ctxWc={ctxWc} />}

              {/* The SELECT behind an open answer. A wrong query should be
                  checkable, not invisible. */}
              {t.meta?.sql && (
                <pre className="mt-2 overflow-x-auto rounded bg-muted/60 p-2 font-mono text-[10px] text-muted-foreground">
                  {t.meta.sql}
                </pre>
              )}

              {/* One door onward — the page with the full picture. */}
              {t.role === 'assistant' && (() => {
                const s = suggestion(t, ctxWc);
                return s && (
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    → See <Link className={LINK_CLS} to={s.to}>{s.label}</Link> for more.
                  </div>
                );
              })()}

              {/* The audit trail. Deliberately always visible. */}
              {t.meta && (t.meta.calls.length > 0 || t.meta.sources.length > 0) && (
                <div className="mt-2 space-y-1 border-t border-border/60 pt-2 text-[10px] text-muted-foreground">
                  {t.meta.calls.map((c, j) => (
                    <div key={j} className="font-mono">
                      <span className={c.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                        {c.ok ? '✓' : '!'}
                      </span>{' '}
                      {c.tool}({Object.entries(c.args).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ')})
                    </div>
                  ))}
                  {t.meta.sources.map((s, j) => <div key={`s${j}`}>source: {s}</div>)}
                  {t.meta.elapsed_s > 0 && (
                    <div>
                      {t.meta.elapsed_s}s
                      {t.meta.model && <span className="font-mono"> · {t.meta.model}</span>}
                    </div>
                  )}
                </div>
              )}
            </div>
            {t.role === 'user' && (
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
          </div>
          );
        })}

        {busy && (
          <div className="flex gap-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
              <Bot className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 max-w-[42rem] rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm">
              {live
                ? <div className="break-words"><MdAnswer text={live} names={wcNames} byKey={byKey} /></div>
                : (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>{stage || 'reading the marts…'}</span>
                    {/* Which brain is on the request — the configured primary;
                        the receipt under the answer names who ACTUALLY spoke. */}
                    {health.data?.ok && (
                      <span className="font-mono text-[10px] opacity-60">{health.data.model}</span>
                    )}
                  </div>
                )}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className={cn('border-t border-border py-4', inDrawer ? 'px-4' : 'px-6')}>
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter breaks the line — the convention
              // everyone already has in their fingers.
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(draft); }
            }}
            rows={1}
            maxLength={500}
            disabled={busy || down}
            placeholder={down ? 'The local model is not running.' : 'Ask about a workcell, a model, a BOM…'}
            className="max-h-32 min-h-[2.5rem] flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground disabled:opacity-60"
          />
          <Button size="sm" className="h-10 w-10 p-0" disabled={busy || down || !draft.trim()}
            onClick={() => send(draft)} title="Send">
            <ArrowUp className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          The model chooses which report to read — it never writes SQL and never does the arithmetic.
        </p>
      </div>
    </div>
  );
}
