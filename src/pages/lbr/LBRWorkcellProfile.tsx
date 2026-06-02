/**
 * LBRWorkcellProfile.tsx
 * ───────────────────────
 * Layer 2 — workcell profile. Two-column: left hero + aggregate stats, right
 * assemblies table (line shown as a badge). Click an assembly → assembly detail.
 *
 * Route: /lbr/:workcell
 */

import { getWorkcellLogo } from '@/lib/ole/oleConstants';
import { cn } from '@/lib/utils';
import {
  getLBRStatus, lbrTextClass, LBR_STATUS_BADGE, LBR_STATUS_BAR, LBR_STATUS_LABEL, type LBRStatus,
} from '@/lib/lbr/lbrConstants';
import { useLBRWorkcells } from '@/hooks/lbr/useLBRWorkcells';
import { useLBRAssemblies } from '@/hooks/lbr/useLBRAssemblies';
import LBRBreadcrumb from './LBRBreadcrumb';
import type { LBRAssembly } from './types';
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const GRID = '1.5rem minmax(7rem,1fr) 2.5rem 6rem 7rem 4.5rem 4rem 5rem 4.5rem 4rem 5rem 5rem';
const HEADERS = ['#', 'Assembly', 'Rev', 'Line', 'Family', 'Demand', 'Plays', 'Best LBR', 'Best UPH', 'Best LBL', 'Bottleneck', 'Status'];

export default function LBRWorkcellProfile() {
  const navigate = useNavigate();
  const { workcell: paramWc = '' } = useParams();
  const workcellId = decodeURIComponent(paramWc);
  const { data: workcells = [] } = useLBRWorkcells();
  const { data: assemblies = [] } = useLBRAssemblies(workcellId);

  const wc = workcells.find(w => w.id === workcellId);
  const wcName = wc?.name ?? workcellId;
  const logo = getWorkcellLogo(wcName);
  const studied = Boolean(wc?.lastStudyDate);
  const heroStatus = getLBRStatus(wc?.avgLbr ?? 0, studied);

  const byStatus = useMemo(() => {
    const counts: Record<LBRStatus, number> = { critical: 0, warning: 0, healthy: 0, never_studied: 0 };
    assemblies.forEach(a => { counts[a.status]++; });
    return counts;
  }, [assemblies]);

  const avgUpph = useMemo(() => {
    const vals = assemblies.filter(a => a.bestUpph > 0).map(a => a.bestUpph);
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
  }, [assemblies]);

  const drillTo = (a: string) => navigate(`/lbr/${encodeURIComponent(workcellId)}/${encodeURIComponent(a)}`);

  return (
    <div className="relative">
      {/* ─── Sticky breadcrumb header ──────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-6 py-3">
          <LBRBreadcrumb
            items={[
              { label: 'LBR', href: '/lbr' },
              { label: wcName, workcellLogoKey: wcName },
            ]}
            backHref="/lbr"
          />
        </div>
      </div>

      <div className="p-5 flex gap-5">
        {/* ─── LEFT: hero + stats ──────────────────────────────────────── */}
        <div className="w-[300px] flex-shrink-0 flex flex-col gap-4">
          {/* Hero */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-5">
              <div className="flex items-start gap-3">
                {logo ? (
                  <div className="w-20 h-10 rounded-lg border border-border bg-white flex items-center justify-center overflow-hidden flex-shrink-0">
                    <img src={logo} alt={wcName} className="w-full h-full object-contain p-1" />
                  </div>
                ) : (
                  <div className="w-20 h-10 rounded-lg border border-border bg-muted flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-muted-foreground">{wcName.slice(0, 3).toUpperCase()}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-semibold">Workcell</p>
                  <p className="text-sm font-semibold text-foreground truncate mt-0.5">{wcName}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{wc?.division}</p>
                </div>
              </div>

              <p className={cn('text-5xl font-mono font-black mt-4 leading-none tabular-nums', lbrTextClass(wc?.avgLbr ?? 0, studied))}>
                {studied ? `${wc?.avgLbr}%` : '—'}
              </p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Avg line balance rate</p>
              <div className="mt-3 h-1 rounded-full bg-muted/40 overflow-hidden">
                <div className={cn('h-full rounded-full', LBR_STATUS_BAR[heroStatus])} style={{ width: `${Math.min(wc?.avgLbr ?? 0, 100)}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-2 divide-x divide-border border-t border-border">
              <Stat label="Assemblies" value={String(wc?.activeAssemblies ?? assemblies.length)} />
              <Stat label="Playbooks" value={studied ? String(wc?.totalPlaybooks ?? 0) : '—'} />
            </div>
          </div>

          {/* Status breakdown */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border">
              <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Assemblies by Status</p>
            </div>
            {([
              { key: 'critical' as LBRStatus }, { key: 'warning' as LBRStatus },
              { key: 'healthy' as LBRStatus }, { key: 'never_studied' as LBRStatus },
            ]).map((r, i, arr) => (
              <div key={r.key} className={cn('flex items-center justify-between px-4 py-2', i < arr.length - 1 && 'border-b border-border')}>
                <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border', LBR_STATUS_BADGE[r.key])}>{LBR_STATUS_LABEL[r.key]}</span>
                <span className="text-sm font-mono font-bold text-foreground tabular-nums">{byStatus[r.key] || '—'}</span>
              </div>
            ))}
          </div>

          {/* Quick stats */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border">
              <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Quick Stats</p>
            </div>
            <div className="grid grid-cols-2 divide-x divide-y divide-border">
              <Stat label="Avg UPH" value={studied ? String(wc?.avgUph ?? 0) : '—'} />
              <Stat label="Avg UPPH" value={avgUpph > 0 ? avgUpph.toFixed(1) : '—'} />
              <Stat label="Bottlenecks" value={String(wc?.bottlenecks ?? 0)} tone={wc && wc.bottlenecks > 0 ? 'red' : undefined} />
              <Stat label="Last study" value={wc?.lastStudyDate ?? '—'} small />
            </div>
          </div>
        </div>

        {/* ─── RIGHT: assemblies table ─────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
              <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Assemblies · {assemblies.length}</p>
              <span className="text-[9px] text-muted-foreground">Click a row to open playbooks</span>
            </div>
            <div className="overflow-x-auto">
              <div style={{ minWidth: 880 }}>
                <div className="grid bg-muted/50 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold border-b border-border" style={{ gridTemplateColumns: GRID }}>
                  {HEADERS.map((h, i) => <div key={i} className={cn('px-2 py-2', i >= 5 && 'text-right')}>{h}</div>)}
                </div>
                {assemblies.map((a: LBRAssembly, idx) => {
                  const aStudied = a.status !== 'never_studied';
                  return (
                    <div key={a.id} onClick={() => drillTo(a.id)}
                      className="grid items-center border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                      style={{ gridTemplateColumns: GRID, height: 52 }}>
                      <div className="px-2 text-[10px] text-muted-foreground font-mono tabular-nums">{idx + 1}</div>
                      <div className="px-2 text-[11px] font-semibold text-foreground truncate">{a.assembly}</div>
                      <div className="px-2 text-[10px] font-mono text-muted-foreground">{a.revision}</div>
                      <div className="px-2">
                        <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded border border-border bg-muted/40 text-muted-foreground truncate inline-block max-w-full">{a.line}</span>
                      </div>
                      <div className="px-2 text-[10px] text-muted-foreground truncate">{a.family}</div>
                      <div className="px-2 text-right text-[11px] font-mono text-foreground tabular-nums">{a.demand.toLocaleString()}</div>
                      <div className="px-2 text-right text-[11px] font-mono text-muted-foreground tabular-nums">{a.playbookCount || '—'}</div>
                      <div className={cn('px-2 text-right text-[11px] font-mono font-bold tabular-nums', lbrTextClass(a.bestLbr, aStudied))}>
                        {aStudied ? `${a.bestLbr}%` : '—'}
                      </div>
                      <div className="px-2 text-right text-[11px] font-mono text-foreground tabular-nums">{aStudied ? a.bestUph : '—'}</div>
                      <div className="px-2 text-right text-[11px] font-mono text-muted-foreground tabular-nums">{aStudied ? `${a.bestLbl}s` : '—'}</div>
                      <div className="px-2 text-right text-[10px] font-mono text-muted-foreground truncate">{aStudied ? a.bottleneckStation : '—'}</div>
                      <div className="px-2 flex justify-end">
                        <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded border whitespace-nowrap', LBR_STATUS_BADGE[a.status])}>{LBR_STATUS_LABEL[a.status]}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone, small }: { label: string; value: string; tone?: 'red'; small?: boolean }) {
  return (
    <div className="px-3 py-2.5">
      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={cn('font-mono font-bold mt-0.5 tabular-nums', small ? 'text-[11px]' : 'text-sm', tone === 'red' ? 'text-red-400' : 'text-foreground')}>{value}</p>
    </div>
  );
}
