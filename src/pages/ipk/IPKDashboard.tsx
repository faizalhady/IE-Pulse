/**
 * IPKDashboard.tsx
 * ─────────────────
 * Hub / overview page for one workcell: stat cards + read-only last-run
 * summary. Navigation to the tool pages is via the tab bar in the shared
 * profile header (IPKWorkcellHeader).
 *
 * Route: /ipk/:workcell
 */

import { cn } from '@/lib/utils';
import { ArrowRight, Download, Play } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useIPKWorkcells } from '@/hooks/ipk/useIPKWorkcells';
import { useIPKSummary } from '@/hooks/ipk/useIPKSummary';
import { IPK_VARIANCE_TEXT } from '@/lib/ipk/ipkConstants';
import { totalRequired } from '@/lib/ipk/ipkCalc';
import IPKWorkcellHeader from './IPKWorkcellHeader';

export default function IPKDashboard() {
  const navigate = useNavigate();
  const { workcell = '' } = useParams();
  const { data: rows = [] } = useIPKSummary(workcell);
  useIPKWorkcells(); // warm cache for the shared header

  const totals = useMemo(() => {
    const required = rows.reduce((s, r) => s + totalRequired(r), 0);
    const onFloor = rows.reduce((s, r) => s + r.actualOnFloor, 0);
    return { required, onFloor, variance: required - onFloor, groups: rows.length };
  }, [rows]);

  const wcEnc = encodeURIComponent(workcell);

  return (
    <div className="relative">
      <IPKWorkcellHeader
        workcellId={workcell}
        actions={<>
          <button
            onClick={() => navigate(`/ipk/${wcEnc}/results/latest`)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          >
            <Download className="h-3.5 w-3.5" /> Export
          </button>
          <button
            onClick={() => navigate(`/ipk/${wcEnc}/simulate`)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 transition-colors"
          >
            <Play className="h-3.5 w-3.5" /> Run New Simulation
          </button>
        </>}
      />

      <div className="p-5 flex flex-col gap-5">
        {/* ─── Stat cards ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard label="Trolleys Required" value={totals.required} />
          <StatCard label="Trolleys on Floor" value={totals.onFloor} muted />
          <StatCard label="Variance" value={totals.variance} valueClass={IPK_VARIANCE_TEXT(totals.variance)} signed />
          <StatCard label="Process Groups" value={totals.groups} />
        </div>

        {/* ─── Quick summary table (read-only) ─────────────────────────── */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
            <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Last Run · Process Group Summary</p>
            <span className="text-[9px] text-muted-foreground">Read-only overview</span>
          </div>

          <div
            className="grid bg-muted/50 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold border-b border-border"
            style={{ gridTemplateColumns: '1.5rem minmax(8rem,1fr) 5rem 5rem 5rem 5.5rem 5rem 5rem' }}
          >
            {['#', 'Process Group', 'Eff. UPH', 'IPK Units', 'IPK Trly', 'Required', 'On Floor', 'Variance'].map((h, i) => (
              <div key={i} className="px-2 py-2">{h}</div>
            ))}
          </div>

          {rows.map((r, i) => {
            const req = totalRequired(r);
            const variance = req - r.actualOnFloor;
            return (
              <div
                key={r.processGroup}
                className="grid items-center border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                style={{ gridTemplateColumns: '1.5rem minmax(8rem,1fr) 5rem 5rem 5rem 5.5rem 5rem 5rem', height: 44 }}
              >
                <div className="px-2 text-[10px] text-muted-foreground font-mono tabular-nums">{i + 1}</div>
                <div className="px-2 text-[11px] font-semibold text-foreground truncate">{r.processGroup}</div>
                <div className="px-2 text-[11px] font-mono text-muted-foreground tabular-nums">{r.effectiveUph}</div>
                <div className="px-2 text-[11px] font-mono text-foreground tabular-nums">{r.ipkUnits}</div>
                <div className="px-2 text-[11px] font-mono text-foreground tabular-nums">{r.ipkTrolleys}</div>
                <div className="px-2 text-[11px] font-mono font-semibold text-foreground tabular-nums">{req}</div>
                <div className="px-2 text-[11px] font-mono text-muted-foreground tabular-nums">{r.actualOnFloor}</div>
                <div className={cn('px-2 text-[11px] font-mono font-bold tabular-nums', IPK_VARIANCE_TEXT(variance))}>
                  {variance > 0 ? `+${variance}` : variance}
                </div>
              </div>
            );
          })}

          <button
            onClick={() => navigate(`/ipk/${wcEnc}/results/latest`)}
            className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-[11px] font-semibold text-emerald-400 hover:bg-muted/30 transition-colors"
          >
            View Full Results <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, valueClass, muted, signed }: {
  label: string; value: number; valueClass?: string; muted?: boolean; signed?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={cn('text-3xl font-mono font-black mt-1 tabular-nums leading-none',
        valueClass ?? (muted ? 'text-muted-foreground' : 'text-foreground'))}>
        {signed && value > 0 ? `+${value}` : value}
      </p>
    </div>
  );
}
