import { useState } from 'react';
import { Activity, Layers, Factory, Clock } from 'lucide-react';
import { useBays } from '@/hooks/useBay';
import { totalWip } from '@/mocks/data';
import KpiTile from '@/components/dashboard/KpiTile';
import BayCard from '@/components/dashboard/BayCard';
import MachineDrawer from '@/components/dashboard/MachineDrawer';
import type { Bay } from '@/types';

export default function GlobalOverview() {
  const { data: bayList = [] } = useBays();
  const [selectedBay, setSelectedBay] = useState<Bay | null>(null);

  const avgProductivity = bayList.length
    ? (bayList.reduce((s, b) => s + b.productivity, 0) / bayList.length).toFixed(1)
    : '0';
  const totalDowntime = '39m'; // sum of mock data

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile label="Avg Productivity" value={`${avgProductivity}%`} icon={<Activity className="h-5 w-5" />} />
        <KpiTile label="Total WIP" value={totalWip} icon={<Layers className="h-5 w-5" />} />
        <KpiTile label="Active Bays" value={bayList.length} icon={<Factory className="h-5 w-5" />} />
        <KpiTile label="Total Downtime" value={totalDowntime} icon={<Clock className="h-5 w-5" />} />
      </div>

      {/* Bay cards bento grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {bayList.map((bay) => (
          <BayCard key={bay.id} bay={bay} onClick={() => setSelectedBay(bay)} />
        ))}
      </div>

      <MachineDrawer bay={selectedBay} open={!!selectedBay} onClose={() => setSelectedBay(null)} />
    </div>
  );
}
