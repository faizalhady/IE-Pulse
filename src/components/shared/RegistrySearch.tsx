/**
 * RegistrySearch — one box, three kinds of answer.
 *
 * Someone arriving at Cycle Time knows a part number, or a workcell, or the
 * name of a step they saw on a screen on the floor. Today they have to know
 * WHICH of those it is before they can look for it — models live on one page,
 * workcells on another, process names nowhere at all.
 *
 * This does not make them choose. Type anything; the results say what it was.
 *
 * Matching ignores case and punctuation on the server, because the whole reason
 * the registry exists is that nobody spells these the same way twice — IEDB
 * stores packout thirteen ways, one of them with a trailing space.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Boxes, Building2, Loader2, Search, Workflow } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { cycleTimeApi } from '@/lib/cycle_time/cycleTimeApi';

type Hit =
  | { kind: 'workcell'; workcell: string }
  | { kind: 'model'; workcell: string; assembly: string; hasData: boolean; description: string }
  | { kind: 'process'; workcell: string; key: string; name: string; iedb: string; mes: string };

export function RegistrySearch({ className }: { className?: string }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  // Debounced: the box fires on every keystroke and the model catalogue is
  // 350k rows. 200ms is below the threshold where typing feels laggy.
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 200);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isFetching } = useQuery({
    queryKey: ['registry-search', debounced],
    queryFn: () => cycleTimeApi.registry.search(debounced),
    enabled: debounced.trim().length >= 2,
  });

  const hits: Hit[] = useMemo(() => {
    if (!data) return [];
    return [
      ...data.workcells.map((w) => ({ kind: 'workcell' as const, workcell: w.workcell })),
      ...data.models.map((m) => ({
        kind: 'model' as const, workcell: m.workcell, assembly: m.assembly,
        hasData: m.has_data, description: m.description,
      })),
      ...data.processes.map((p) => ({
        kind: 'process' as const, workcell: p.workcell, key: p.process_key,
        name: p.process_name, iedb: p.iedb_aliases, mes: p.mes_steps,
      })),
    ];
  }, [data]);

  useEffect(() => { setActive(0); }, [hits.length]);

  // Click-away
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  function go(h: Hit) {
    setOpen(false);
    setQ('');
    const wc = encodeURIComponent(h.workcell);
    // A process hit lands on the workcell's Processes tab — the only place the
    // MES/IEDB names sit side by side.
    if (h.kind === 'process') navigate(`/cycle-time/${wc}?tab=registry`);
    else navigate(`/cycle-time/${wc}`);
  }

  return (
    <div ref={box} className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={q}
        placeholder="Search a workcell, model or process…"
        className="pl-9"
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((n) => Math.min(n + 1, hits.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((n) => Math.max(n - 1, 0)); }
          else if (e.key === 'Enter' && hits[active]) go(hits[active]);
          else if (e.key === 'Escape') setOpen(false);
        }}
      />
      {isFetching && (
        <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}

      {open && q.trim().length >= 2 && (
        <div className="absolute z-30 mt-1 max-h-96 w-full overflow-y-auto rounded-lg border bg-popover shadow-lg">
          {hits.length === 0 && !isFetching && (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              Nothing matches “{q}”
            </div>
          )}
          {hits.map((h, i) => (
            <button
              key={`${h.kind}-${i}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(h)}
              className={cn('flex w-full items-start gap-2.5 px-3 py-2 text-left',
                i === active && 'bg-muted')}
            >
              {h.kind === 'workcell' && <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
              {h.kind === 'model' && <Boxes className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
              {h.kind === 'process' && <Workflow className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
              <span className="min-w-0 flex-1">
                {h.kind === 'workcell' && <span className="font-medium">{h.workcell}</span>}
                {h.kind === 'model' && (<>
                  <span className="font-mono text-sm">{h.assembly}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{h.workcell}</span>
                  {!h.hasData && (
                    <span className="ml-2 rounded bg-rose-500/10 px-1.5 text-[11px] text-rose-600">
                      no cycle time
                    </span>
                  )}
                  {h.description && (
                    <div className="truncate text-xs text-muted-foreground">{h.description}</div>
                  )}
                </>)}
                {h.kind === 'process' && (<>
                  <span className="font-mono text-sm">{h.key}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{h.workcell}</span>
                  {/* both systems' words, because either is what they typed */}
                  <div className="truncate text-xs text-muted-foreground">
                    IEDB: {h.iedb || '—'} · MES: {h.mes || '—'}
                  </div>
                </>)}
              </span>
              <span className="mt-0.5 shrink-0 text-[11px] uppercase tracking-wide text-muted-foreground/70">
                {h.kind}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
