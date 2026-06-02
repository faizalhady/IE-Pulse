/**
 * IPKWorkcellHeader.tsx
 * ──────────────────────
 * Shared sticky header for every workcell-scoped IPK page (/ipk/:workcell/*).
 *
 * Profile-style: workcell logo + name + division always at the top, with a
 * persistent tab bar (Dashboard · Simulate · Results · History · Matrix ·
 * Config) so you can hop between a workcell's pages in one click. Lives inside
 * the IPK module — no shared-Sidebar changes.
 *
 * `actions` renders page-specific buttons on the right (Export, Save, etc.).
 * `subtitle` overrides the default "division · last run" meta line.
 */

import { cn } from '@/lib/utils';
import { getWorkcellLogo } from '@/lib/ole/oleConstants';
import { useIPKWorkcells } from '@/hooks/ipk/useIPKWorkcells';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface Tab { key: string; label: string; path: (wc: string) => string }

const TABS: Tab[] = [
  { key: 'dashboard', label: 'Dashboard', path: wc => `/ipk/${wc}` },
  { key: 'simulate',  label: 'Simulate',  path: wc => `/ipk/${wc}/simulate` },
  { key: 'results',   label: 'Results',   path: wc => `/ipk/${wc}/results/latest` },
  { key: 'history',   label: 'History',   path: wc => `/ipk/${wc}/history` },
  { key: 'matrix',    label: 'Matrix',    path: wc => `/ipk/${wc}/matrix` },
  { key: 'config',    label: 'Config',    path: wc => `/ipk/${wc}/config` },
];

/** Which tab is active, derived from the path tail after /ipk/:workcell. */
function activeTab(pathname: string, workcellId: string): string {
  const base = `/ipk/${encodeURIComponent(workcellId)}`;
  const rest = pathname.startsWith(base) ? pathname.slice(base.length) : '';
  if (rest === '' || rest === '/') return 'dashboard';
  const seg = rest.split('/')[1];
  return TABS.some(t => t.key === seg) ? seg : 'dashboard';
}

export default function IPKWorkcellHeader({
  workcellId, subtitle, actions,
}: {
  workcellId: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { data: workcells = [] } = useIPKWorkcells();

  const wc = workcells.find(w => w.id === workcellId);
  const name = wc?.name ?? workcellId;
  const logo = getWorkcellLogo(name);
  const active = activeTab(pathname, workcellId);

  const defaultSubtitle = wc
    ? `${wc.division} · ${wc.lastRun ? `Last run ${wc.lastRun} · ${wc.period}` : 'Never run'}`
    : '—';

  return (
    <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
      {/* ── Back link ── */}
      <div className="px-6 pt-2.5">
        <button
          onClick={() => navigate('/ipk')}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3 w-3" /> All workcells
        </button>
      </div>

      {/* ── Profile row ── */}
      <div className="px-6 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {logo ? (
            <div className="w-14 h-10 rounded-md border border-border bg-white flex items-center justify-center overflow-hidden flex-shrink-0">
              <img src={logo} alt={name} className="w-full h-full object-contain p-1" />
            </div>
          ) : (
            <div className="w-14 h-10 rounded-md border border-border bg-muted flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-muted-foreground">{name.slice(0, 3).toUpperCase()}</span>
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-base font-bold text-foreground truncate">{name}</h1>
            <p className="text-[10px] text-muted-foreground truncate">{subtitle ?? defaultSubtitle}</p>
          </div>
        </div>

        {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
      </div>

      {/* ── Tab bar ── */}
      <div className="flex items-center gap-4 px-6 overflow-x-auto">
        {TABS.map(t => {
          const isActive = t.key === active;
          return (
            <button
              key={t.key}
              onClick={() => navigate(t.path(encodeURIComponent(workcellId)))}
              className={cn(
                '-mb-px whitespace-nowrap border-b-2 px-1 py-2.5 text-xs font-medium transition-colors',
                isActive ? 'border-emerald-500 text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
