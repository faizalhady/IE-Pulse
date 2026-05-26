import { statusText } from '@/components/StatusIndicator';
import { bays } from '@/mocks/data';
import { assetUrl } from '@/lib/assetUrl';
import { cn } from '@/lib/utils';
import type { StatusLevel } from '@/types';
import { ArrowLeft, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const WORKCELL_LOGOS: Record<string, string> = {
  arista:   assetUrl('workcell logo/Arista.png'),
  keysight: assetUrl('workcell logo/keyisght.png'),
  aop:      assetUrl('workcell logo/aop.png'),
  micron:   assetUrl('workcell logo/micron.png'),
};

function KioskLogo({ workcellId }: { workcellId: string }) {
  const [err, setErr] = useState(false);
  const src = WORKCELL_LOGOS[workcellId];
  if (!src || err) return null;
  return (
    <div className="h-14 w-32 rounded-2xl overflow-hidden flex items-center justify-center flex-shrink-0" style={{ background: '#ffffff' }}>
      <img src={src} alt={workcellId} onError={() => setErr(true)} className="w-full h-full object-contain p-2" />
    </div>
  );
}

const STATUS_BAR: Record<StatusLevel, string> = {
  optimal:  'bg-emerald-500',
  warning:  'bg-amber-400',
  critical: 'bg-red-500',
  idle:     'bg-zinc-600',
};

const STATUS_ROW_BG_DARK: Record<StatusLevel, string> = {
  optimal:  'border-emerald-500/30 bg-emerald-500/10',
  warning:  'border-amber-400/30  bg-amber-400/10',
  critical: 'border-red-500/30    bg-red-500/10',
  idle:     'border-white/10      bg-white/5',
};

const STATUS_ROW_BG_LIGHT: Record<StatusLevel, string> = {
  optimal:  'border-emerald-500/40 bg-emerald-50',
  warning:  'border-amber-400/40  bg-amber-50',
  critical: 'border-red-500/40    bg-red-50',
  idle:     'border-gray-200      bg-gray-50',
};

export default function KioskMode() {
  const { bayId } = useParams<{ bayId: string }>();
  const navigate = useNavigate();
  const [secondsAgo, setSecondsAgo] = useState(0);

  // ── Dark/light toggle — independent of app theme ──
  const [dark, setDark] = useState(true);

  // Find bay from mock data. bayId can be:
  //   - old mock format "bay-211-top"
  //   - compound API format "WORKCELL__BAY NAME" (from new WorkcellView)
  const bay = (bays as any[]).find(b => b.id === bayId)
    ?? (bays as any[])[0];   // fallback to first bay so kiosk never shows blank

  useEffect(() => {
    setSecondsAgo(0);
    const interval = setInterval(() => setSecondsAgo(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, [bay]);

  const machines = bay?.machines ?? [];
  const activeCount = machines.filter((m: any) => m.status !== 'idle').length;
  const totalWip    = machines.reduce((s: number, m: any) => s + m.wipCount, 0);

  // Theme-aware colour helpers
  const bg        = dark ? 'bg-[#0a0a0a]'      : 'bg-gray-50';
  const text      = dark ? 'text-white'          : 'text-gray-900';
  const border    = dark ? 'border-white/10'     : 'border-gray-200';
  const muted     = dark ? 'text-zinc-400'       : 'text-gray-500';
  const divider   = dark ? 'bg-white/10'         : 'bg-gray-200';
  const rowBg     = dark ? STATUS_ROW_BG_DARK    : STATUS_ROW_BG_LIGHT;
  const heroMuted = dark ? 'text-zinc-500'       : 'text-gray-400';
  const trackBg   = dark ? 'bg-white/10'         : 'bg-gray-200';
  const footerTxt = dark ? 'text-zinc-600'       : 'text-gray-400';

  return (
    <div className={cn('flex h-screen flex-col overflow-hidden transition-colors duration-200', bg, text)}>

      {/* Top bar */}
      <div className={cn('flex items-center justify-between px-8 py-4 border-b', border)}>
        <div className="flex items-center gap-5">
          <button onClick={() => navigate(-1)} className={cn('transition-colors', muted, 'hover:' + (dark ? 'text-white' : 'text-gray-900'))}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <KioskLogo workcellId={bay?.workcellId ?? ''} />
          <div>
            <span className={cn('font-bold text-xl tracking-tight', text)}>{bay?.name}</span>
            <span className={cn('text-sm ml-3', muted)}>{bay?.model}</span>
          </div>
        </div>

        <div className="flex items-center gap-6 text-sm font-mono">
          <span className={muted}>Active <span className={cn('font-semibold', text)}>{activeCount}/{machines.length}</span></span>
          <span className={muted}>WIP <span className={cn('font-semibold', text)}>{totalWip}</span></span>
          <span className={muted}>Pending <span className={cn('font-semibold', bay?.pendingWip > 40 ? 'text-red-400' : text)}>{bay?.pendingWip}</span></span>
          <span className={muted}>Plan <span className={cn('font-semibold', text)}>{bay?.plan}</span></span>
          <span className={muted}>CUMM <span className={cn('font-semibold', text)}>{bay?.cumm}</span></span>
          <span className={cn('flex items-center gap-1.5', muted)}>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            LIVE · <span className={heroMuted}>{secondsAgo}s ago</span>
          </span>

          {/* Dark / light toggle */}
          <button
            onClick={() => setDark(d => !d)}
            className={cn(
              'flex items-center justify-center w-8 h-8 rounded-lg border transition-colors',
              dark ? 'border-white/20 hover:bg-white/10' : 'border-gray-300 hover:bg-gray-100'
            )}
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {dark
              ? <Sun  className="h-4 w-4 text-zinc-400" />
              : <Moon className="h-4 w-4 text-gray-500" />
            }
          </button>
        </div>
      </div>

      {/* Hero productivity */}
      <div className={cn('flex items-center justify-center gap-16 px-8 py-6 border-b', border)}>
        <div className="text-center">
          <p className={cn('text-xs uppercase tracking-widest mb-1', heroMuted)}>Productivity</p>
          <p className={cn('text-8xl font-mono font-black tracking-tight', statusText(bay?.status ?? 'idle'))}>
            {bay?.productivity ?? 0}%
          </p>
        </div>

        <div className={cn('h-20 w-px', divider)} />

        <div className="grid grid-cols-3 gap-8">
          {([
            { label: 'PLAN',  value: bay?.plan  ?? 0, color: text },
            { label: 'CUMM',  value: bay?.cumm  ?? 0, color: text },
            { label: 'DELTA', value: bay?.delta ?? 0, color: (bay?.delta ?? 0) < 0 ? 'text-red-400' : 'text-emerald-400' },
          ] as { label: string; value: number; color: string }[]).map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <p className={cn('text-xs uppercase tracking-widest mb-1', heroMuted)}>{label}</p>
              <p className={cn('text-4xl font-mono font-bold', color)}>
                {label === 'DELTA' ? (value > 0 ? `+${value}` : value) : value}
              </p>
            </div>
          ))}
        </div>

        <div className={cn('h-20 w-px', divider)} />

        <div className="w-48">
          <div className={cn('flex justify-between text-xs mb-2', heroMuted)}><span>0%</span><span>100%</span></div>
          <div className={cn('h-3 rounded-full', trackBg)}>
            <div
              className={cn('h-full rounded-full transition-all duration-1000', STATUS_BAR[bay?.status ?? 'idle'])}
              style={{ width: `${bay?.productivity ?? 0}%` }}
            />
          </div>
          <p className={cn('text-xs mt-2 text-center', heroMuted)}>
            {bay?.status === 'optimal' ? '✓ On target' : bay?.status === 'warning' ? '⚠ Below target' : '✗ Critical'}
          </p>
        </div>
      </div>

      {/* Machine rows */}
      <div className="flex-1 overflow-y-auto px-8 py-4">
        <p className={cn('text-xs uppercase tracking-widest mb-3', heroMuted)}>Machine Status</p>
        <div className="grid grid-cols-2 gap-2">
          {machines.map((m: any) => (
            <div
              key={m.id}
              className={cn(
                'flex items-center gap-4 px-4 py-3 rounded-lg border',
                rowBg[m.status as StatusLevel],
                m.status === 'critical' && 'animate-pulse'
              )}
            >
              <span className={cn(
                'w-2.5 h-2.5 rounded-full flex-shrink-0',
                m.status === 'optimal'  ? 'bg-emerald-400' :
                m.status === 'warning'  ? 'bg-amber-400'   :
                m.status === 'critical' ? 'bg-red-400'      : 'bg-zinc-600'
              )} />
              <span className={cn('font-semibold text-sm flex-1 truncate', text)}>{m.name}</span>
              <div className={cn('w-20 h-1.5 rounded-full flex-shrink-0', trackBg)}>
                <div className={cn('h-full rounded-full', STATUS_BAR[m.status as StatusLevel])} style={{ width: `${Math.min(m.uph, 100)}%` }} />
              </div>
              <span className={cn('text-lg font-mono font-bold w-14 text-right flex-shrink-0', statusText(m.status))}>{m.uph}%</span>
              <span className={cn('text-xs font-mono w-16 text-right flex-shrink-0', muted)}>WIP {m.wipCount}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className={cn('px-8 py-3 border-t flex items-center justify-between text-xs font-mono', border, footerTxt)}>
        <span>PULSE · Production Intelligence</span>
        <span>{new Date().toLocaleString('en-GB')}</span>
      </div>
    </div>
  );
}
