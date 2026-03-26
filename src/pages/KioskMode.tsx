import { statusText } from '@/components/StatusIndicator';
import { useSSE } from '@/hooks/useSSE';
import { cn } from '@/lib/utils';
import type { StatusLevel } from '@/types';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const WORKCELL_LOGOS: Record<string, string> = {
  arista: '/workcell logo/Arista.png',
  keysight: '/workcell logo/keyisght.png',
  aop: '/workcell logo/aop.png',
  micron: '/workcell logo/micron.png',
};

function KioskLogo({ workcellId }: { workcellId: string }) {
  const [err, setErr] = useState(false);
  const src = WORKCELL_LOGOS[workcellId];
  if (!src || err) return null;
  return (
    <div
      className="h-14 w-32 rounded-2xl overflow-hidden flex items-center justify-center flex-shrink-0"
      style={{ background: '#ffffff' }}
    >
      <img src={src} alt={workcellId} onError={() => setErr(true)} className="w-full h-full object-contain p-2" />
    </div>
  );
}

const STATUS_BAR: Record<StatusLevel, string> = {
  optimal: 'bg-status-optimal',
  warning: 'bg-status-warning',
  critical: 'bg-status-critical',
  idle: 'bg-muted',
};

const STATUS_ROW_BG: Record<StatusLevel, string> = {
  optimal: 'border-status-optimal/30 bg-status-optimal/10',
  warning: 'border-status-warning/30 bg-status-warning/10',
  critical: 'border-status-critical/30 bg-status-critical/10',
  idle: 'border-border bg-muted/30',
};

export default function KioskMode() {
  const { bayId } = useParams<{ bayId: string }>();
  const navigate = useNavigate();
  const { data: bayList = [] } = useSSE(bayId);
  const bay = bayList[0];
  const [secondsAgo, setSecondsAgo] = useState(0);

  useEffect(() => {
    setSecondsAgo(0);
    const interval = setInterval(() => setSecondsAgo(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, [bay]);

  if (!bay) return (
    <div className="flex h-screen items-center justify-center bg-[#0a0a0a] text-zinc-500 text-xl font-mono">
      Connecting...
    </div>
  );

  const activeCount = bay.machines.filter(m => m.status !== 'idle').length;
  const totalWip = bay.machines.reduce((s, m) => s + m.wipCount, 0);

  return (
    <div className="flex h-screen flex-col bg-[#0a0a0a] text-white overflow-hidden">

      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-white/10">
        <div className="flex items-center gap-5">
          <button onClick={() => navigate(-1)} className="text-zinc-500 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <KioskLogo workcellId={bay.workcellId} />
          <div>
            <span className="text-white font-bold text-xl tracking-tight">{bay.name}</span>
            <span className="text-zinc-500 text-sm ml-3">{bay.model}</span>
          </div>
        </div>
        <div className="flex items-center gap-6 text-sm font-mono">
          <span className="text-zinc-400">Active <span className="text-white font-semibold">{activeCount}/{bay.machines.length}</span></span>
          <span className="text-zinc-400">WIP <span className="text-white font-semibold">{totalWip}</span></span>
          <span className="text-zinc-400">Pending <span className={cn('font-semibold', bay.pendingWip > 40 ? 'text-red-400' : 'text-white')}>{bay.pendingWip}</span></span>
          <span className="text-zinc-400">Plan <span className="text-white font-semibold">{bay.plan}</span></span>
          <span className="text-zinc-400">CUMM <span className="text-white font-semibold">{bay.cumm}</span></span>
          <span className="flex items-center gap-1.5 text-zinc-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-status" />
            LIVE · <span className="text-zinc-500">{secondsAgo}s ago</span>
          </span>
        </div>
      </div>

      {/* Hero productivity */}
      <div className="flex items-center justify-center gap-16 px-8 py-6 border-b border-white/10">
        <div className="flex items-center gap-6">
          {/* {WORKCELL_LOGOS[bay.workcellId] && (
            <div
              className="h-20 w-48 rounded-2xl overflow-hidden flex items-center justify-center flex-shrink-0"
              style={{ background: '#ffffff' }}
            >
              <img
                src={WORKCELL_LOGOS[bay.workcellId]}
                alt={bay.workcellId}
                className="w-full h-full object-contain p-3"
              />
            </div>
          )} */}
          <div className="text-center">
            <p className="text-zinc-500 text-xs uppercase tracking-widest mb-1">Productivity</p>
            <p className={cn('text-8xl font-mono font-black tracking-tight', statusText(bay.status))}>
              {bay.productivity}%
            </p>
          </div>
        </div>
        <div className="h-20 w-px bg-white/10" />
        <div className="grid grid-cols-3 gap-8">
          {([
            { label: 'PLAN', value: bay.plan, color: 'text-zinc-300' },
            { label: 'CUMM', value: bay.cumm, color: 'text-zinc-300' },
            { label: 'DELTA', value: bay.delta, color: bay.delta < 0 ? 'text-red-400' : 'text-emerald-400' },
          ] as { label: string; value: number; color: string }[]).map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <p className="text-zinc-600 text-xs uppercase tracking-widest mb-1">{label}</p>
              <p className={cn('text-4xl font-mono font-bold', color)}>
                {label === 'DELTA' ? (value > 0 ? `+${value}` : value) : value}
              </p>
            </div>
          ))}
        </div>
        <div className="h-20 w-px bg-white/10" />
        <div className="w-48">
          <div className="flex justify-between text-xs text-zinc-500 mb-2"><span>0%</span><span>100%</span></div>
          <div className="h-3 rounded-full bg-white/10">
            <div className={cn('h-full rounded-full transition-all duration-1000', STATUS_BAR[bay.status])} style={{ width: `${bay.productivity}%` }} />
          </div>
          <p className="text-zinc-500 text-xs mt-2 text-center">
            {bay.status === 'optimal' ? '✓ On target' : bay.status === 'warning' ? '⚠ Below target' : '✗ Critical'}
          </p>
        </div>
      </div>

      {/* Machine rows */}
      <div className="flex-1 overflow-y-auto px-8 py-4">
        <p className="text-zinc-600 text-xs uppercase tracking-widest mb-3">Machine Status</p>
        <div className="grid grid-cols-2 gap-2">
          {bay.machines.map((m) => (
            <div
              key={m.id}
              className={cn(
                'flex items-center gap-4 px-4 py-3 rounded-lg border',
                STATUS_ROW_BG[m.status],
                m.status === 'critical' && 'animate-pulse-status'
              )}
            >
              <span className={cn(
                'w-2.5 h-2.5 rounded-full flex-shrink-0',
                m.status === 'optimal' ? 'bg-emerald-400' :
                  m.status === 'warning' ? 'bg-amber-400' :
                    m.status === 'critical' ? 'bg-red-400' : 'bg-zinc-600'
              )} />
              <span className="font-semibold text-sm text-white flex-1 truncate">{m.name}</span>
              <div className="w-20 h-1.5 rounded-full bg-white/10 flex-shrink-0">
                <div className={cn('h-full rounded-full', STATUS_BAR[m.status])} style={{ width: `${Math.min(m.uph, 100)}%` }} />
              </div>
              <span className={cn('text-lg font-mono font-bold w-14 text-right flex-shrink-0', statusText(m.status))}>{m.uph}%</span>
              <span className="text-xs font-mono w-16 text-right flex-shrink-0 text-zinc-400">WIP {m.wipCount}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-8 py-3 border-t border-white/10 flex items-center justify-between text-xs font-mono text-zinc-600">
        <span>PULSE · Production Intelligence</span>
        <span>{new Date().toLocaleString('en-GB')}</span>
      </div>

    </div>
  );
}
