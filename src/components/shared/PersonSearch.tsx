/**
 * PersonSearch.tsx
 * ────────────────
 * Reusable headcount picker. Type a name or NTID, pick a person, get their full
 * HC record back.
 *
 * Built to be dropped anywhere that needs "who is this for?" — assigning an OLE
 * 4Q improvement task, naming a workcell PIC, choosing an email recipient. The
 * caller decides what to do with the person; this only finds them.
 *
 * Usage:
 *   <PersonSearch onPick={p => setAssignee(p)} placeholder="Assign to…" />
 */

import { Input } from '@/components/ui/input';
import { hcApi, displayName, type HcPerson } from '@/lib/hc/hcApi';
import { cn } from '@/lib/utils';
import { Loader2, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export function PersonSearch({
  onPick,
  placeholder = 'Search name or NTID…',
  autoFocus = false,
  className,
  limit = 25,
}: {
  onPick: (p: HcPerson) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  limit?: number;
}) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<HcPerson[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced: 11,923 people and a substring match, so firing per keystroke is
  // both wasteful and jumpy. `seq` drops responses that arrive out of order —
  // typing fast otherwise lets an older, broader result overwrite a newer one.
  const seq = useRef(0);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setRows([]); setTotal(0); setErr(null); return; }
    const mine = ++seq.current;
    const id = setTimeout(() => {
      setLoading(true);
      hcApi.search(term, limit)
        .then(r => { if (mine === seq.current) { setRows(r.results); setTotal(r.total); setErr(null); setActive(0); } })
        .catch(e => { if (mine === seq.current) { setErr(String(e.message ?? e)); setRows([]); } })
        .finally(() => { if (mine === seq.current) setLoading(false); });
    }, 220);
    return () => clearTimeout(id);
  }, [q, limit]);

  // Click-away closes the list without clearing what was typed.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function pick(p: HcPerson) {
    onPick(p);
    setOpen(false);
    setQ('');
    setRows([]);
  }

  function onKey(e: React.KeyboardEvent) {
    if (!open || !rows.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, rows.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(rows[active]); }
    else if (e.key === 'Escape') { setOpen(false); }
  }

  return (
    <div ref={boxRef} className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={q}
        autoFocus={autoFocus}
        onChange={e => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
        placeholder={placeholder}
        className="h-9 pl-8 pr-8 text-sm"
      />
      {loading && <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />}
      {!loading && q && (
        <button onClick={() => { setQ(''); setRows([]); }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {open && (q.trim().length >= 2 || err) && (
        <div className="absolute z-50 mt-1 max-h-80 w-full overflow-y-auto rounded-lg border bg-popover shadow-lg">
          {err && (
            <div className="px-3 py-2.5 text-xs text-muted-foreground">
              Could not reach the headcount service. {err}
            </div>
          )}
          {!err && !loading && rows.length === 0 && (
            <div className="px-3 py-2.5 text-xs text-muted-foreground">No one matches “{q.trim()}”.</div>
          )}
          {rows.map((p, i) => (
            <button key={`${p.ntid}-${i}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(p)}
              className={cn('flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors',
                i === active ? 'bg-muted' : 'hover:bg-muted/60')}>
              <div className="flex items-baseline gap-2">
                <span className="truncate text-sm font-medium">{displayName(p)}</span>
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{p.ntid}</span>
              </div>
              <div className="truncate text-[11px] text-muted-foreground">
                {[p.businessTitle, p.dept, p.customer].filter(Boolean).join(' · ') || p.email || '—'}
              </div>
            </button>
          ))}
          {total > rows.length && (
            <div className="border-t px-3 py-1.5 text-[10px] text-muted-foreground">
              showing {rows.length} of {total.toLocaleString()} — keep typing to narrow
            </div>
          )}
        </div>
      )}
    </div>
  );
}
