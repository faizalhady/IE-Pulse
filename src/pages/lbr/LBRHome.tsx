/**
 * LBRHome.tsx
 * ────────────
 * LBR landing — league table of every workcell, ranked by avg LBR ascending
 * (worst balance first). Logo + name on the left, balance stats on the right.
 * Click a row → /lbr/:workcell. Mirrors the league-table pattern used across
 * IPK / PPQT / Cycle Time.
 */

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getWorkcellLogo } from '@/lib/ole/oleConstants';
import { cn } from '@/lib/utils';
import {
  getLBRStatus, lbrTextClass, LBR_STATUS_BADGE, LBR_STATUS_BAR, LBR_STATUS_LABEL,
  LBR_PERIOD_OPTIONS, type LBRStatus,
} from '@/lib/lbr/lbrConstants';
import { useLBRWorkcells } from '@/hooks/lbr/useLBRWorkcells';
import type { LBRWorkcell } from './types';
import {
  ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, GitFork, RefreshCw, Search,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const GRID = '2.5rem minmax(9rem,1fr) 8rem 4.5rem 4.5rem 8rem 4rem 4.5rem 5.5rem 5.5rem 1.5rem';
type SortCol = 'name' | 'activeAssemblies' | 'totalPlaybooks' | 'avgLbr' | 'avgUph' | 'bottlenecks' | 'lastStudyDate' | 'status';
const HEADERS: { key: SortCol | null; label: string; right?: boolean }[] = [
  { key: null, label: '#' },
  { key: 'name', label: 'Workcell' },
  { key: null, label: 'Division' },
  { key: 'activeAssemblies', label: 'Asm', right: true },
  { key: 'totalPlaybooks', label: 'Plays', right: true },
  { key: 'avgLbr', label: 'Avg LBR', right: true },
  { key: 'avgUph', label: 'UPH', right: true },
  { key: 'bottlenecks', label: 'Bttlnk', right: true },
  { key: 'lastStudyDate', label: 'Last Study', right: true },
  { key: 'status', label: 'Status', right: true },
  { key: null, label: '' },
];

const hasStudy = (w: LBRWorkcell) => w.lastStudyDate !== null;

export default function LBRHome() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState('Monthly');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ col: SortCol; dir: 'asc' | 'desc' }>({ col: 'avgLbr', dir: 'asc' });
  const { data: workcells = [], refetch, isFetching } = useLBRWorkcells();

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = term
      ? workcells.filter(w => w.name.toLowerCase().includes(term) || w.division.toLowerCase().includes(term))
      : workcells;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      // Never-studied always sink to the bottom regardless of sort.
      if (hasStudy(a) !== hasStudy(b)) return hasStudy(a) ? -1 : 1;
      const av = a[sort.col], bv = b[sort.col];
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv));
      return cmp * dir;
    });
  }, [workcells, search, sort]);

  const byStatus = useMemo(() => {
    const counts: Record<LBRStatus, number> = { critical: 0, warning: 0, healthy: 0, never_studied: 0 };
    workcells.forEach(w => { counts[getLBRStatus(w.avgLbr, hasStudy(w))]++; });
    return counts;
  }, [workcells]);

  const onSort = (col: SortCol | null) => {
    if (!col) return;
    setSort(cur => cur.col === col ? { col, dir: cur.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' });
  };

  return (
    <div className="relative">
      {/* ─── Sticky header ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <GitFork className="h-4 w-4 text-emerald-500" />
              LBR
            </h1>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Line Balance Rate · {workcells.length} workcells
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{LBR_PERIOD_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
            <button onClick={() => refetch()} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} /> Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="p-5 flex flex-col gap-4">
        {/* search */}
        <div className="relative w-[280px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search workcell or division…" className="pl-8 h-9" />
        </div>

        {/* league table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="grid bg-muted/50 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold border-b border-border"
            style={{ gridTemplateColumns: GRID }}>
            {HEADERS.map((h, i) => (
              <button key={i} onClick={() => onSort(h.key)}
                className={cn('px-2 py-2.5 flex items-center gap-1', h.right && 'justify-end', h.key ? 'hover:text-foreground cursor-pointer' : 'cursor-default')}>
                {h.label}
                {h.key && (sort.col === h.key
                  ? (sort.dir === 'asc' ? <ArrowUp className="h-3 w-3 text-foreground" /> : <ArrowDown className="h-3 w-3 text-foreground" />)
                  : <ArrowUpDown className="h-3 w-3 opacity-30" />)}
              </button>
            ))}
          </div>

          {rows.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">No workcells match the search.</div>
          ) : rows.map((row, idx) => {
            const studied = hasStudy(row);
            const st = getLBRStatus(row.avgLbr, studied);
            const logo = getWorkcellLogo(row.name);
            return (
              <button key={row.id} onClick={() => navigate(`/lbr/${encodeURIComponent(row.id)}`)}
                className="group grid items-center w-full text-left border-b border-border last:border-0 hover:bg-muted/30 transition-colors relative"
                style={{ gridTemplateColumns: GRID, height: 56 }}>
                <span className={cn('absolute left-0 top-0 bottom-0 w-0.5', LBR_STATUS_BAR[st])} />
                <div className="px-2 text-sm font-mono font-bold text-muted-foreground tabular-nums">{idx + 1}</div>
                <div className="px-2 flex items-center gap-3 min-w-0">
                  {logo ? (
                    <div className="w-12 h-7 rounded border border-border bg-white flex items-center justify-center overflow-hidden flex-shrink-0">
                      <img src={logo} alt={row.name} className="w-full h-full object-contain p-0.5" />
                    </div>
                  ) : (
                    <div className="w-12 h-7 rounded border border-border bg-muted flex items-center justify-center flex-shrink-0">
                      <span className="text-[9px] font-bold text-muted-foreground">{row.name.slice(0, 3).toUpperCase()}</span>
                    </div>
                  )}
                  <p className="text-xs font-semibold text-foreground truncate">{row.name}</p>
                </div>
                <div className="px-2 text-[10px] text-muted-foreground truncate">{row.division}</div>
                <div className="px-2 text-right text-[11px] font-mono text-foreground tabular-nums">{row.activeAssemblies}</div>
                <div className="px-2 text-right text-[11px] font-mono text-muted-foreground tabular-nums">{studied ? row.totalPlaybooks : '—'}</div>
                <div className="px-2">
                  {studied ? (
                    <>
                      <p className={cn('text-right text-sm font-mono font-black tabular-nums leading-none', lbrTextClass(row.avgLbr))}>{row.avgLbr}%</p>
                      <div className="mt-1 h-1 rounded-full bg-muted/40 overflow-hidden">
                        <div className={cn('h-full rounded-full', LBR_STATUS_BAR[st])} style={{ width: `${Math.min(row.avgLbr, 100)}%` }} />
                      </div>
                    </>
                  ) : <p className="text-right text-[11px] font-mono text-muted-foreground">—</p>}
                </div>
                <div className="px-2 text-right text-[11px] font-mono text-muted-foreground tabular-nums">{studied ? row.avgUph : '—'}</div>
                <div className={cn('px-2 text-right text-[11px] font-mono font-semibold tabular-nums', row.bottlenecks > 0 ? 'text-red-400' : 'text-muted-foreground')}>
                  {row.bottlenecks > 0 ? row.bottlenecks : '—'}
                </div>
                <div className="px-2 text-right text-[10px] font-mono text-muted-foreground tabular-nums">{row.lastStudyDate ?? '—'}</div>
                <div className="px-2 flex justify-end">
                  <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded border whitespace-nowrap', LBR_STATUS_BADGE[st])}>{LBR_STATUS_LABEL[st]}</span>
                </div>
                <div className="px-1 flex justify-center">
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
                </div>
              </button>
            );
          })}
        </div>

        {/* status breakdown */}
        <div className="rounded-xl border border-border bg-card overflow-hidden max-w-md">
          <div className="px-4 py-2.5 border-b border-border">
            <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Workcells by Status</p>
          </div>
          {([
            { key: 'critical' as LBRStatus, label: 'Critical · LBR < 85' },
            { key: 'warning' as LBRStatus, label: 'Warning · LBR 85–90' },
            { key: 'healthy' as LBRStatus, label: 'Healthy · LBR ≥ 90' },
            { key: 'never_studied' as LBRStatus, label: 'Never Studied' },
          ]).map((r, i, arr) => {
            const count = byStatus[r.key];
            const pct = workcells.length ? (count / workcells.length) * 100 : 0;
            return (
              <div key={r.key} className={cn('flex items-center gap-3 px-4 py-2.5', i < arr.length - 1 && 'border-b border-border')}>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-foreground">{r.label}</p>
                  <div className="mt-1.5 h-1 rounded-full bg-muted/40 overflow-hidden">
                    <div className={cn('h-full rounded-full', LBR_STATUS_BAR[r.key])} style={{ width: `${pct}%` }} />
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
