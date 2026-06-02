/**
 * IPKHistory.tsx
 * ───────────────
 * Past simulation runs for a workcell: trolley trend chart + paginated history
 * table. Chart style mirrors the OLE analysis charts (dark, emerald lines).
 *
 * Route: /ipk/:workcell/history
 */

import { cn } from '@/lib/utils';
import {
  IPK_SOURCE_BADGE, IPK_STATUS_BADGE, IPK_STATUS_LABEL, IPK_VARIANCE_TEXT, getIPKStatus,
} from '@/lib/ipk/ipkConstants';
import { useIPKHistory } from '@/hooks/ipk/useIPKHistory';
import IPKWorkcellHeader from './IPKWorkcellHeader';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

const TT = {
  contentStyle: {
    background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))',
    borderRadius: 8, fontSize: 11, padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  },
  labelStyle: { color: 'hsl(var(--muted-foreground))', fontWeight: 500, marginBottom: 4 },
  itemStyle: { color: 'hsl(var(--foreground))', fontWeight: 600 },
};

const PAGE_SIZE = 8;

export default function IPKHistory() {
  const navigate = useNavigate();
  const { workcell = '' } = useParams();
  const { data: history = [] } = useIPKHistory(workcell);

  const [page, setPage] = useState(0);

  // Chart data — oldest → newest.
  const chartData = useMemo(
    () => [...history].reverse().map(h => ({ period: h.period.split(' ')[0], required: h.totalRequired, onFloor: h.onFloor })),
    [history],
  );

  const pageCount = Math.max(1, Math.ceil(history.length / PAGE_SIZE));
  const pageRows = history.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="relative">
      <IPKWorkcellHeader
        workcellId={workcell}
        subtitle={`Run history · ${history.length} past simulation runs`}
        actions={
          <button
            onClick={() => navigate(`/ipk/${encodeURIComponent(workcell)}/simulate`)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 transition-colors"
          >
            <Play className="h-3.5 w-3.5" /> New Simulation
          </button>
        }
      />

      <div className="p-5 flex flex-col gap-5">
        {/* ─── Trend chart ─────────────────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
            <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Trolley Trend</p>
            <div className="flex items-center gap-4 text-[10px]">
              <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 rounded bg-emerald-500" /> Required</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 rounded bg-muted-foreground" /> On Floor</span>
            </div>
          </div>
          <div className="p-4" style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="period" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={32} />
                <Tooltip {...TT} />
                <Line type="monotone" dataKey="required" name="Required" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: '#10b981' }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="onFloor" name="On Floor" stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="4 3" dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ─── History table ───────────────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
            <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Past Runs</p>
          </div>

          <div className="grid bg-muted/50 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold border-b border-border"
            style={{ gridTemplateColumns: '1.5rem 6rem 6rem 5rem 4.5rem 5rem 4.5rem 4.5rem 5rem 5.5rem' }}>
            {['#', 'Date', 'Period', 'Source', 'Groups', 'Required', 'Floor', 'Var', 'Status', 'Action'].map((h, i) => (
              <div key={i} className="px-2 py-2">{h}</div>
            ))}
          </div>

          {pageRows.map((run, i) => {
            const st = getIPKStatus(run.variance, true);
            return (
              <div key={run.id}
                className="grid items-center border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                style={{ gridTemplateColumns: '1.5rem 6rem 6rem 5rem 4.5rem 5rem 4.5rem 4.5rem 5rem 5.5rem', height: 48 }}>
                <div className="px-2 text-[10px] text-muted-foreground font-mono tabular-nums">{page * PAGE_SIZE + i + 1}</div>
                <div className="px-2 text-[10px] font-mono text-foreground tabular-nums">{run.date}</div>
                <div className="px-2 text-[11px] text-foreground">{run.period}</div>
                <div className="px-2">
                  <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded border', IPK_SOURCE_BADGE[run.source])}>{run.source}</span>
                </div>
                <div className="px-2 text-[11px] font-mono text-foreground tabular-nums">{run.processGroups}</div>
                <div className="px-2 text-[11px] font-mono font-semibold text-foreground tabular-nums">{run.totalRequired}</div>
                <div className="px-2 text-[11px] font-mono text-muted-foreground tabular-nums">{run.onFloor}</div>
                <div className={cn('px-2 text-[11px] font-mono font-bold tabular-nums', IPK_VARIANCE_TEXT(run.variance))}>
                  {run.variance > 0 ? `+${run.variance}` : run.variance}
                </div>
                <div className="px-2">
                  <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded border whitespace-nowrap', IPK_STATUS_BADGE[st])}>{IPK_STATUS_LABEL[st]}</span>
                </div>
                <div className="px-2">
                  <button
                    onClick={() => navigate(`/ipk/${encodeURIComponent(workcell)}/results/${run.id}`)}
                    className="text-[10px] font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    View
                  </button>
                </div>
              </div>
            );
          })}

          {/* Pagination */}
          {pageCount > 1 && (
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-border">
              <span className="text-[10px] text-muted-foreground">Page {page + 1} of {pageCount}</span>
              <div className="flex items-center gap-1">
                <button disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}
                  className="p-1 rounded hover:bg-muted/40 disabled:opacity-30 transition-colors"><ChevronLeft className="h-3.5 w-3.5" /></button>
                <button disabled={page >= pageCount - 1} onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
                  className="p-1 rounded hover:bg-muted/40 disabled:opacity-30 transition-colors"><ChevronRight className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
