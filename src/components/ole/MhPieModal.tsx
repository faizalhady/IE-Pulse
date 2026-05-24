/**
 * MhPieModal.tsx
 * ──────────────
 * Centered modal showing a pie chart of man-hours loss distribution.
 * Buckets: NVA / Lunch / MFG DT / Downtime / MFG Hour Lost.
 */

import { useEscapeKey } from '@/hooks/shared/useEscapeKey';
import { MODAL_DIM } from '@/lib/ole/oleChartStyles';
import { cn } from '@/lib/utils';
import { Download, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

export type MhSlice = { name: string; value: number; color: string };

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  slices: MhSlice[];
  /** Override the denominator used for % labels. Defaults to sum of slices. */
  total?: number;
  totalLabel?: string;
};

export function MhPieModal({ open, onClose, title, slices, total: totalProp, totalLabel = 'Total Paid Hours' }: Props) {
  useEscapeKey(onClose, open);

  const sliceSum = slices.reduce((s, x) => s + x.value, 0);
  const total    = totalProp ?? sliceSum;
  const overshoot = sliceSum - total;
  const data = slices.filter(s => s.value > 0);

  const captureRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  async function handleDownload() {
    if (!captureRef.current) return;
    setDownloading(true);
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(captureRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: 'hsl(var(--card))',
        filter: (node) => !(node instanceof HTMLElement && node.dataset.noExport === 'true'),
      });
      const link = document.createElement('a');
      link.download = `${title.replace(/[^a-z0-9]+/gi, '-')}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error('Download failed', e);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]"
        style={{ transition: 'opacity 0.25s ease', opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none' }}
      />
      <div
        className="fixed z-50"
        style={{
          width: MODAL_DIM.width, height: MODAL_DIM.height, top: '50%', left: '50%',
          transition: 'opacity 0.25s ease, transform 0.25s ease',
          opacity: open ? 1 : 0,
          transform: open ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -52%) scale(0.96)',
          pointerEvents: open ? 'auto' : 'none',
        }}
      >
      <div ref={captureRef} className="bg-card border border-border rounded-xl shadow-2xl flex flex-col h-full w-full overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <div>
            <p className="text-sm font-semibold text-foreground uppercase tracking-wide">{title}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {totalLabel}: <span className="font-mono font-semibold text-foreground">{total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span> hrs
              {Math.abs(overshoot) > 0.5 && total > 0 && (
                <span className="ml-2 text-amber-400">
                  · slices sum to {sliceSum.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({overshoot > 0 ? '+' : ''}{((overshoot / total) * 100).toFixed(1)}%)
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-1" data-no-export="true">
            <button
              onClick={handleDownload}
              disabled={downloading}
              title="Download as PNG"
              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
            </button>
            <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 p-5 grid grid-cols-[1fr_240px] gap-4">

          {/* Pie chart */}
          <div className="flex flex-col bg-muted/20 rounded-xl border border-border p-4 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="45%"
                  outerRadius="80%"
                  paddingAngle={2}
                  stroke="hsl(var(--background))"
                  strokeWidth={2}
                  label={({ name, value }) => {
                    const pct = total > 0 ? (value / total) * 100 : 0;
                    return `${name}  ${pct.toFixed(1)}%`;
                  }}
                  labelLine={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1 }}
                >
                  {data.map((s, i) => <Cell key={i} fill={s.color} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }}
                  formatter={(value: number, name: string) => {
                    const pct = total > 0 ? (value / total) * 100 : 0;
                    return [`${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} hrs · ${pct.toFixed(2)}%`, name];
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend / breakdown */}
          <div className="flex flex-col gap-2 overflow-y-auto">
            {slices.map(s => {
              const pct = total > 0 ? (s.value / total) * 100 : 0;
              return (
                <div key={s.name} className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />
                    <p className="text-xs font-semibold text-foreground flex-1 min-w-0 truncate">{s.name}</p>
                  </div>
                  <div className="mt-1.5 flex items-baseline justify-between">
                    <span className="text-base font-mono font-bold" style={{ color: s.color }}>{pct.toFixed(2)}%</span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {s.value.toLocaleString(undefined, { maximumFractionDigits: 0 })} hrs
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </div>
      </div>
    </>
  );
}
