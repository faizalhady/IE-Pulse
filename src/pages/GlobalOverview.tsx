import { useState, useMemo } from 'react';
import { useBays } from '@/hooks/useBay';
import { totalWip } from '@/mocks/data';
import BayCard from '@/components/dashboard/BayCard';
import MachineDrawer from '@/components/dashboard/MachineDrawer';
import type { Bay } from '@/types';
import { workcells } from '@/mocks/data';

const WORKCELL_FILTERS = ['All', ...workcells.map(w => w.name)];
const SHIFT_FILTERS = ['All Shifts', 'Day', 'Night'];

export default function GlobalOverview() {
  const { data: bayList = [] } = useBays();
  const [selectedBay, setSelectedBay] = useState<Bay | null>(null);
  const [workcellFilter, setWorkcellFilter] = useState('All');
  const [shiftFilter, setShiftFilter] = useState('All Shifts');

  const avgProductivity = bayList.length
    ? (bayList.reduce((s, b) => s + b.productivity, 0) / bayList.length).toFixed(1)
    : '0';

  const activeBays = bayList.filter(b => b.status !== 'idle').length;
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const filteredBays = useMemo(() => {
    if (workcellFilter === 'All') return bayList;
    const wc = workcells.find(w => w.name === workcellFilter);
    if (!wc) return bayList;
    return bayList.filter(b => wc.bayIds.includes(b.id));
  }, [bayList, workcellFilter]);

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-1 py-3 border-b border-border text-sm font-mono">
        <span className="text-muted-foreground">Avg Productivity: <span className="text-foreground font-semibold">{avgProductivity}%</span></span>
        <span className="text-muted-foreground">Total WIP: <span className="text-foreground font-semibold">{totalWip}</span></span>
        <span className="text-muted-foreground">Active: <span className="text-foreground font-semibold">{activeBays}/{bayList.length}</span></span>
        <span className="text-muted-foreground">Downtime: <span className="text-foreground font-semibold">2h 14m</span></span>
        <span className="text-muted-foreground ml-auto">{today}</span>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap items-center gap-2">
        {WORKCELL_FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setWorkcellFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
              workcellFilter === f
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-transparent text-muted-foreground border-border hover:border-foreground/30'
            }`}
          >
            {f}
          </button>
        ))}
        <span className="w-px h-5 bg-border mx-1" />
        {SHIFT_FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setShiftFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
              shiftFilter === f
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-transparent text-muted-foreground border-border hover:border-foreground/30'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Bay cards bento grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredBays.map((bay) => (
          <BayCard key={bay.id} bay={bay} onClick={() => setSelectedBay(bay)} />
        ))}
      </div>

      <MachineDrawer bay={selectedBay} open={!!selectedBay} onClose={() => setSelectedBay(null)} />
    </div>
  );
}
