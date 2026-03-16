import { useParams } from 'react-router-dom';
import { useBays } from '@/hooks/useBay';
import BayCard from '@/components/dashboard/BayCard';
import MachineDrawer from '@/components/dashboard/MachineDrawer';
import { useState } from 'react';
import type { Bay } from '@/types';

export default function WorkcellView() {
  const { id } = useParams<{ id: string }>();
  const { data: allBays = [] } = useBays();
  const [selectedBay, setSelectedBay] = useState<Bay | null>(null);

  const filtered = allBays.filter((b) => b.workcellId === id);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-foreground capitalize">{id} Workcell</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((bay) => (
          <BayCard key={bay.id} bay={bay} onClick={() => setSelectedBay(bay)} />
        ))}
      </div>
      <MachineDrawer bay={selectedBay} open={!!selectedBay} onClose={() => setSelectedBay(null)} />
    </div>
  );
}
