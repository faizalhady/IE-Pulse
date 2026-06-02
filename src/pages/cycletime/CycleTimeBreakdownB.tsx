/**
 * CycleTimeBreakdownB.tsx
 * ───────────────────────
 * "Assembly Analytics" — list every unique assembly for the customer, searchable
 * + line-filterable + sortable. Click a row to open the shared assembly drawer
 * (process routing waterfall + per-workcenter build picker). The SMT/TH/BE split
 * and the per-step detail live in that drawer, not in the table.
 *
 * The list comes from the server-side /assemblies aggregate (one small request).
 */

import { useVirtualizer } from '@tanstack/react-virtual';
import { AlertCircle, ArrowDown, ArrowUp, ArrowUpDown, Clock, Layers, Loader2, Search } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useCycleTimeAliases,
  useCycleTimeAssemblies,
} from '@/hooks/cycle_time/useCycleTimeData';
import { cn } from '@/lib/utils';

import CycleTimeAssemblyDrawer from './CycleTimeAssemblyDrawer';

interface Props {
  customer: string | undefined;
}

const ALL_LINES = '__all__';

interface AssemblyRow {
  assembly: string;
  family: string | null;
  builds: number;
  total: number; // total cycle time — used for the default "longest first" order
}

type SortCol = 'assembly' | 'builds';

const GRID = 'minmax(220px,1fr) 6rem';
const ROW_H = 44;

export default function CycleTimeBreakdownB({ customer }: Props) {
  const [line, setLine] = useState('');
  const { data: aggs, isFetching, error } = useCycleTimeAssemblies(customer, line || undefined);
  const { data: aliasMap } = useCycleTimeAliases(customer);

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ col: SortCol; dir: 'asc' | 'desc' } | null>(null);
  const [openAssembly, setOpenAssembly] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Line options derived from the alias map (union of lines each process runs on).
  const lines = useMemo(() => {
    const s = new Set<string>();
    Object.values(aliasMap ?? {}).forEach((info) => info.lines.forEach((l) => s.add(l)));
    return Array.from(s).sort();
  }, [aliasMap]);

  // ── Normalise aggregate → assembly rows (sorted longest first) ───────────────
  const rows = useMemo<AssemblyRow[]>(() => {
    if (!aggs || aggs.length === 0) return [];
    const out: AssemblyRow[] = aggs.map((a) => ({
      assembly: a.assembly,
      family: a.family,
      builds: a.builds,
      total: a.total ?? 0,
    }));
    out.sort((a, b) => b.total - a.total);
    return out;
  }, [aggs]);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    return t ? rows.filter((r) => r.assembly.toLowerCase().includes(t)) : rows;
  }, [rows, search]);

  // Default order is total descending (longest first); a column click overrides it.
  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const c = sort.col === 'assembly'
        ? a.assembly.localeCompare(b.assembly)
        : a.builds - b.builds;
      return c * dir;
    });
  }, [filtered, sort]);

  const onSort = (col: SortCol) =>
    setSort((cur) => {
      if (!cur || cur.col !== col) return { col, dir: col === 'assembly' ? 'asc' : 'desc' };
      if (cur.dir === 'desc') return { col, dir: 'asc' };
      return null; // third click → back to default (longest first)
    });

  const virt = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_H,
    overscan: 12,
  });

  // ── States ──────────────────────────────────────────────────────────────────
  if (!customer) return <Centered icon={Layers}>Select a customer to analyse its assemblies.</Centered>;
  if (error) return <Centered icon={AlertCircle} tone="text-red-500/70">Couldn’t load assemblies: {(error as Error).message}</Centered>;
  if (isFetching && !aggs) return <Centered icon={Loader2} spin>Crunching assemblies…</Centered>;
  if (rows.length === 0) return <Centered icon={Layers}>No assembly cycle-time data for this customer.</Centered>;

  return (
    <div className="flex h-full flex-col">
      {/* ── Filters (same styling as the Table tab): search · line · count ── */}
      <div className="flex flex-wrap items-center gap-3 px-6 pt-4 pb-3">
        <div className="relative w-[260px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search assembly…" className="h-9 pl-8" />
        </div>

        <Select
          value={line || ALL_LINES}
          onValueChange={(v) => setLine(v === ALL_LINES ? '' : v)}
          disabled={lines.length === 0}
        >
          <SelectTrigger className="h-9 w-[220px]">
            <SelectValue placeholder="All lines" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_LINES}>All lines</SelectItem>
            {lines.map((l) => (
              <SelectItem key={l} value={l}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length.toLocaleString()}{filtered.length !== rows.length && ` of ${rows.length.toLocaleString()}`} assemblies
          {!sort && ' · longest first'}
        </span>
      </div>

      {/* ── Assembly table (virtualized) — click a row to open the drawer ── */}
      <div className="mx-6 mb-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
        <div
          className="grid border-b border-border bg-muted/50 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground"
          style={{ gridTemplateColumns: GRID }}
        >
          <HeadCell label="Assembly" col="assembly" sort={sort} onSort={onSort} />
          <HeadCell label="Builds"   col="builds"   sort={sort} onSort={onSort} align="right" />
        </div>

        <div ref={scrollRef} className="relative flex-1 overflow-auto">
          <div style={{ height: virt.getTotalSize(), position: 'relative' }}>
            {virt.getVirtualItems().map((vi) => {
              const a = sorted[vi.index];
              return (
                <button
                  key={a.assembly}
                  onClick={() => setOpenAssembly(a.assembly)}
                  className="absolute left-0 right-0 grid items-center border-b border-border/60 text-left hover:bg-muted/40 [&>div]:px-3"
                  style={{ transform: `translateY(${vi.start}px)`, height: vi.size, gridTemplateColumns: GRID }}
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-foreground">{a.assembly}</p>
                    {a.family && <p className="truncate text-[10px] text-muted-foreground">{a.family}</p>}
                  </div>
                  <div className="text-right font-mono text-xs tabular-nums text-muted-foreground">{a.builds}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Shared drawer ───────────────────────────────────────────────── */}
      <CycleTimeAssemblyDrawer
        customer={customer}
        assembly={openAssembly}
        onClose={() => setOpenAssembly(null)}
      />
    </div>
  );
}

// ─── Sortable header cell ─────────────────────────────────────────────────────

function HeadCell({
  label, col, sort, onSort, align,
}: {
  label: string;
  col: SortCol;
  sort: { col: SortCol; dir: 'asc' | 'desc' } | null;
  onSort: (col: SortCol) => void;
  align?: 'right';
}) {
  const active = sort?.col === col;
  return (
    <button
      type="button"
      onClick={() => onSort(col)}
      className={cn(
        'flex items-center gap-1 px-3 py-2.5 uppercase tracking-wider transition-colors hover:text-foreground',
        align === 'right' && 'justify-end',
      )}
    >
      {label}
      {active
        ? sort!.dir === 'asc'
          ? <ArrowUp className="h-3 w-3 text-foreground" />
          : <ArrowDown className="h-3 w-3 text-foreground" />
        : <ArrowUpDown className="h-3 w-3 opacity-30" />}
    </button>
  );
}

function Centered({
  children, icon: Icon, spin, tone,
}: {
  children: React.ReactNode; icon: typeof Clock; spin?: boolean; tone?: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <Icon className={cn('mb-3 h-8 w-8', tone ?? 'text-muted-foreground/50', spin && 'animate-spin')} />
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
