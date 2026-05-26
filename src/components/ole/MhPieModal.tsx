/**
 * MhPieModal.tsx
 * ──────────────
 * Centered modal showing a pie chart of man-hours loss distribution.
 * Buckets: NVA / Lunch / MFG DT / Downtime / MFG Hour Lost.
 */

import { useEscapeKey } from '@/hooks/shared/useEscapeKey';
import { MODAL_DIM } from '@/lib/ole/oleChartStyles';
import { cn } from '@/lib/utils';
import { Download, FileSpreadsheet, X } from 'lucide-react';
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
  // "Named total" = positive-valued buckets only. Excludes MFG Hour Lost when
  // it's negative (and signals over-explanation). Matches the card's "Total".
  const namedTotal = slices.filter(s => s.value > 0).reduce((s, x) => s + x.value, 0);
  const overshoot = namedTotal - total;
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

  async function handleExportExcel() {
    // Dynamic import — exceljs only loaded when the user actually exports.
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    wb.creator = 'IE Pulse';
    wb.created = new Date();
    const ws = wb.addWorksheet('Man-Hours', {
      views: [{ state: 'frozen', ySplit: 4 }],   // freeze header section
    });

    // Column layout
    ws.columns = [
      { key: 'bucket', width: 28 },
      { key: 'pct',    width: 14 },
      { key: 'hrs',    width: 16 },
    ];

    // ── Styling helpers ──
    const stripHash = (c: string) => c.replace('#', '').toUpperCase();
    const border = {
      top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    } as const;

    // Title row (merged across all 3 cols)
    ws.mergeCells('A1:C1');
    const titleCell = ws.getCell('A1');
    titleCell.value = title;
    titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 26;

    // Subtitle row (paid hours)
    ws.mergeCells('A2:C2');
    const subCell = ws.getCell('A2');
    subCell.value = `${totalLabel}: ${total.toLocaleString(undefined, { maximumFractionDigits: 2 })} hrs`;
    subCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF6B7280' } };
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(2).height = 18;

    // Blank spacer
    ws.getRow(3).height = 6;

    // Header row
    const headerRow = ws.addRow({ bucket: 'Bucket', pct: '% of Overall', hrs: 'Hours' });
    headerRow.eachCell(cell => {
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = border;
    });
    headerRow.height = 22;

    // Data rows (each gets a color swatch on the bucket cell)
    slices.forEach((s, i) => {
      const pct = total > 0 ? (s.value / total) * 100 : 0;
      const row = ws.addRow({
        bucket: s.name,
        pct: pct / 100,
        hrs: s.value,
      });
      const zebra = i % 2 === 0 ? 'FFFFFFFF' : 'FFF9FAFB';
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: zebra } };
        cell.border = border;
        cell.alignment = { vertical: 'middle' };
      });
      // Bucket: left-aligned + colored left bar
      row.getCell('bucket').font = { name: 'Calibri', size: 11, bold: true };
      row.getCell('bucket').alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
      row.getCell('bucket').border = {
        ...border,
        left: { style: 'thick', color: { argb: `FF${stripHash(s.color)}` } },
      };
      // Percent column — formatted as %, color matches bucket
      const pctCell = row.getCell('pct');
      pctCell.numFmt = '0.00%';
      pctCell.alignment = { horizontal: 'right', vertical: 'middle' };
      pctCell.font = { name: 'Consolas', size: 11, bold: true, color: { argb: `FF${stripHash(s.color)}` } };
      // Hours column — right-aligned mono, thousands separator
      const hrsCell = row.getCell('hrs');
      hrsCell.numFmt = '#,##0.00;[Red]-#,##0.00';
      hrsCell.alignment = { horizontal: 'right', vertical: 'middle' };
      hrsCell.font = { name: 'Consolas', size: 11 };
      row.height = 20;
    });

    // Blank spacer
    ws.addRow([]).height = 6;

    // Totals: Total (named buckets), Overall Total (paid)
    const addSummaryRow = (label: string, pct: number | null, hrs: number, bg: string) => {
      const r = ws.addRow({ bucket: label, pct: pct == null ? '—' : pct / 100, hrs });
      r.height = 22;
      r.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF111827' } };
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF9CA3AF' } },
          bottom: border.bottom,
          left: border.left,
          right: border.right,
        };
        cell.alignment = { vertical: 'middle' };
      });
      r.getCell('bucket').alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
      if (pct != null) {
        const p = r.getCell('pct');
        p.numFmt = '0.00%';
        p.alignment = { horizontal: 'right', vertical: 'middle' };
        p.font = { name: 'Consolas', size: 11, bold: true };
      }
      const h = r.getCell('hrs');
      h.numFmt = '#,##0.00;[Red]-#,##0.00';
      h.alignment = { horizontal: 'right', vertical: 'middle' };
      h.font = { name: 'Consolas', size: 11, bold: true };
    };
    addSummaryRow('Total', total > 0 ? (namedTotal / total) * 100 : null, namedTotal, 'FFE5E7EB');
    addSummaryRow('Overall Total', 100, total, 'FFD1D5DB');

    // Save
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `${title.replace(/[^a-z0-9]+/gi, '-')}.xlsx`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
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
          width: '90vw', height: '88vh', top: '50%', left: '50%',
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
                  · named buckets sum to {namedTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({overshoot > 0 ? '+' : ''}{((overshoot / total) * 100).toFixed(1)}%)
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
            <button
              onClick={handleExportExcel}
              title="Export to Excel (.xlsx)"
              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <FileSpreadsheet className="h-4 w-4" />
            </button>
            <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 p-5 grid grid-cols-[1fr_320px] gap-4">

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

          {/* Legend / breakdown — compact table style */}
          <div className="rounded-lg border border-border bg-muted/10 overflow-hidden self-start">
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 px-3 py-2 border-b border-border bg-muted/30">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Bucket</p>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-right w-14">%</p>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-right w-20">Hrs</p>
            </div>
            {slices.map((s, i) => {
              const pct = total > 0 ? (s.value / total) * 100 : 0;
              return (
                <div
                  key={s.name}
                  className={cn(
                    'grid grid-cols-[1fr_auto_auto] items-center gap-x-3 px-3 py-2',
                    i < slices.length - 1 && 'border-b border-border/60',
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
                    <p className="text-xs font-semibold text-foreground truncate">{s.name}</p>
                  </div>
                  <span className="text-xs font-mono font-bold tabular-nums text-right w-14" style={{ color: s.color }}>
                    {pct.toFixed(2)}%
                  </span>
                  <span className="text-xs font-mono tabular-nums text-right w-20 text-foreground">
                    {s.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
              );
            })}
            {/* Summary rows */}
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 px-3 py-2 border-t border-border bg-muted/20">
              <p className="text-xs font-bold text-foreground">Total</p>
              <span className="text-xs font-mono font-bold tabular-nums text-right w-14 text-foreground">
                {total > 0 ? `${((namedTotal / total) * 100).toFixed(2)}%` : '—'}
              </span>
              <span className="text-xs font-mono font-bold tabular-nums text-right w-20 text-foreground">
                {namedTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 px-3 py-2 border-t border-border bg-muted/30">
              <p className="text-xs font-bold text-foreground uppercase tracking-wider">Overall Total</p>
              <span className="text-xs font-mono font-bold tabular-nums text-right w-14 text-foreground">100.00%</span>
              <span className="text-xs font-mono font-bold tabular-nums text-right w-20 text-foreground">
                {total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>

        </div>
      </div>
      </div>
    </>
  );
}
