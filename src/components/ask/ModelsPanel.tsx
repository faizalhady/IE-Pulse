/**
 * ModelsPanel — a small icon that opens the free-model chain: every slot, what this
 * server used today against the free tier's limit, and when the count resets.
 */

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { askApi, type ModelRow } from '@/lib/ask/askApi';
import { cn } from '@/lib/utils';
import { Signal } from 'lucide-react';
import { useEffect, useState } from 'react';

const n = (v: number) => v.toLocaleString('en-US');

function resetsLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `resets ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function cooling(s: number): string {
  if (s <= 0) return '';
  if (s < 90) return `cooling ${s}s`;
  if (s < 5400) return `cooling ${Math.round(s / 60)}m`;
  return `cooling ${Math.round(s / 3600)}h`;
}

export function ModelsPanel({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ModelRow[] | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    askApi
      .models()
      .then((d) => { if (alive) { setRows(d.models); setNote(d.note); setError(null); } })
      .catch((e) => { if (alive) setError(String(e.message || e)); });
    return () => { alive = false; };
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Models" title="Models and usage" className={cn('size-8', className)}>
          <Signal className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0">
        <div className="border-b px-3 py-2">
          <div className="text-sm font-semibold">Models</div>
          <p className="text-xs text-muted-foreground">
            {note || 'Usage is what this server sent today (UTC); the providers count separately. Daily limits reset at midnight UTC (08:00 MYT).'}
          </p>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {error && <p className="px-3 py-2 text-xs text-destructive">{error}</p>}
          {!rows && !error && <p className="px-3 py-2 text-xs text-muted-foreground">Loading…</p>}
          {rows?.map((r) => <Row key={r.slot} r={r} />)}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Row({ r }: { r: ModelRow }) {
  const noKey = r.key === 'MISSING';
  const cool = cooling(r.cooldown_s);
  const { rpd, tpd } = r.limits;
  const usage = [
    rpd ? `${n(r.calls)} / ${n(rpd)} req` : `${n(r.calls)} req`,
    tpd ? `${n(r.tokens)} / ${n(tpd)} tokens` : `${n(r.tokens)} tokens`,
  ].join(' · ');
  return (
    <div className={cn('border-b px-3 py-2 last:border-b-0', noKey && 'opacity-60')}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{r.slot}</div>
          <div className="truncate text-[11px] text-muted-foreground">{r.model}</div>
        </div>
        <div className="shrink-0 text-right text-[11px] text-muted-foreground">
          {noKey ? <span className="text-destructive">no key</span> : cool ? <span className="text-amber-600">{cool}</span> : `${r.usage_pct}%`}
        </div>
      </div>
      <Progress value={noKey ? 0 : r.usage_pct} className="mt-1.5 h-1.5" aria-label={`${r.slot} usage`} />
      <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{usage}{!rpd && !tpd ? ' · no daily limit known' : ''}</span>
        <span>{resetsLabel(r.resets_at)}</span>
      </div>
    </div>
  );
}
