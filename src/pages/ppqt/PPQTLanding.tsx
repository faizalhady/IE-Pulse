/**
 * PPQTLanding.tsx
 * ───────────────
 * Route: /ppqt — every workcell that has a PPQT workbook, one row each.
 * Click a row → /ppqt/:workcell (the dedicated PPQT report).
 *
 * Numbers are from each workcell's LATEST period: volume, DL required vs
 * actual DL, bays short, NVA ratio. Source = the workbook in data/raw/ppqt/.
 */

import { FolderInput, Loader2, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { SortHeader } from '@/components/shared/SortHeader';
import { useSortable } from '@/hooks/shared/useSortable';
import { usePpqtRefresh, usePpqtWorkcells } from '@/hooks/ppqt/usePpqt';
import type { PPQTWorkcellRow } from '@/lib/ppqt/ppqtApi';
import { fmt, TONE_TEXT, varianceTone } from '@/lib/ppqt/ppqtFormat';
import { getWorkcellLogo, getWorkcellLogoBg } from '@/lib/ole/oleConstants';
import { cn } from '@/lib/utils';

import { Bar, CARD, Empty, ErrorBox, Loading, VarCell } from './ppqtUi';

const GRID = '2.5rem minmax(12rem,1fr) 7rem 11rem 7rem 13rem 6rem 6rem 6.5rem minmax(13rem,1fr)';

type Key = 'workcell' | 'volume' | 'dl' | 'variance' | 'bays' | 'nva' | 'latest';
const COLUMNS: { label: string; key?: Key }[] = [
  { label: '#' },
  { label: 'Workcell', key: 'workcell' },
  { label: 'Areas' },
  { label: 'Periods', key: 'latest' },
  { label: 'Volume', key: 'volume' },
  { label: 'DL required / actual', key: 'dl' },
  { label: 'Variance', key: 'variance' },
  { label: 'Bays short', key: 'bays' },
  { label: 'NVA ratio', key: 'nva' },
  { label: 'Source workbook' },
];
const ACCESSORS: Record<Key, (r: PPQTWorkcellRow) => string | number | null> = {
  workcell: (r) => r.workcell,
  volume: (r) => r.volume,
  dl: (r) => r.dl_required,
  variance: (r) => r.dl_variance,
  bays: (r) => r.bays_short,
  nva: (r) => r.nva_ratio,
  latest: (r) => r.latest,
};

export default function PPQTLanding() {
  const navigate = useNavigate();
  const { data, isLoading, isFetching, isError, error } = usePpqtWorkcells();
  const refresh = usePpqtRefresh();
  const rows = data?.workcells ?? [];
  const { sorted, sort, toggle } = useSortable<PPQTWorkcellRow, Key>(rows, ACCESSORS, { key: 'workcell', dir: 'asc' });

  return (
    <div className="p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-foreground">PPQT — capacity sizing</h1>
          <p className="text-[12px] text-muted-foreground">
            Product · Process · Quantity · Time. One workbook (EM-IE80-00003-B) per workcell; the latest period is shown here.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-[11px] text-muted-foreground md:inline">
            <FolderInput className="mr-1 inline h-3.5 w-3.5" aria-hidden />
            Drop workbooks in <code className="rounded bg-muted px-1">data/raw/ppqt/</code> then refresh
          </span>
          <button
            type="button"
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted/60 disabled:opacity-60"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', (refresh.isPending || isFetching) && 'animate-spin')} aria-hidden />
            {refresh.isSuccess ? 'Re-parsing…' : 'Refresh workbooks'}
          </button>
        </div>
      </div>

      <div className={cn(CARD, 'overflow-hidden')}>
        <div className="overflow-x-auto">
          <div className="min-w-[72rem]">
            <div
              className="grid border-b border-border bg-muted/50 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground"
              style={{ gridTemplateColumns: GRID }}
            >
              {COLUMNS.map((c, i) =>
                c.key ? (
                  <SortHeader key={i} label={c.label} active={sort?.key === c.key} dir={sort?.dir}
                              onClick={() => toggle(c.key!)} className="px-2 whitespace-nowrap" />
                ) : (
                  <div key={i} className="px-2 py-2.5 whitespace-nowrap">{c.label}</div>
                ),
              )}
            </div>

            {isLoading ? (
              <Loading label="Loading workcells…" />
            ) : isError ? (
              <ErrorBox error={error} />
            ) : sorted.length === 0 ? (
              <Empty>
                No PPQT workbooks yet. Drop a PPQT workbook into <code>data/raw/ppqt/</code> on the backend and press Refresh.
              </Empty>
            ) : (
              sorted.map((r, idx) => {
                const logo = getWorkcellLogo(r.workcell);
                const tone = varianceTone(r.dl_variance);
                const cover = r.dl_required > 0 ? (r.actual_dl / r.dl_required) * 100 : null;
                return (
                  <button
                    key={r.workcell}
                    type="button"
                    onClick={() => navigate(`/ppqt/${encodeURIComponent(r.workcell)}`)}
                    className="grid w-full items-center border-b border-border/60 text-left transition-colors last:border-0 hover:bg-muted/40 focus:outline-none focus-visible:bg-muted/60"
                    style={{ gridTemplateColumns: GRID }}
                  >
                    <div className="px-2 py-2 text-[12px] tabular-nums text-muted-foreground">{idx + 1}</div>
                    <div className="flex min-w-0 items-center gap-2.5 px-2 py-2">
                      {logo ? (
                        <div className="flex h-8 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded border border-border"
                             style={{ backgroundColor: getWorkcellLogoBg(r.workcell) ?? '#ffffff' }}>
                          <img src={logo} alt="" className="h-full w-full object-contain p-0.5" />
                        </div>
                      ) : (
                        <div className="flex h-8 w-16 flex-shrink-0 items-center justify-center rounded border border-border bg-muted text-[11px] font-bold text-muted-foreground">
                          {r.workcell.slice(0, 3)}
                        </div>
                      )}
                      <span className="truncate text-sm font-semibold text-foreground">{r.workcell}</span>
                    </div>
                    <div className="px-2 text-[12px] text-muted-foreground">{r.areas.join(' · ')}</div>
                    <div className="flex flex-wrap gap-1 px-2">
                      {r.periods.map((p) => (
                        <span key={p} className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                          p === r.latest ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground')}>
                          {fmt.period(p)}
                        </span>
                      ))}
                    </div>
                    <div className="px-2 text-[13px] tabular-nums text-foreground">{fmt.int(r.volume)}</div>
                    <div className="flex items-center gap-2 px-2">
                      <span className="text-[13px] font-semibold tabular-nums text-foreground">{fmt.num(r.dl_required, 1)}</span>
                      <span className="text-[11px] text-muted-foreground">/ {fmt.int(r.actual_dl)}</span>
                      <Bar pct={cover} tone={tone} />
                    </div>
                    <div className="px-2"><VarCell v={r.dl_variance} d={1} /></div>
                    <div className={cn('px-2 text-[13px] font-semibold tabular-nums', r.bays_short > 0 ? TONE_TEXT.short : TONE_TEXT.ok)}>
                      {r.bays_short}
                    </div>
                    <div className="px-2 text-[13px] tabular-nums text-foreground">{fmt.pct(r.nva_ratio)}</div>
                    <div className="min-w-0 px-2">
                      <div className="truncate text-[12px] text-foreground" title={r.file ?? ''}>{r.file ?? '—'}</div>
                      <div className="text-[10px] text-muted-foreground">parsed {fmt.datetime(r.ingested_at)}</div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {isFetching && !isLoading && (
        <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> refreshing
        </div>
      )}
    </div>
  );
}
