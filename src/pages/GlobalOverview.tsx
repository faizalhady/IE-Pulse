import BayCard from '@/components/dashboard/BayCard';
import MachineDrawer from '@/components/dashboard/MachineDrawer';
import { bays, workcells } from '@/mocks/data';
import type { Bay } from '@/types';
import { useMemo, useState } from 'react';

const WORKCELL_FILTERS = ['All', ...workcells.map(w => w.name)];
const SHIFT_FILTERS = ['All Shifts', 'Day', 'Night'];

export default function GlobalOverview() {
  // Still on mock data — API migration TBD
  const bayList: Bay[] = bays as unknown as Bay[];

  const [selectedBay, setSelectedBay] = useState<Bay | null>(null);
  const [workcellFilter, setWorkcellFilter] = useState('All');
  const [shiftFilter, setShiftFilter] = useState('All Shifts');

  const avgProductivity = bayList.length
    ? (bayList.reduce((s, b) => s + (b as any).productivity, 0) / bayList.length).toFixed(1)
    : '0';

  const activeBays = bayList.filter(b => b.status !== 'idle').length;
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const totalWip = bayList.reduce((s, b) => s + ((b as any).overallWip ?? 0), 0);

  const filteredBays = useMemo(() => {
    if (workcellFilter === 'All') return bayList;
    const wc = workcells.find(w => w.name === workcellFilter);
    if (!wc) return bayList;
    return bayList.filter(b => (wc as any).bayIds?.includes((b as any).id));
  }, [bayList, workcellFilter]);

  return (
    <div className="space-y-0">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-background border-b border-border px-6">
        <div className="pt-4 pb-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Overview</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Live bay status across all workcells</p>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm font-mono">
            <span className="text-muted-foreground">Avg Prod. <span className="text-foreground font-semibold">{avgProductivity}%</span></span>
            <span className="text-muted-foreground">WIP <span className="text-foreground font-semibold">{totalWip}</span></span>
            <span className="text-muted-foreground">Active <span className="text-foreground font-semibold">{activeBays}/{bayList.length}</span></span>
            <span className="text-muted-foreground">Downtime <span className="text-foreground font-semibold">2h 14m</span></span>
            <span className="text-muted-foreground">{today}</span>
          </div>
        </div>
      </div>

      {/* Filters — in body */}
      <div className="px-6 pt-4 pb-3 flex flex-wrap items-center gap-2">
        {WORKCELL_FILTERS.map(f => (
          <button key={f} onClick={() => setWorkcellFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
              workcellFilter === f ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent text-muted-foreground border-border hover:border-foreground/30'
            }`}>{f}</button>
        ))}
        <span className="w-px h-5 bg-border mx-1" />
        {SHIFT_FILTERS.map(f => (
          <button key={f} onClick={() => setShiftFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
              shiftFilter === f ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent text-muted-foreground border-border hover:border-foreground/30'
            }`}>{f}</button>
        ))}
      </div>

      {/* Bay cards bento grid */}
      <div className="px-6 pb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredBays.map((bay) => (
          <BayCard key={(bay as any).id} bay={bay} onClick={() => setSelectedBay(bay)} />
        ))}
        </div>
      </div>

      <MachineDrawer bay={selectedBay} open={!!selectedBay} onClose={() => setSelectedBay(null)} />
    </div>
  );
}
