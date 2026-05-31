/**
 * PPQTSubWorkcenterProfile.tsx
 * ─────────────────────────────
 * Layer 3 (out of 4) — Sub-workcenter profile page.
 *
 * Route: /ppqt/workcell/:workcell/swc/:subWorkcenter
 *
 * The IE's question this page answers:
 *   "Which processes on this specific line are bottlenecks?"
 *
 * This is the **capacity table page** — the most valuable artifact in PPQT.
 * Shows all processes on the chosen sub-workcenter with WCT, Takt, Eq, Need,
 * Gap, Util, CT source, status. Click any process → drills to its Process
 * Detail page to see which assemblies are driving the load.
 */

import { Input } from '@/components/ui/input';
import { WORKCELL_LOGOS } from '@/lib/ole/oleConstants';
import {
  getPPQTStatus,
  PPQT_AREA_BADGE,
  PPQT_AREA_LABEL,
  PPQT_STATUS_BADGE,
  PPQT_STATUS_LABEL,
  PPQT_UTIL_BAR,
  PPQT_UTIL_TEXT,
} from '@/lib/ppqt/ppqtConstants';
import { cn } from '@/lib/utils';
import { FlaskConical, Layers, Search, Sigma } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PPQTBreadcrumb from './PPQTBreadcrumb';
import PPQTCapacityTable from './PPQTCapacityTable';
import {
  getProcessesForSubWorkcenter,
  getSubWorkcenter,
  getWorkcell,
  MOCK_WORKCELLS,
} from './mockPpqtData';
import { PPQTProcess, PPQTStatus } from './types';

type SortDir = 'asc' | 'desc';

function resolveLogo(workcell: string): string | null {
  const k = workcell.toLowerCase().replace(/[^a-z]/g, '');
  const lk = Object.keys(WORKCELL_LOGOS).find(x => k.startsWith(x));
  return lk ? WORKCELL_LOGOS[lk] : null;
}

function sortRows<T>(rows: T[], col: keyof T | '', dir: SortDir): T[] {
  if (!col) return rows;
  const mul = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = a[col] as unknown;
    const vb = b[col] as unknown;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === 'number' && typeof vb === 'number') return mul * (va - vb);
    return mul * String(va).localeCompare(String(vb), undefined, { numeric: true });
  });
}

export default function PPQTSubWorkcenterProfile() {
  const navigate = useNavigate();
  const { workcell: paramWc, subWorkcenter: paramSwc } = useParams<{ workcell: string; subWorkcenter: string }>();

  const workcellId = decodeURIComponent(paramWc ?? '');
  const swcId = decodeURIComponent(paramSwc ?? '');

  const workcell = getWorkcell(workcellId) ?? MOCK_WORKCELLS[0];
  const swc = getSubWorkcenter(swcId);
  const logo = resolveLogo(workcell.id);

  // ── Filter + sort state ──
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<PPQTStatus | ''>('');
  const [sortCol, setSortCol] = useState<keyof PPQTProcess | ''>('util');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const toggleSort = useCallback((col: keyof PPQTProcess) => {
    setSortCol(prev => {
      if (prev === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
      else setSortDir('desc');
      return col;
    });
  }, []);

  // ── Process rows for this sub-workcenter ──
  const allProcesses = useMemo(
    () => swc ? getProcessesForSubWorkcenter(swc.id) : [],
    [swc]
  );

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = allProcesses.filter(p => {
      if (status && getPPQTStatus(p.util) !== status) return false;
      if (term && !p.name.toLowerCase().includes(term)) return false;
      return true;
    });
    return sortRows(list, sortCol, sortDir);
  }, [allProcesses, status, search, sortCol, sortDir]);

  if (!swc) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Sub-workcenter not found for {workcell.name}.
      </div>
    );
  }

  const heroStatus = getPPQTStatus(swc.avgUtil);
  const heroUtilWidth = Math.min(swc.avgUtil, 100);

  // ── CT source mix across all processes on this line ──
  const ctMix = useMemo(() => {
    const acc = { MOST: 0, SW: 0, Est: 0 };
    allProcesses.forEach(p => {
      acc.MOST += p.ctSourceCounts.MOST;
      acc.SW   += p.ctSourceCounts.SW;
      acc.Est  += p.ctSourceCounts.Est;
    });
    const total = acc.MOST + acc.SW + acc.Est || 1;
    return [
      { label: 'MOST',      count: acc.MOST, pct: Math.round((acc.MOST / total) * 100), color: 'text-emerald-400', bar: 'bg-emerald-500' },
      { label: 'Stopwatch', count: acc.SW,   pct: Math.round((acc.SW   / total) * 100), color: 'text-blue-400',    bar: 'bg-blue-500' },
      { label: 'Estimate',  count: acc.Est,  pct: Math.round((acc.Est  / total) * 100), color: 'text-amber-400',   bar: 'bg-amber-400' },
    ];
  }, [allProcesses]);

  const onProcessClick = (process: PPQTProcess) => {
    navigate(`/ppqt/workcell/${encodeURIComponent(workcell.id)}/swc/${encodeURIComponent(swc.id)}/proc/${encodeURIComponent(process.id)}`);
  };

  return (
    <div className="relative">

      {/* ─── Sticky header with breadcrumb ──────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-6 py-3">
          <PPQTBreadcrumb
            items={[
              { label: 'PPQT Dashboard', href: '/ppqt' },
              { label: 'Workcells',      href: '/ppqt/workcell' },
              { label: workcell.name,    href: `/ppqt/workcell/${encodeURIComponent(workcell.id)}`, workcellLogoKey: workcell.id },
              { label: swc.name },
            ]}
          />
        </div>
      </div>

      {/* ─── Two-column body ─────────────────────────────────────────────── */}
      <div className="p-5 flex gap-5">

        {/* ─── LEFT: sub-workcenter hero + shift/quality/CT mix ──────────── */}
        <div className="w-[300px] flex-shrink-0 flex flex-col gap-4">

          {/* Hero — workcell logo persists, sub-workcenter is the focus */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-5">
              <div className="flex items-start gap-3">
                {logo && (
                  <div className="w-20 h-10 rounded-lg border border-border bg-white flex items-center justify-center overflow-hidden flex-shrink-0">
                    <img src={logo} alt={workcell.name} className="w-full h-full object-contain p-1" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-semibold">
                    Sub-workcenter · {workcell.period}
                  </p>
                  <p className="text-sm font-semibold text-foreground truncate mt-0.5">{swc.name}</p>
                  <div className="mt-0.5 inline-flex">
                    <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded border', PPQT_AREA_BADGE[swc.area])}>
                      {PPQT_AREA_LABEL[swc.area]} · {workcell.name}
                    </span>
                  </div>
                </div>
                <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded border flex-shrink-0', PPQT_STATUS_BADGE[heroStatus])}>
                  {PPQT_STATUS_LABEL[heroStatus]}
                </span>
              </div>

              <p className={cn('text-5xl font-mono font-black mt-4 leading-none tabular-nums', PPQT_UTIL_TEXT[heroStatus])}>
                {swc.avgUtil}%
              </p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Avg utilisation</p>

              <div className="mt-3 h-1 rounded-full bg-muted/40 overflow-hidden">
                <div className={cn('h-full rounded-full', PPQT_UTIL_BAR[heroStatus])} style={{ width: `${heroUtilWidth}%` }} />
              </div>
            </div>

            <div className="grid grid-cols-2 divide-x divide-border border-t border-border">
              <div className="p-3">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Demand</p>
                <p className="text-xl font-mono font-bold text-foreground mt-0.5 tabular-nums">
                  {swc.totalDemand.toLocaleString()}
                </p>
                <p className="text-[9px] text-muted-foreground">units / month</p>
              </div>
              <div className="p-3">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Processes</p>
                <p className="text-xl font-mono font-bold text-foreground mt-0.5 tabular-nums">{swc.processCount}</p>
                <p className="text-[9px] text-muted-foreground">on this line</p>
              </div>
            </div>
          </div>

          {/* Quality & shift settings */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border">
              <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Quality & Shift</p>
            </div>
            <div className="grid grid-cols-2 divide-x divide-y divide-border">
              <Setting label="FPY"        value={`${swc.fpy}%`} />
              <Setting label="Efficiency" value={`${swc.efficiency}%`} />
              <Setting label="Shift hrs"  value={`${swc.shiftHours} hr`} />
              <Setting label="Days"       value={`${swc.workingDays} days`} />
              <Setting label="CO / day"   value={`${swc.changeoverQty}×`} />
              <Setting label="CO time"    value={`${swc.changeoverTime} min`} />
            </div>
          </div>

          {/* CT source mix */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
              <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">CT Source Mix</p>
              {swc.ctEstimates > 0 && (
                <span className="flex items-center gap-1 text-[9px] text-amber-400 font-semibold">
                  <FlaskConical className="h-2.5 w-2.5" />
                  {swc.ctEstimates} need study
                </span>
              )}
            </div>
            {ctMix.map((r, i, arr) => (
              <div key={r.label}
                className={cn('flex items-center gap-3 px-4 py-2.5', i < arr.length - 1 && 'border-b border-border')}>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground">{r.label}</p>
                  <div className="mt-1.5 h-1 rounded-full bg-muted/40 overflow-hidden">
                    <div className={cn('h-full rounded-full', r.bar)} style={{ width: `${r.pct}%` }} />
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className={cn('text-base font-mono font-bold tabular-nums block', r.color)}>{r.count}</span>
                  <span className="text-[9px] text-muted-foreground tabular-nums">{r.pct}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── RIGHT: filters + capacity table ──────────────────────────── */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">

          {/* Inline filters — search + status (no area filter here, line IS one area) */}
          <div className="flex items-end gap-3 flex-wrap">
            <div className="relative w-[240px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search process…"
                className="pl-8 h-9"
              />
            </div>

            <div className="flex items-center gap-1">
              {([
                ['',           'All',        ''],
                ['bottleneck', 'Bottleneck', 'border-red-500/40 text-red-400'],
                ['warning',    'Warning',    'border-amber-500/40 text-amber-400'],
                ['healthy',    'Healthy',    'border-emerald-500/40 text-emerald-400'],
                ['idle',       'Idle',       'border-border text-muted-foreground'],
              ] as [PPQTStatus | '', string, string][]).map(([val, label, accent]) => (
                <button
                  key={label}
                  onClick={() => setStatus(val)}
                  className={cn(
                    'h-9 px-3 rounded-md border text-xs font-medium transition-colors whitespace-nowrap',
                    status === val
                      ? cn('bg-muted/60 text-foreground', accent || 'border-primary')
                      : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/40'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <span className="text-xs text-muted-foreground ml-auto">
              {filteredRows.length} {filteredRows.length === 1 ? 'process' : 'processes'}
            </span>
          </div>

          {/* Capacity table — same component, but now scoped to this sub-workcenter */}
          <PPQTCapacityTable
            rows={filteredRows}
            sortCol={sortCol}
            sortDir={sortDir}
            onToggleSort={toggleSort}
            onRowClick={onProcessClick}
            hideAreaColumn
          />

          {/* Drill-deeper hint */}
          <div className="rounded-xl border border-border border-dashed bg-card/40 px-4 py-3">
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              <Layers className="inline h-3 w-3 align-text-bottom" />
              {' '}Click any process row to see which assemblies are driving its load.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Small setting cell ──────────────────────────────────────────────────────
function Setting({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-2.5">
      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-sm font-mono font-bold mt-0.5 tabular-nums text-foreground">{value}</p>
    </div>
  );
}
