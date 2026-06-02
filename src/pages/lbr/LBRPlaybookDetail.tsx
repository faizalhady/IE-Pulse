/**
 * LBRPlaybookDetail.tsx
 * ──────────────────────
 * Layer 4 — playbook deep-dive. Sticky breadcrumb header + metric pills + a
 * 7-tab interface. Tab state lives in the `?tab=` URL search param.
 *
 * Route: /lbr/:workcell/:assembly/:playbook
 */

import { cn } from '@/lib/utils';
import { lbrTextClass, vsTaktTextClass } from '@/lib/lbr/lbrConstants';
import { useLBRWorkcells } from '@/hooks/lbr/useLBRWorkcells';
import { useLBRAssemblies } from '@/hooks/lbr/useLBRAssemblies';
import { useLBRPlaybooks } from '@/hooks/lbr/useLBRPlaybooks';
import { useLBRPlaybook } from '@/hooks/lbr/useLBRPlaybook';
import LBRBreadcrumb from './LBRBreadcrumb';
import OverviewTab from './tabs/OverviewTab';
import YamazumiTab from './tabs/YamazumiTab';
import StationsTab from './tabs/StationsTab';
import WorkElementsTab from './tabs/WorkElementsTab';
import SimulateTab from './tabs/SimulateTab';
import TimeStudyTab from './tabs/TimeStudyTab';
import CompareTab from './tabs/CompareTab';
import { Loader2 } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'yamazumi', label: 'Yamazumi' },
  { key: 'stations', label: 'Stations' },
  { key: 'elements', label: 'Work Elements' },
  { key: 'simulate', label: 'Simulate' },
  { key: 'timestudy', label: 'Time Study' },
  { key: 'compare', label: 'Compare' },
] as const;

export default function LBRPlaybookDetail() {
  const navigate = useNavigate();
  const { workcell: paramWc = '', assembly: paramAsm = '', playbook: paramPb = '' } = useParams();
  const workcellId = decodeURIComponent(paramWc);
  const assemblyId = decodeURIComponent(paramAsm);
  const playbookId = decodeURIComponent(paramPb);

  const [params, setParams] = useSearchParams();
  const activeTab = params.get('tab') ?? 'overview';
  const setTab = (t: string) => { const out = new URLSearchParams(params); out.set('tab', t); setParams(out, { replace: true }); };

  const { data: workcells = [] } = useLBRWorkcells();
  const { data: assemblies = [] } = useLBRAssemblies(workcellId);
  const { data: playbooks = [] } = useLBRPlaybooks(workcellId, assemblyId);
  const { data: playbook, isLoading } = useLBRPlaybook(workcellId, assemblyId, playbookId);

  const wcName = workcells.find(w => w.id === workcellId)?.name ?? workcellId;
  const asmName = assemblies.find(a => a.id === assemblyId)?.assembly ?? assemblyId;

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }
  if (!playbook) {
    return <div className="p-8 text-sm text-muted-foreground">Playbook not found.</div>;
  }

  return (
    <div className="relative">
      {/* ─── Sticky header ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-6 pt-3">
          <LBRBreadcrumb
            items={[
              { label: 'LBR', href: '/lbr' },
              { label: wcName, href: `/lbr/${encodeURIComponent(workcellId)}`, workcellLogoKey: wcName },
              { label: asmName, href: `/lbr/${encodeURIComponent(workcellId)}/${encodeURIComponent(assemblyId)}` },
              { label: playbook.name },
            ]}
          />
        </div>

        {/* Title + metric pills */}
        <div className="px-6 py-2.5 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-foreground truncate">{playbook.name}</h1>
              {playbook.isActive && (
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded border bg-emerald-500/15 text-emerald-400 border-emerald-500/30 flex-shrink-0">Active</span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground truncate">{playbook.scenario} · {playbook.operators} operators</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Pill label="LBR" value={`${playbook.lbr}%`} className={lbrTextClass(playbook.lbr)} />
            <Pill label="UPH" value={String(playbook.uph)} />
            <Pill label="UPPH" value={String(playbook.upph)} />
            <Pill label="LBL" value={`${playbook.lbl}s`} />
            <Pill label="vs TAKT" value={`${playbook.vsTaktPct}%`} className={vsTaktTextClass(playbook.vsTaktPct)} />
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-4 px-6 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cn('-mb-px whitespace-nowrap border-b-2 px-1 py-2.5 text-xs font-medium transition-colors',
                activeTab === t.key ? 'border-emerald-500 text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Tab content ───────────────────────────────────────────────── */}
      <div className="p-5">
        {activeTab === 'overview'  && <OverviewTab playbook={playbook} onOpenTab={setTab} />}
        {activeTab === 'yamazumi'  && <YamazumiTab playbook={playbook} />}
        {activeTab === 'stations'  && <StationsTab playbook={playbook} />}
        {activeTab === 'elements'  && <WorkElementsTab playbook={playbook} />}
        {activeTab === 'simulate'  && <SimulateTab playbook={playbook} />}
        {activeTab === 'timestudy' && <TimeStudyTab playbook={playbook} />}
        {activeTab === 'compare'   && <CompareTab playbooks={playbooks} current={playbook} />}
      </div>
    </div>
  );
}

function Pill({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-2.5 py-1 text-center">
      <p className="text-[8px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={cn('text-xs font-mono font-bold tabular-nums leading-tight', className ?? 'text-foreground')}>{value}</p>
    </div>
  );
}
