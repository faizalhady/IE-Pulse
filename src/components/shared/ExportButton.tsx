/**
 * ExportButton.tsx — [Export ⤓] + a confirm step, for any Cycle Time table.
 *
 * WHY A CONFIRM STEP
 *   These tables run to 24,000 rows. Clicking Export and having the tab sit
 *   still for 20 seconds reads as a hang, so the reader clicks again and now
 *   two exports are racing. Saying the size and the wait BEFORE starting turns
 *   a freeze into a choice.
 *
 * WHAT IT EXPORTS
 *   Whatever `rows` is handed — the caller passes the array its table is
 *   already rendering, after filters, search and sort. An export that quietly
 *   widens the scope is worse than none: it looks right until someone counts.
 */

import { Download, Loader2 } from 'lucide-react';
import { useState } from 'react';

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { estimateExportMs, exportTableXlsx, humanDuration } from '@/lib/cycle_time/exportTable';
import type { ExportColumn } from '@/lib/cycle_time/exportTable';
import { cn } from '@/lib/utils';

interface Props<T> {
  rows: T[];
  columns: ExportColumn<T>[];
  filename: string;
  title: string;
  /** What the reader is looking at — scope, workcell, active filters. Written
   *  into the sheet, because the file outlives the screen. */
  subtitle?: string;
  sheetName?: string;
  /** Extra label under the row count, e.g. "filtered from 24,080". */
  scopeNote?: string;
  className?: string;
}

export function ExportButton<T>({
  rows, columns, filename, title, subtitle, sheetName, scopeNote, className,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const ms = estimateExportMs(rows.length, columns.length);
  const empty = rows.length === 0;

  async function run() {
    setBusy(true);
    setErr(null);
    try {
      await exportTableXlsx({ filename, sheetName, title, subtitle, columns, rows });
      setOpen(false);
    } catch (e) {
      // Kept open with the reason. Closing on failure leaves the reader
      // believing a file downloaded when nothing did.
      setErr(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        size="sm" disabled={empty}
        onClick={() => { setErr(null); setOpen(true); }}
        title={empty ? 'Nothing to export in the current view'
                     : `Export these ${rows.length.toLocaleString()} rows to Excel`}
        className={cn(
          'h-8 gap-1.5 px-2.5 text-xs',
          // Same blue as the confirm action in the dialog, so the button and
          // the thing it opens read as one gesture.
          'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-600/40',
          className)}
      >
        Export
        <Download className="h-3.5 w-3.5" />
      </Button>

      <AlertDialog open={open} onOpenChange={o => { if (!busy) setOpen(o); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Export to Excel</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-semibold text-foreground">
                    {rows.length.toLocaleString()}
                  </span>{' '}
                  row{rows.length === 1 ? '' : 's'} ·{' '}
                  <span className="font-semibold text-foreground">{columns.length}</span> columns
                  {scopeNote && <span className="text-muted-foreground"> · {scopeNote}</span>}
                </div>
                <div>
                  This should take{' '}
                  <span className="font-semibold text-foreground">{humanDuration(ms)}</span>.
                  {ms > 8000 && ' The tab may be unresponsive while it builds.'}
                </div>
                <div className="text-xs text-muted-foreground">
                  Exports exactly what the table is showing now — every filter,
                  search and sort you have applied.
                </div>
                {err && (
                  <div className="rounded-md border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-600 dark:text-red-400">
                    {err}
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={busy}
              className="border-red-500/50 text-red-600 hover:bg-red-500/10 hover:text-red-700 dark:text-red-400"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={e => { e.preventDefault(); void run(); }}
              className="bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-600"
            >
              {busy ? (<><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Exporting…</>)
                    : 'Export'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
