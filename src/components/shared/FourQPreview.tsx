/**
 * FourQPreview — the shareable 2x2 rendering of a 4Q report, plus PNG export.
 *
 * The four quadrants are slots: this owns the frame, the banner headers and the
 * capture, nothing about what goes in them.
 *
 * html-to-image is imported dynamically. It is only needed the moment someone
 * presses Download, and it is not small — loading it up front would cost every
 * page view for a button most sessions never press.
 */

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Download, Eye } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';

export interface FourQPreviewProps {
  title: string;
  /** Top-right label on the sheet. */
  brand?: string;
  /** Banner text per quadrant, clockwise from top-left. */
  headings: [string, string, string, string];
  quadrants: [ReactNode, ReactNode, ReactNode, ReactNode];
  /** Which slots hold a full-bleed table — see the banner note below.
   *  Defaults to slots 3 and 4, which are the tables in every module. */
  flushQuadrants?: [boolean, boolean, boolean, boolean];
  /** Extra classes per quadrant frame, when one needs different alignment. */
  frameClassName?: [string, string, string, string];
}

/**
 * Every quadrant gets THIS banner, so all four read identically.
 *
 * FLUSH — why the table quadrants get no padding
 *   A table brings its own blue header row. Padded, the frame's banner and that
 *   header become two blue blocks with a white channel between them, and the
 *   table's corners sit inset from the banner's — the "two headers, badly
 *   glued" look. With no padding the banner sits directly on the header row and
 *   the two read as one continuous header, which is what a 4Q sheet has always
 *   looked like. Charts still get their padding; they need the breathing room.
 */
function QuadrantFrame({ heading, flush, extra, children }: {
  heading: string; flush: boolean; extra: string; children: ReactNode;
}) {
  return (
    <div className={cn('flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card', extra)}>
      <div className="flex flex-shrink-0 items-center bg-primary px-3 py-1.5">
        <span className="flex-1 text-center text-xs font-bold uppercase text-primary-foreground">{heading}</span>
      </div>
      <div className={cn('min-h-0 flex-1 overflow-hidden', flush ? 'p-0' : 'p-2')}>{children}</div>
    </div>
  );
}

export function FourQPreview({
  title, brand = 'JABIL 4Q REPORT', headings, quadrants,
  flushQuadrants = [false, false, true, true],
  frameClassName = ['', '', '', ''],
}: FourQPreviewProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    if (!canvasRef.current) return;
    setDownloading(true);
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(canvasRef.current, { cacheBust: true, pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = `4Q-Report-${title.replace(/\s+/g, '-')}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error('Download failed', e);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="default" size="sm" className="gap-2"><Eye className="w-4 h-4" /> Preview Report</Button>
      </DialogTrigger>
      <DialogContent className="max-w-[98vw] w-[98vw] h-[98vh] p-0 flex flex-col gap-0 border border-border bg-card shadow-2xl rounded-xl overflow-hidden">
        <div className="bg-card border-b border-border px-4 py-2.5 flex items-center gap-3 flex-shrink-0">
          <Button onClick={handleDownload} disabled={downloading} size="sm" className="gap-2 flex-shrink-0 h-8 px-3">
            <Download className="w-3.5 h-3.5" />{downloading ? 'Capturing...' : 'Download Image'}
          </Button>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-sm leading-tight">Report Preview</h2>
            <p className="text-xs text-muted-foreground">PNG download at 2x resolution</p>
          </div>
          <div className="w-10 flex-shrink-0" />
        </div>

        <div className="flex-1 overflow-hidden bg-muted/40 min-h-0">
          <div ref={canvasRef} className="bg-card text-foreground h-full w-full flex flex-col overflow-hidden" style={{ minWidth: 900 }}>
            <div className="flex items-center justify-between flex-shrink-0 px-4 py-1.5">
              <h1 className="text-sm font-bold uppercase tracking-wide">{title}</h1>
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{brand}</span>
            </div>
            <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-3 overflow-hidden px-3 pb-3">
              {quadrants.map((q, i) => (
                <QuadrantFrame key={i} heading={headings[i]} flush={flushQuadrants[i]} extra={frameClassName[i]}>
                  {q}
                </QuadrantFrame>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
