/**
 * VaNvaHome.tsx
 * ──────────────
 * The VA / NVA dashboard shell: sticky header with the dataset picker and the
 * NVA-target slider, then five tabs. The target lives here rather than in the
 * Simulation tab so every chart on every tab answers to the same number.
 *
 * Route: /va-nva/analytics
 */

import { UnderlineTabs } from '@/components/shared/UnderlineTabs';
import { Slider } from '@/components/ui/slider';
import { useVaNvaRows } from '@/hooks/va_nva/useVaNvaData';
import { cn } from '@/lib/utils';
import {
  NVA_TARGET, NVA_TARGET_MAX, NVA_TARGET_MIN, pct,
} from '@/lib/va_nva/vanvaConstants';
import CorrelationTab from '@/pages/vanva/tabs/CorrelationTab';
import DataTab from '@/pages/vanva/tabs/DataTab';
import DistributionTab from '@/pages/vanva/tabs/DistributionTab';
import OverviewTab from '@/pages/vanva/tabs/OverviewTab';
import SimulationTab from '@/pages/vanva/tabs/SimulationTab';
import { PeriodNav, usePeriod } from '@/pages/vanva/VaNvaSizingKit';
import {
  Gauge, LayoutDashboard, PieChart, RotateCcw, Scale, Sliders, Table2,
} from 'lucide-react';
import { useState } from 'react';

const TABS = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard, tip: 'Plant KPIs, ranking and Pareto' },
  { key: 'distribution', label: 'Distribution', icon: PieChart, tip: 'Spread of labour and lean maturity' },
  { key: 'correlation', label: 'Correlation', icon: Gauge, tip: 'Sizing vs actual vs NVA' },
  { key: 'simulation', label: 'Simulation', icon: Sliders, tip: 'Cost of hitting the target' },
  { key: 'data', label: 'Data', icon: Table2, tip: 'The workbook, every column' },
] as const;

type TabKey = typeof TABS[number]['key'];

export default function VaNvaHome() {
  const [tab, setTab] = useState<TabKey>('overview');
  const [target, setTarget] = useState(NVA_TARGET);
  const { period, periods, setPeriod, dataset: ds } = usePeriod();
  const { rows, dataset, isLoading } = useVaNvaRows(target, ds?.id);

  return (
    <div className="relative">
      {/* ─── Sticky header ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-6 pt-3 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Scale className="h-4 w-4 text-teal-500" />
              VA / NVA
            </h1>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Value-add vs non-value-add direct labour
              {dataset && <> · {dataset.periodLabel} · <span className="font-mono">{dataset.filename}</span></>}
            </p>
          </div>

          <div className="flex items-end gap-5">
            {/* NVA target — drives every derived column on every tab. */}
            <div className="w-[210px]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">NVA target</span>
                <span className="flex items-center gap-1.5">
                  <span className="text-[11px] font-mono font-bold text-amber-400 tabular-nums">{pct(target, 0)}</span>
                  {target !== NVA_TARGET && (
                    <button onClick={() => setTarget(NVA_TARGET)} title="Back to the workbook's 20%"
                      className="text-muted-foreground hover:text-foreground">
                      <RotateCcw className="h-3 w-3" />
                    </button>
                  )}
                </span>
              </div>
              <Slider
                value={[target * 100]}
                min={NVA_TARGET_MIN * 100}
                max={NVA_TARGET_MAX * 100}
                step={1}
                onValueChange={([v]) => setTarget(v / 100)}
              />
            </div>

            <PeriodNav period={period} periods={periods} onChange={setPeriod} />
          </div>
        </div>

        <div className="px-6">
          <UnderlineTabs tabs={TABS} active={tab} onChange={k => setTab(k as TabKey)} />
        </div>
      </div>

      {/* ─── Body ───────────────────────────────────────────────────────── */}
      <div className="p-5">
        {isLoading || !dataset ? (
          <div className={cn('grid grid-cols-1 xl:grid-cols-3 gap-4')}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-56 rounded-xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {tab === 'overview' && <OverviewTab rows={rows} target={target} />}
            {tab === 'distribution' && <DistributionTab rows={rows} target={target} />}
            {tab === 'correlation' && <CorrelationTab rows={rows} target={target} />}
            {tab === 'simulation' && <SimulationTab rawRows={dataset.rows} rows={rows} target={target} />}
            {tab === 'data' && <DataTab rows={rows} target={target} />}
          </>
        )}
      </div>
    </div>
  );
}
