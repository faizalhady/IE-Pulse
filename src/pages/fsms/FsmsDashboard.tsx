/**
 * FsmsDashboard.tsx — Floor Space dashboard shell (tab frame + routing only).
 * ────────────────────────────────────────────────────────────────────────────
 * Each tab is its own file (house pattern — see PPQT/IPK). Tabs mirror the real
 * legacy dashboard pages:
 *
 *   Overview     → FsmsOverview    (Home — KPIs + plant-utilisation chart)
 *   Summary      → FsmsSummary     (summary-space-directory)
 *   Workcell     → FsmsWorkcell    (workcell-space-directory — KPIs + variance + charts)
 *   Revenue/sqft → FsmsRevenue     (plant-space-directory — revenue per sqft + Golden Line)
 *
 * (Analysis page still to come.)
 * Route: /fsms/dashboard
 */

import { UnderlineTabs } from '@/components/shared/UnderlineTabs';
import FsmsOverview from '@/pages/fsms/FsmsOverview';
import FsmsRevenue from '@/pages/fsms/FsmsRevenue';
import FsmsSummary from '@/pages/fsms/FsmsSummary';
import FsmsWorkcell from '@/pages/fsms/FsmsWorkcell';
import { DollarSign, Grid3x3, LayoutDashboard, Table2 } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const TABS = [
  { key: 'overview', label: 'Overview',     icon: LayoutDashboard, tip: 'KPIs + plant utilisation' },
  { key: 'summary',  label: 'Summary',      icon: Table2,          tip: 'Summary space directory' },
  { key: 'workcell', label: 'Workcell',     icon: Grid3x3,         tip: 'Workcell space directory' },
  { key: 'revenue',  label: 'Revenue/sqft', icon: DollarSign,      tip: 'Revenue per sqft + Golden Line' },
] as const;
type TabKey = typeof TABS[number]['key'];

export default function FsmsDashboard() {
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const plantParam = searchParams.get('plant');
  const [tab, setTab] = useState<TabKey>(
    TABS.some(t => t.key === tabParam) ? (tabParam as TabKey) : 'overview',
  );

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-20 bg-background border-b border-border px-5 pb-0">
        <div className="pt-4 pb-3">
          <h1 className="text-xl font-semibold text-foreground">Floor Space — Dashboard</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Utilisation, forecast and revenue across P1 · P2 · BK
          </p>
        </div>
        <UnderlineTabs tabs={TABS} active={tab} onChange={setTab} />
      </div>

      {tab === 'overview' && <FsmsOverview />}
      {tab === 'summary'  && <FsmsSummary />}
      {tab === 'workcell' && <FsmsWorkcell initialPlant={plantParam} />}
      {tab === 'revenue'  && <FsmsRevenue />}
    </div>
  );
}
