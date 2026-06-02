/**
 * LBRAssemblyDetail.tsx
 * ──────────────────────
 * Layer 3 — all playbooks for one assembly. Two-column: left assembly hero +
 * best-metrics, right playbooks table. Click a playbook → playbook deep-dive.
 *
 * Route: /lbr/:workcell/:assembly
 */

import { cn } from '@/lib/utils';
import {
  lbrTextClass, vsTaktTextClass, LBR_STATUS_BADGE, LBR_STATUS_BAR, LBR_STATUS_LABEL,
} from '@/lib/lbr/lbrConstants';
import { useLBRWorkcells } from '@/hooks/lbr/useLBRWorkcells';
import { useLBRAssemblies } from '@/hooks/lbr/useLBRAssemblies';
import { useLBRPlaybooks } from '@/hooks/lbr/useLBRPlaybooks';
import LBRBreadcrumb from './LBRBreadcrumb';
import { CheckCircle2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

const GRID = '1.5rem minmax(8rem,1fr) minmax(8rem,1.3fr) 4rem 7rem 3.5rem 4rem 4rem 5rem 5rem 4rem 6rem';
const HEADERS = ['#', 'Playbook', 'Scenario', 'Ops', 'LBR', 'UPH', 'UPPH', 'LBL', 'Bottleneck', 'vs TAKT', 'Active', 'Updated'];

export default function LBRAssemblyDetail() {
  const navigate = useNavigate();
  const { workcell: paramWc = '', assembly: paramAsm = '' } = useParams();
  const workcellId = decodeURIComponent(paramWc);
  const assemblyId = decodeURIComponent(paramAsm);

  const { data: workcells = [] } = useLBRWorkcells();
  const { data: assemblies = [] } = useLBRAssemblies(workcellId);
  const { data: playbooks = [] } = useLBRPlaybooks(workcellId, assemblyId);

  const wc = workcells.find(w => w.id === workcellId);
  const wcName = wc?.name ?? workcellId;
  const asm = assemblies.find(a => a.id === assemblyId);
  const activePb = playbooks.find(p => p.isActive);

  const drillTo = (p: string) => navigate(`/lbr/${encodeURIComponent(workcellId)}/${encodeURIComponent(assemblyId)}/${encodeURIComponent(p)}`);

  return (
    <div className="relative">
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-6 py-3">
          <LBRBreadcrumb
            items={[
              { label: 'LBR', href: '/lbr' },
              { label: wcName, href: `/lbr/${encodeURIComponent(workcellId)}`, workcellLogoKey: wcName },
              { label: asm?.assembly ?? assemblyId },
            ]}
          />
        </div>
      </div>

      <div className="p-5 flex gap-5">
        {/* ─── LEFT: assembly hero ─────────────────────────────────────── */}
        <div className="w-[300px] flex-shrink-0 flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-5">
              <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-semibold">Assembly</p>
              <p className="text-lg font-bold text-foreground mt-0.5">{asm?.assembly ?? assemblyId}</p>
              <p className="text-[10px] text-muted-foreground">Rev {asm?.revision ?? '—'} · {asm?.family ?? '—'}</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded border border-border bg-muted/40 text-muted-foreground">{asm?.line ?? '—'}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 divide-x divide-border border-t border-border">
              <Stat label="Demand" value={asm ? asm.demand.toLocaleString() : '—'} />
              <Stat label="Last study" value={asm?.lastStudyDate ?? '—'} small />
            </div>
          </div>

          {/* Active playbook */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border">
              <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Active Playbook</p>
            </div>
            <div className="p-4">
              {activePb ? (
                <button onClick={() => drillTo(activePb.id)} className="flex items-center gap-2 text-left w-full group">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate group-hover:text-emerald-400 transition-colors">{activePb.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{activePb.scenario}</p>
                  </div>
                </button>
              ) : (
                <p className="text-[11px] text-muted-foreground">No active playbook for this assembly.</p>
              )}
            </div>
          </div>

          {/* Best metrics */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border">
              <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Best Across Playbooks</p>
            </div>
            <div className="grid grid-cols-2 divide-x divide-y divide-border">
              <Stat label="Best LBR" value={asm && asm.bestLbr > 0 ? `${asm.bestLbr}%` : '—'} tone={asm ? lbrTextClass(asm.bestLbr) : undefined} />
              <Stat label="Best UPH" value={asm && asm.bestUph > 0 ? String(asm.bestUph) : '—'} />
              <Stat label="Best UPPH" value={asm && asm.bestUpph > 0 ? asm.bestUpph.toFixed(1) : '—'} />
              <Stat label="Best LBL" value={asm && asm.bestLbl > 0 ? `${asm.bestLbl}s` : '—'} />
            </div>
          </div>
        </div>

        {/* ─── RIGHT: playbooks table ──────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
              <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Playbooks · {playbooks.length}</p>
              <span className="text-[9px] text-muted-foreground">Click a row for the deep-dive</span>
            </div>
            {playbooks.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground text-sm">No playbooks studied for this assembly yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <div style={{ minWidth: 920 }}>
                  <div className="grid bg-muted/50 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold border-b border-border" style={{ gridTemplateColumns: GRID }}>
                    {HEADERS.map((h, i) => <div key={i} className={cn('px-2 py-2', i >= 3 && 'text-right')}>{h}</div>)}
                  </div>
                  {playbooks.map((p, idx) => (
                    <div key={p.id} onClick={() => drillTo(p.id)}
                      className="grid items-center border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                      style={{ gridTemplateColumns: GRID, height: 52 }}>
                      <div className="px-2 text-[10px] text-muted-foreground font-mono tabular-nums">{idx + 1}</div>
                      <div className="px-2 text-[11px] font-semibold text-foreground truncate">{p.name}</div>
                      <div className="px-2 text-[10px] text-muted-foreground truncate">{p.scenario}</div>
                      <div className="px-2 text-right text-[11px] font-mono text-foreground tabular-nums">{p.operators}</div>
                      <div className="px-2">
                        <p className={cn('text-right text-[11px] font-mono font-bold tabular-nums leading-none', lbrTextClass(p.lbr))}>{p.lbr}%</p>
                        <div className="mt-1 h-0.5 rounded-full bg-muted/40 overflow-hidden">
                          <div className={cn('h-full rounded-full', LBR_STATUS_BAR[p.lbr < 85 ? 'critical' : p.lbr < 90 ? 'warning' : 'healthy'])} style={{ width: `${Math.min(p.lbr, 100)}%` }} />
                        </div>
                      </div>
                      <div className="px-2 text-right text-[11px] font-mono text-foreground tabular-nums">{p.uph}</div>
                      <div className="px-2 text-right text-[11px] font-mono text-muted-foreground tabular-nums">{p.upph}</div>
                      <div className="px-2 text-right text-[11px] font-mono text-muted-foreground tabular-nums">{p.lbl}s</div>
                      <div className="px-2 text-right text-[10px] font-mono text-muted-foreground truncate">{p.bottleneckStation}</div>
                      <div className={cn('px-2 text-right text-[11px] font-mono font-semibold tabular-nums', vsTaktTextClass(p.vsTaktPct))}>{p.vsTaktPct}%</div>
                      <div className="px-2 flex justify-end">
                        {p.isActive
                          ? <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded border bg-emerald-500/15 text-emerald-400 border-emerald-500/30">Active</span>
                          : <span className="text-[10px] text-muted-foreground">—</span>}
                      </div>
                      <div className="px-2 text-right text-[10px] font-mono text-muted-foreground tabular-nums">{p.lastUpdated}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone, small }: { label: string; value: string; tone?: string; small?: boolean }) {
  return (
    <div className="px-3 py-2.5">
      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={cn('font-mono font-bold mt-0.5 tabular-nums', small ? 'text-[11px]' : 'text-sm', tone ?? 'text-foreground')}>{value}</p>
    </div>
  );
}
