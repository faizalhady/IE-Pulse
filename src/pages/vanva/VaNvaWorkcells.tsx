/**
 * VaNvaWorkcells.tsx
 * ───────────────────
 * League table of every workcell, ranked by NVA % descending (worst first) —
 * the same league-table pattern as LBR / IPK / PPQT. Click a row to drill in.
 *
 * Route: /va-nva/workcells
 */

import { Input } from '@/components/ui/input';
import { useVaNvaRows } from '@/hooks/va_nva/useVaNvaData';
import { getWorkcellLogo } from '@/lib/ole/oleConstants';
import { cn } from '@/lib/utils';
import { countable, plantTotals } from '@/lib/va_nva/vanvaCalc';
import {
  NVA_TARGET, STAGE_BADGE, STAGE_LABEL, VANVA_STATUS_BADGE, VANVA_STATUS_BAR,
  VANVA_STATUS_LABEL, dl, nvaTextClass, pct, signed, sizingGapClass,
} from '@/lib/va_nva/vanvaConstants';
import type { VaNvaMetrics, VaNvaStatus } from '@/pages/vanva/types';
import {
  ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, Scale, Search,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const GRID = '2.5rem minmax(9rem,1fr) 5rem 5rem 5rem 6.5rem 5rem 5.5rem 5rem 5.5rem 1.5rem';

type SortCol = 'workcell' | 'overallRound' | 'vaSizingRound' | 'nvaMfg' | 'nvaRatio' | 'vaActual' | 'sizingGap' | 'toReduce';

const HEADERS: { key: SortCol | null; label: string; right?: boolean }[] = [
  { key: null, label: '#' },
  { key: 'workcell', label: 'Workcell' },
  { key: 'overallRound', label: 'Total DL', right: true },
  { key: 'vaSizingRound', label: 'VA', right: true },
  { key: 'nvaMfg', label: 'NVA', right: true },
  { key: 'nvaRatio', label: 'NVA %', right: true },
  { key: 'vaActual', label: 'Actual', right: true },
  { key: 'sizingGap', label: 'Act−Size', right: true },
  { key: 'toReduce', label: 'To cut', right: true },
  { key: null, label: 'Stage', right: true },
  { key: null, label: '' },
];

export default function VaNvaWorkcells() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ col: SortCol; dir: 'asc' | 'desc' }>({ col: 'nvaRatio', dir: 'desc' });
  const { rows } = useVaNvaRows(NVA_TARGET);

  const list = useMemo(() => countable(rows), [rows]);
  const totals = useMemo(() => plantTotals(rows, NVA_TARGET), [rows]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const base = term ? list.filter(r => r.workcell.toLowerCase().includes(term)) : list;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...base].sort((a, b) => {
      // Rows with no NVA figure can't be ranked — always sink them.
      const aM = a.nvaRatio !== null, bM = b.nvaRatio !== null;
      if (aM !== bM) return aM ? -1 : 1;
      const av = a[sort.col], bv = b[sort.col];
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv : String(av).localeCompare(String(bv));
      return cmp * dir;
    });
  }, [list, search, sort]);

  const byStatus = useMemo(() => {
    const c: Record<VaNvaStatus, number> = { healthy: 0, warning: 0, critical: 0, unknown: 0 };
    list.forEach(r => { c[r.status]++; });
    return c;
  }, [list]);

  const onSort = (col: SortCol | null) => {
    if (!col) return;
    setSort(cur => cur.col === col ? { col, dir: cur.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'desc' });
  };

  return (
    <div className="relative">
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Scale className="h-4 w-4 text-teal-500" /> VA / NVA — Workcells
            </h1>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {list.length} workcells · plant NVA {pct(totals.nvaRatio)} · {totals.aboveTarget} above {pct(NVA_TARGET, 0)}
            </p>
          </div>
        </div>
      </div>

      <div className="p-5 flex flex-col gap-4">
        <div className="relative w-[280px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search workcell…" className="pl-8 h-9" />
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="grid bg-muted/50 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold border-b border-border"
            style={{ gridTemplateColumns: GRID }}>
            {HEADERS.map((h, i) => (
              <button key={i} onClick={() => onSort(h.key)}
                className={cn('px-2 py-2.5 flex items-center gap-1', h.right && 'justify-end',
                  h.key ? 'hover:text-foreground cursor-pointer' : 'cursor-default')}>
                {h.label}
                {h.key && (sort.col === h.key
                  ? (sort.dir === 'asc' ? <ArrowUp className="h-3 w-3 text-foreground" /> : <ArrowDown className="h-3 w-3 text-foreground" />)
                  : <ArrowUpDown className="h-3 w-3 opacity-30" />)}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">No workcells match the search.</div>
          ) : filtered.map((r: VaNvaMetrics, idx) => {
            const logo = getWorkcellLogo(r.workcell);
            return (
              <button key={r.id} onClick={() => navigate(`/va-nva/wc/${encodeURIComponent(r.id)}`)}
                className="group grid items-center w-full text-left border-b border-border last:border-0 hover:bg-muted/30 transition-colors relative"
                style={{ gridTemplateColumns: GRID, height: 56 }}>
                <span className={cn('absolute left-0 top-0 bottom-0 w-0.5', VANVA_STATUS_BAR[r.status])} />
                <div className="px-2 text-sm font-mono font-bold text-muted-foreground tabular-nums">{idx + 1}</div>
                <div className="px-2 flex items-center gap-3 min-w-0">
                  {logo ? (
                    <div className="w-12 h-7 rounded border border-border bg-white flex items-center justify-center overflow-hidden flex-shrink-0">
                      <img src={logo} alt={r.workcell} className="w-full h-full object-contain p-0.5" />
                    </div>
                  ) : (
                    <div className="w-12 h-7 rounded border border-border bg-muted flex items-center justify-center flex-shrink-0">
                      <span className="text-[9px] font-bold text-muted-foreground">{r.workcell.slice(0, 3).toUpperCase()}</span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{r.workcell}</p>
                    {r.role === 'parent' && <p className="text-[9px] text-muted-foreground">rollup</p>}
                  </div>
                </div>
                <div className="px-2 text-right text-[11px] font-mono text-foreground tabular-nums">{dl(r.overallRound)}</div>
                <div className="px-2 text-right text-[11px] font-mono text-emerald-400 tabular-nums">{dl(r.vaSizingRound)}</div>
                <div className="px-2 text-right text-[11px] font-mono text-red-400 tabular-nums">{dl(r.nvaMfg)}</div>
                <div className="px-2">
                  <p className={cn('text-right text-sm font-mono font-black tabular-nums leading-none', nvaTextClass(r.nvaRatio))}>
                    {pct(r.nvaRatio)}
                  </p>
                  <div className="mt-1 h-1 rounded-full bg-muted/40 overflow-hidden">
                    <div className={cn('h-full rounded-full', VANVA_STATUS_BAR[r.status])}
                      style={{ width: `${Math.min((r.nvaRatio ?? 0) * 100 * 2, 100)}%` }} />
                  </div>
                </div>
                <div className="px-2 text-right text-[11px] font-mono text-sky-400 tabular-nums">{dl(r.vaActual)}</div>
                <div className={cn('px-2 text-right text-[11px] font-mono tabular-nums', sizingGapClass(r.sizingGap))}>{signed(r.sizingGap)}</div>
                <div className={cn('px-2 text-right text-[11px] font-mono font-semibold tabular-nums',
                  (r.toReduce ?? 0) > 0 ? 'text-red-400' : r.toReduce === null ? 'text-muted-foreground' : 'text-emerald-400')}>
                  {signed(r.toReduce)}
                </div>
                <div className="px-2 flex justify-end">
                  {r.stage
                    ? <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded border whitespace-nowrap', STAGE_BADGE[r.stage])}>{STAGE_LABEL[r.stage]}</span>
                    : <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded border whitespace-nowrap', VANVA_STATUS_BADGE.unknown)}>—</span>}
                </div>
                <div className="px-1 flex justify-center">
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-teal-400 group-hover:translate-x-0.5 transition-all" />
                </div>
              </button>
            );
          })}
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden max-w-md">
          <div className="px-4 py-2.5 border-b border-border">
            <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Workcells by verdict</p>
          </div>
          {([
            { key: 'healthy' as VaNvaStatus, label: 'Lean · NVA ≤ 25%' },
            { key: 'warning' as VaNvaStatus, label: 'Watch · NVA 25–35%' },
            { key: 'critical' as VaNvaStatus, label: 'Critical · NVA > 35%' },
            { key: 'unknown' as VaNvaStatus, label: 'No NVA recorded' },
          ]).map((s, i, arr) => {
            const count = byStatus[s.key];
            const p = list.length ? (count / list.length) * 100 : 0;
            return (
              <div key={s.key} className={cn('flex items-center gap-3 px-4 py-2.5', i < arr.length - 1 && 'border-b border-border')}>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-foreground">{s.label}</p>
                  <div className="mt-1.5 h-1 rounded-full bg-muted/40 overflow-hidden">
                    <div className={cn('h-full rounded-full', VANVA_STATUS_BAR[s.key])} style={{ width: `${p}%` }} />
                  </div>
                </div>
                <span className="text-xl font-mono font-bold text-foreground flex-shrink-0 tabular-nums">{count > 0 ? count : '—'}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
