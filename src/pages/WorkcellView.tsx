import { useParams, useNavigate, Link } from 'react-router-dom';
import { useBays } from '@/hooks/useBay';
import { workcells } from '@/mocks/data';
import BayCard from '@/components/dashboard/BayCard';
import MachineDrawer from '@/components/dashboard/MachineDrawer';
import { statusText, StatusDot } from '@/components/StatusIndicator';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { Bay } from '@/types';

const WORKCELL_LOGOS: Record<string, string> = {
  arista:   '/workcell logo/Arista.png',
  keysight: '/workcell logo/keyisght.png',
  aop:      '/workcell logo/aop.png',
  micron:   '/workcell logo/micron.png',
};

function WorkcellLogo({ id, name, fallback }: { id: string; name: string; fallback: React.ReactNode }) {
  const [err, setErr] = useState(false);
  const src = WORKCELL_LOGOS[id];
  if (src && !err) {
    return (
      <div className="w-24 h-12 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center ring-1 ring-border" style={{ background: '#ffffff' }}>
        <img src={src} alt={name} onError={() => setErr(true)} className="w-full h-full object-contain p-1.5" />
      </div>
    );
  }
  return <>{fallback}</>;
}

export default function WorkcellView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: allBays = [] } = useBays();
  const [selectedBay, setSelectedBay] = useState<Bay | null>(null);
  const [view, setView] = useState<'rows' | 'cards'>('rows');

  const workcell = workcells.find(w => w.id === id);
  const filtered = allBays.filter(b => b.workcellId === id);

  const avgProductivity = filtered.length
    ? (filtered.reduce((s, b) => s + b.productivity, 0) / filtered.length).toFixed(1)
    : '0';
  const totalWip = filtered.reduce((s, b) => s + b.overallWip, 0);
  const totalDowntime = filtered.reduce((s, b) => s + b.downtimeLog.reduce((ds, d) => ds + parseInt(d.duration), 0), 0);
  const activeCount = filtered.filter(b => b.status !== 'idle').length;

  if (!workcell) return <p className="text-muted-foreground">Workcell not found.</p>;

  return (
    <div className="space-y-0">

      {/* Sticky header — mirrors BayDetail structure exactly */}
      <div className="sticky top-0 z-20 bg-background border-b border-border pb-0 px-6">

        {/* Top row: breadcrumb + view toggle — px-1 py-2 like BayDetail */}
        <div className="flex items-center justify-between px-1 py-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <button onClick={() => navigate(-1)} className="flex items-center gap-1 hover:text-foreground transition-colors mr-1">
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
            <span className="text-border">|</span>
            <Link to="/workcells" className="hover:text-foreground transition-colors">Workcells</Link>
            <span>/</span>
            <span className="text-foreground font-medium">{workcell.name}</span>
          </div>
          {/* View toggle */}
          <div className="flex items-center gap-1 border border-border rounded-lg p-1">
            <button
              onClick={() => setView('rows')}
              className={cn('px-3 py-1.5 text-xs rounded-md transition-colors font-medium',
                view === 'rows' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >List</button>
            <button
              onClick={() => setView('cards')}
              className={cn('px-3 py-1.5 text-xs rounded-md transition-colors font-medium',
                view === 'cards' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >Cards</button>
          </div>
        </div>

        {/* Title row — px-1 pb-2 like BayDetail */}
        <div className="flex items-center gap-3 px-1 pb-2">
          <WorkcellLogo
            id={id ?? ''}
            name={workcell.name}
            fallback={<StatusDot status={workcell.status} />}
          />
          <h1 className="text-xl font-semibold text-foreground">{workcell.name}</h1>
          <span className={cn('text-2xl font-mono font-bold', statusText(workcell.status))}>
            {avgProductivity}%
          </span>
          <span className="text-xs text-muted-foreground">{filtered.length} bays · DR4 400G</span>
        </div>

        {/* Stats row — px-1 pb-3 border-b like BayDetail */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-1 pb-3 text-xs font-mono border-b border-border">
          <span className="text-muted-foreground">Active: <span className="text-foreground font-semibold">{activeCount}/{filtered.length}</span></span>
          <span className="text-muted-foreground">Total WIP: <span className="text-foreground font-semibold">{totalWip}</span></span>
          <span className="text-muted-foreground">Downtime: <span className="text-foreground font-semibold">{totalDowntime}m</span></span>
        </div>
      </div>

      {/* Content */}
      <div className="pt-4 px-6 pb-6">
        {view === 'cards' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(bay => (
              <BayCard key={bay.id} bay={bay} onClick={() => setSelectedBay(bay)} />
            ))}
          </div>
        ) : (
          /* Fotmob row-list style */
          <div className="rounded-xl border border-border overflow-hidden">
            {/* Header row */}
            <div className="grid bg-muted/50 border-b border-border text-xs text-muted-foreground font-medium uppercase tracking-wider"
              style={{ gridTemplateColumns: '1fr 5rem 5rem 7rem 8rem 5rem 5rem 5rem' }}>
              <div className="px-4 py-3">Bay</div>
              <div className="px-3 py-3 text-center">Plant</div>
              <div className="px-3 py-3 text-center">Area</div>
              <div className="px-3 py-3 text-center">Productivity</div>
              <div className="px-3 py-3 text-left">Plan vs Actual</div>
              <div className="px-3 py-3 text-center">WIP</div>
              <div className="px-3 py-3 text-center">Delta</div>
              <div className="px-3 py-3 text-center">Status</div>
            </div>
            {filtered.map(bay => {
              const pct = bay.plan > 0 ? Math.min((bay.cumm / bay.plan) * 100, 100) : 0;
              const barColor = bay.status === 'optimal' ? 'bg-status-optimal' : bay.status === 'warning' ? 'bg-status-warning' : bay.status === 'critical' ? 'bg-status-critical' : 'bg-muted';
              const statusLabel = { optimal: 'Active', warning: 'Warning', critical: 'Critical', idle: 'Idle' }[bay.status];
              const statusBadge = {
                optimal: 'bg-status-optimal/15 text-status-optimal border border-status-optimal/30',
                warning: 'bg-status-warning/15 text-status-warning border border-status-warning/30',
                critical: 'bg-status-critical/15 text-status-critical border border-status-critical/30',
                idle: 'bg-muted text-muted-foreground border border-border',
              }[bay.status];
              return (
                <button
                  key={bay.id}
                  onClick={() => navigate(`/bay/${bay.id}`)}
                  className="w-full grid items-center text-sm border-b border-border last:border-0 hover:bg-muted/40 transition-colors text-left group"
                  style={{ gridTemplateColumns: '1fr 5rem 5rem 7rem 8rem 5rem 5rem 5rem' }}
                >
                  {/* Bay name */}
                  <div className="px-4 py-3.5 flex items-center gap-3">
                    <StatusDot status={bay.status} />
                    <div>
                      <p className="font-semibold text-foreground group-hover:text-primary transition-colors">{bay.name}</p>
                      <p className="text-xs text-muted-foreground">{bay.model}</p>
                    </div>
                  </div>
                  {/* Plant */}
                  <div className="px-3 py-3.5 text-center">
                    <span className="text-xs font-medium text-foreground">{bay.plant}</span>
                  </div>
                  {/* Area */}
                  <div className="px-3 py-3.5 text-center">
                    <span className="text-xs font-mono font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{bay.area}</span>
                  </div>
                  {/* Productivity */}
                  <div className="px-3 py-3.5 text-center">
                    <span className={cn('text-xl font-mono font-bold', statusText(bay.status))}>{bay.productivity}%</span>
                  </div>
                  {/* Plan vs actual bar */}
                  <div className="px-3 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono text-muted-foreground w-5 text-right">{bay.cumm}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className={cn('h-full rounded-full', barColor)} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-mono text-muted-foreground w-5">{bay.plan}</span>
                    </div>
                  </div>
                  {/* WIP */}
                  <div className="px-3 py-3.5 text-center">
                    <span className={cn('font-mono font-semibold', bay.overallWip > 300 ? 'text-status-warning' : 'text-foreground')}>{bay.overallWip}</span>
                  </div>
                  {/* Delta */}
                  <div className="px-3 py-3.5 text-center">
                    <span className={cn('font-mono font-semibold text-sm', bay.delta < 0 ? 'text-status-critical' : 'text-status-optimal')}>
                      {bay.delta > 0 ? `+${bay.delta}↑` : `${bay.delta}↓`}
                    </span>
                  </div>
                  {/* Status badge */}
                  <div className="px-3 py-3.5 flex justify-center">
                    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', statusBadge)}>
                      {statusLabel}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <MachineDrawer bay={selectedBay} open={!!selectedBay} onClose={() => setSelectedBay(null)} />
    </div>
  );
}
