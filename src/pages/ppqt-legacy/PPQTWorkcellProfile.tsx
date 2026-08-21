/**
 * PPQTWorkcellProfile.tsx
 * ────────────────────────
 * Layer 2 (out of 4) — Workcell profile page.
 *
 * Route: /ppqt/workcell/:workcell
 *
 * The IE's question this page answers:
 *   "Which of this customer's production lines need my attention?"
 *
 * Shows the workcell hero (logo + name + aggregate KPI) and a list of
 * sub-workcenters underneath. Click a sub-workcenter → drills into the
 * capacity-table view at /ppqt/workcell/:wc/swc/:swc.
 *
 * Modeled on OleWorkcellReport for visual consistency. The Wabtec logo
 * acts as the "profile picture" — same Fotmob team-crest treatment.
 */

import { WORKCELL_LOGOS } from '@/lib/ole/oleConstants';
import {
  getPPQTStatus,
  PPQT_AREA_BADGE,
  PPQT_AREA_LABEL,
  PPQT_STATUS_BADGE,
  PPQT_STATUS_LABEL,
  PPQT_UTIL_BAR,
  PPQT_UTIL_TEXT,
} from '@/lib/ppqt-legacy/ppqtConstants';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  ChevronRight,
  Factory,
  FlaskConical,
  Layers,
  Sigma,
} from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PPQTBreadcrumb from './PPQTBreadcrumb';
import {
  getSubWorkcentersForWorkcell,
  getWorkcell,
  MOCK_WORKCELLS,
} from './mockPpqtData';
import { PPQTSubWorkcenter } from './types';

function resolveLogo(workcell: string): string | null {
  const k = workcell.toLowerCase().replace(/[^a-z]/g, '');
  const lk = Object.keys(WORKCELL_LOGOS).find(x => k.startsWith(x));
  return lk ? WORKCELL_LOGOS[lk] : null;
}

export default function PPQTWorkcellProfile() {
  const navigate = useNavigate();
  const { workcell: paramWc } = useParams<{ workcell: string }>();

  const workcellId = decodeURIComponent(paramWc ?? '');
  const workcell = getWorkcell(workcellId) ?? MOCK_WORKCELLS[0];
  const subWorkcenters = useMemo(() => getSubWorkcentersForWorkcell(workcell.id), [workcell.id]);
  const logo = resolveLogo(workcell.id);

  const heroStatus = getPPQTStatus(workcell.avgUtil);
  const heroUtilWidth = Math.min(workcell.avgUtil, 100);

  const drillToSwc = (swcId: string) => {
    navigate(`/ppqt-legacy/workcell/${encodeURIComponent(workcell.id)}/swc/${encodeURIComponent(swcId)}`);
  };

  return (
    <div className="relative">

      {/* ─── Sticky header with breadcrumb ────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-6 py-3">
          <PPQTBreadcrumb
            items={[
              { label: 'PPQT Dashboard', href: '/ppqt-legacy' },
              { label: 'Workcells',      href: '/ppqt-legacy/workcell' },
              { label: workcell.name,    workcellLogoKey: workcell.id },
            ]}
            backHref="/ppqt-legacy/workcell"
          />
        </div>
      </div>

      {/* ─── Two-column body ─────────────────────────────────────────────── */}
      <div className="p-5 flex gap-5">

        {/* ─── LEFT: Workcell hero + aggregate stats ────────────────────── */}
        <div className="w-[300px] flex-shrink-0 flex flex-col gap-4">

          {/* Hero card — the workcell's "profile picture" */}
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
                    Workcell · {workcell.period}
                  </p>
                  <p className="text-sm font-semibold text-foreground truncate mt-0.5">{workcell.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{workcell.division}</p>
                </div>
              </div>

              <p className={cn('text-5xl font-mono font-black mt-4 leading-none tabular-nums', PPQT_UTIL_TEXT[heroStatus])}>
                {workcell.avgUtil}%
              </p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">
                Avg utilisation across {workcell.subWorkcenterCount} sub-workcenter{workcell.subWorkcenterCount !== 1 ? 's' : ''}
              </p>

              <div className="mt-3 h-1 rounded-full bg-muted/40 overflow-hidden">
                <div className={cn('h-full rounded-full', PPQT_UTIL_BAR[heroStatus])} style={{ width: `${heroUtilWidth}%` }} />
              </div>
            </div>

            <div className="grid grid-cols-2 divide-x divide-border border-t border-border">
              <div className="p-3">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Demand</p>
                <p className="text-xl font-mono font-bold text-foreground mt-0.5 tabular-nums">
                  {workcell.totalDemand.toLocaleString()}
                </p>
                <p className="text-[9px] text-muted-foreground">units / month</p>
              </div>
              <div className="p-3">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Processes</p>
                <p className="text-xl font-mono font-bold text-foreground mt-0.5 tabular-nums">{workcell.processCount}</p>
                <p className="text-[9px] text-muted-foreground">across lines</p>
              </div>
            </div>
          </div>

          {/* Sub-workcenter rollup card */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border">
              <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Workcell Stats</p>
            </div>
            <div className="grid grid-cols-2 divide-x divide-y divide-border">
              <Setting label="Sub-workcenters" value={workcell.subWorkcenterCount.toString()} />
              <Setting label="Processes"       value={workcell.processCount.toString()} />
              <Setting label="Bottlenecks"     value={workcell.bottlenecks.toString()}
                       tone={workcell.bottlenecks > 0 ? 'red' : undefined} />
              <Setting label="CT estimates"    value={workcell.ctEstimates.toString()}
                       tone={workcell.ctEstimates > 0 ? 'amber' : undefined} />
            </div>
          </div>

          {/* Drill-deeper hint */}
          <div className="rounded-xl border border-border border-dashed bg-card/40 px-4 py-3">
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              <ChevronRight className="inline h-3 w-3 align-text-bottom" />
              {' '}Click a sub-workcenter on the right to see its process capacity table.
            </p>
          </div>
        </div>

        {/* ─── RIGHT: Sub-workcenter list ───────────────────────────────── */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
              <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Factory className="h-3 w-3" />
                Sub-workcenters · {subWorkcenters.length}
              </p>
              <p className="text-[9px] text-muted-foreground">Click a row to drill into its capacity table</p>
            </div>

            {/* Header */}
            <div
              className="grid bg-muted/40 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold border-b border-border"
              style={{ gridTemplateColumns: '1.5rem 3.5rem minmax(10rem, 1fr) 5rem 5rem 9rem 4.5rem 5rem 6rem' }}
            >
              {['#', 'Area', 'Sub-workcenter', 'Demand', 'Processes', 'Avg util', 'Bottlenecks', 'CT est', 'Status'].map(h => (
                <div key={h} className="px-2 py-2">{h}</div>
              ))}
            </div>

            {subWorkcenters.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                No sub-workcenters defined for {workcell.name}.
              </div>
            ) : (
              subWorkcenters.map((swc, idx) => (
                <SubWorkcenterRow
                  key={swc.id}
                  swc={swc}
                  idx={idx}
                  onClick={() => drillToSwc(swc.id)}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-workcenter row ─────────────────────────────────────────────────────
function SubWorkcenterRow({
  swc, idx, onClick,
}: {
  swc: PPQTSubWorkcenter;
  idx: number;
  onClick: () => void;
}) {
  const st = getPPQTStatus(swc.avgUtil);
  const utilWidth = Math.min(swc.avgUtil, 100);

  return (
    <div
      onClick={onClick}
      className="grid items-center border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
      style={{ gridTemplateColumns: '1.5rem 3.5rem minmax(10rem, 1fr) 5rem 5rem 9rem 4.5rem 5rem 6rem', height: 48 }}
    >
      <div className="px-2 text-[10px] text-muted-foreground font-mono tabular-nums">{idx + 1}</div>
      <div className="px-2">
        <span className={cn(
          'text-[10px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap',
          PPQT_AREA_BADGE[swc.area]
        )}>
          {PPQT_AREA_LABEL[swc.area]}
        </span>
      </div>
      <div className="px-2 min-w-0">
        <p className="text-[11px] font-semibold text-foreground truncate">{swc.name}</p>
        <p className="text-[9px] text-muted-foreground truncate">{swc.shiftHours}hr × {swc.workingDays} days</p>
      </div>
      <div className="px-2 text-[11px] font-mono text-foreground tabular-nums">
        {swc.totalDemand.toLocaleString()}
      </div>
      <div className="px-2 text-[11px] font-mono text-foreground tabular-nums">{swc.processCount}</div>
      <div className="px-2">
        <span className={cn('text-sm font-mono font-bold block tabular-nums', PPQT_UTIL_TEXT[st])}>
          {swc.avgUtil}%
        </span>
        <div className="h-0.5 rounded-full bg-muted/40 overflow-hidden mt-0.5">
          <div className={cn('h-full rounded-full', PPQT_UTIL_BAR[st])} style={{ width: `${utilWidth}%` }} />
        </div>
      </div>
      <div className="px-2">
        <span className={cn('text-[11px] font-mono font-semibold tabular-nums', swc.bottlenecks > 0 ? 'text-red-400' : 'text-muted-foreground')}>
          {swc.bottlenecks > 0 ? swc.bottlenecks : '—'}
        </span>
      </div>
      <div className="px-2 flex items-center gap-1">
        {swc.ctEstimates > 0 && <FlaskConical className="h-2.5 w-2.5 text-amber-400" />}
        <span className={cn('text-[11px] font-mono font-semibold tabular-nums', swc.ctEstimates > 0 ? 'text-amber-400' : 'text-muted-foreground')}>
          {swc.ctEstimates > 0 ? swc.ctEstimates : '—'}
        </span>
      </div>
      <div className="px-2">
        <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded border whitespace-nowrap', PPQT_STATUS_BADGE[st])}>
          {PPQT_STATUS_LABEL[st]}
        </span>
      </div>
    </div>
  );
}

// ─── Small setting cell ──────────────────────────────────────────────────────
function Setting({ label, value, tone }: { label: string; value: string; tone?: 'red' | 'amber' }) {
  const valueClass =
    tone === 'red'   ? 'text-red-400' :
    tone === 'amber' ? 'text-amber-400' :
    'text-foreground';
  return (
    <div className="px-4 py-2.5">
      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={cn('text-sm font-mono font-bold mt-0.5 tabular-nums', valueClass)}>{value}</p>
    </div>
  );
}
