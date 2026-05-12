/**
 * TrendModal.tsx
 * ──────────────
 * Centered modal with two side-by-side area charts:
 *   left  → Output SMH (green)
 *   right → Input Hours (violet)
 *
 * Replaces the near-identical TrendModal JSX previously inlined in
 * OlePlantReport (site-level) and OleWorkcellReport (workcell-level).
 */

import { useEscapeKey } from '@/hooks/shared/useEscapeKey';
import { MODAL_DIM, TT_AREA } from '@/lib/ole/oleChartStyles';
import type { WeeklyTrendPoint } from '@/lib/ole/oleTypes';
import { formatWeekLabel } from '@/lib/ole/oleConstants';
import { X } from 'lucide-react';
import { useId } from 'react';
import {
  Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  data: WeeklyTrendPoint[];
  selectedWeek: number | null;
  /**
   * Y-axis scaling.
   * 'thousands' → formats ticks as "12k" and tooltip as "12.3k hrs" (site-level).
   * 'raw'       → formats ticks as "120" and tooltip as "120.5 hrs" (workcell-level).
   */
  yScale?: 'thousands' | 'raw';
  /** Reference line opacity for the selected-week dashed line. */
  referenceLineOpacity?: number;
};

export function TrendModal({
  open, onClose, title, data, selectedWeek,
  yScale = 'thousands',
  referenceLineOpacity = 0.35,
}: Props) {
  useEscapeKey(onClose, open);

  // Unique gradient ids — each modal instance must own its own defs.
  const reactId = useId().replace(/:/g, '');
  const smhGradId = `tmSmh-${reactId}`;
  const hrsGradId = `tmHrs-${reactId}`;

  const thousands = yScale === 'thousands';
  const tickFmt = thousands ? (v: number) => `${(v / 1000).toFixed(0)}k` : (v: number) => `${v.toFixed(0)}`;
  const fmtSmh = thousands
    ? (v: number) => [`${(v / 1000).toFixed(1)}k hrs`, 'Output SMH'] as [string, string]
    : (v: number) => [`${v.toFixed(1)} hrs`, 'Output SMH'] as [string, string];
  const fmtHrs = thousands
    ? (v: number) => [`${(v / 1000).toFixed(1)}k hrs`, 'Input Hours'] as [string, string]
    : (v: number) => [`${v.toFixed(1)} hrs`, 'Input Hours'] as [string, string];
  const yAxisWidth = thousands ? 38 : 42;

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]"
        style={{ transition: 'opacity 0.25s ease', opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none' }}
      />
      <div
        className="fixed z-50 bg-card border border-border rounded-xl shadow-2xl flex flex-col"
        style={{
          width: MODAL_DIM.width, height: MODAL_DIM.height, top: '50%', left: '50%',
          transition: 'opacity 0.25s ease, transform 0.25s ease',
          opacity: open ? 1 : 0,
          transform: open ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -52%) scale(0.96)',
          pointerEvents: open ? 'auto' : 'none',
        }}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <span className="text-sm font-semibold text-foreground uppercase tracking-wide">{title}</span>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 min-h-0 p-5 grid grid-cols-2 gap-4">

          {/* Output SMH */}
          <div className="flex flex-col bg-muted/20 rounded-xl border border-border p-4">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Output SMH <span className="text-primary">(Σ Qty × SMH/unit)</span>
            </p>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id={smhGradId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="w" type="category" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={tickFmt} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={yAxisWidth} />
                  <Tooltip {...TT_AREA} formatter={fmtSmh} />
                  {selectedWeek !== null && (
                    <ReferenceLine
                      x={formatWeekLabel(selectedWeek)}
                      stroke='hsl(var(--muted-foreground))'
                      strokeWidth={1.5}
                      strokeDasharray="4 2"
                      strokeOpacity={referenceLineOpacity}
                    />
                  )}
                  <Area type="monotone" dataKey="smh" stroke="#22c55e" strokeWidth={2} fill={`url(#${smhGradId})`} dot={false} activeDot={{ r: 4, fill: '#22c55e' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Input Hours */}
          <div className="flex flex-col bg-muted/20 rounded-xl border border-border p-4">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Input Hours <span className="text-violet-400">(Σ Paid Direct Hrs)</span>
            </p>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id={hrsGradId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="w" type="category" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={tickFmt} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={yAxisWidth} />
                  <Tooltip {...TT_AREA} formatter={fmtHrs} />
                  {selectedWeek !== null && (
                    <ReferenceLine
                      x={formatWeekLabel(selectedWeek)}
                      stroke='hsl(var(--muted-foreground))'
                      strokeWidth={1.5}
                      strokeDasharray="4 2"
                      strokeOpacity={referenceLineOpacity}
                    />
                  )}
                  <Area type="monotone" dataKey="hrs" stroke="#a78bfa" strokeWidth={2} fill={`url(#${hrsGradId})`} dot={false} activeDot={{ r: 4, fill: '#a78bfa' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
