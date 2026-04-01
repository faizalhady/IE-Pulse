import { StatusDot } from '@/components/StatusIndicator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useProductionSummary, useWorkcells } from '@/hooks/useMesData';
import { cn } from '@/lib/utils';
import { currentUser } from '@/mocks/data';
import {
  Activity, BarChart3, ChevronDown, ChevronLeft,
  ChevronRight, Factory, FileText, LineChart, MapPin, Settings,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [workcellsOpen, setWorkcellsOpen] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  const { data: apiWorkcells } = useWorkcells();
  const { data: apiProduction } = useProductionSummary();

  // Only show workcells that have at least one production row (same filter as WorkcellsTable)
  const activeWorkcells = useMemo(() => {
    if (!apiProduction) return apiWorkcells ?? [];
    const idsWithData = new Set(apiProduction.map(p => p.customer_id));
    return (apiWorkcells ?? []).filter(wc => idsWithData.has(wc.customer_id));
  }, [apiWorkcells, apiProduction]);

  if (location.pathname.startsWith('/kiosk')) return null;

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* ── Logo ── */}
      <div className="flex h-14 items-center justify-between px-3 border-b border-sidebar-border">
        {!collapsed && (
          <span className="flex items-center gap-2 text-sidebar-primary-foreground font-bold text-lg tracking-tight">
            <Activity className="h-5 w-5 text-sidebar-primary" />
            IE PULSE
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto py-2 space-y-0.5">
        <SidebarLink to="/" icon={BarChart3} label="Overview" collapsed={collapsed} />
        <SidebarLink to="/plants" icon={MapPin} label="Plants" collapsed={collapsed} />

        {/* ── Workcells ──
             Collapsed → plain SidebarLink (no Collapsible, no wrappers)
             Expanded  → Collapsible trigger + sub-items
        */}
        {collapsed
          ? <SidebarLink to="/workcells" icon={Factory} label="Workcells" collapsed={true} />
          : (
            <Collapsible open={workcellsOpen} onOpenChange={setWorkcellsOpen}>
              {/* Trigger row */}
              <div className="flex items-center rounded-md hover:bg-sidebar-accent transition-colors">
                <button
                  onClick={() => navigate('/workcells')}
                  className="flex flex-1 items-center gap-3 px-3 py-2 text-sm text-sidebar-foreground"
                >
                  <Factory className="h-4 w-4 shrink-0" />
                  <span>Workcells</span>
                </button>
                <CollapsibleTrigger asChild>
                  <button className="pr-3 py-2 text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors">
                    <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-200', workcellsOpen && 'rotate-180')} />
                  </button>
                </CollapsibleTrigger>
              </div>
              {/* Sub-items */}
              <CollapsibleContent>
                <div className="pl-3 pr-2 pb-1 pt-0.5 space-y-0.5">
                  {activeWorkcells.map((wc) => (
                    <NavLink
                      key={wc.customer_id}
                      to={`/workcell/${encodeURIComponent(wc.workcell_name)}`}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-sidebar-foreground hover:bg-sidebar-accent transition-colors',
                          isActive && 'bg-sidebar-accent text-sidebar-accent-foreground font-medium border-l-2 border-sidebar-primary'
                        )
                      }
                    >
                      <StatusDot status={wc.active ? 'optimal' : 'idle'} />
                      <span className="truncate flex-1">{wc.workcell_name}</span>
                    </NavLink>
                  ))}
                  {!apiProduction && !apiWorkcells && (
                    <div className="space-y-1 px-2 py-1">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-6 rounded bg-sidebar-accent/40 animate-pulse" />
                      ))}
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )
        }

        <SidebarLink to="/reports" icon={LineChart} label="Reports" collapsed={collapsed} />
        <SidebarLink to="/documents" icon={FileText} label="Documents" collapsed={collapsed} />
      </nav>

      {/* ── Footer ── */}
      <div className="border-t border-sidebar-border p-2 space-y-1">
        <SidebarLink to="/settings" icon={Settings} label="Settings" collapsed={collapsed} />
        {!collapsed && (
          <div className="flex items-center gap-2 px-2 py-1.5">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">
                {currentUser.name.split(' ').filter(n => /^[a-zA-Z]/.test(n)).slice(0, 2).map(n => n[0].toUpperCase()).join('')}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col leading-none">
              <span className="text-xs font-medium text-sidebar-accent-foreground">{currentUser.name}</span>
              <span className="text-[10px] text-sidebar-foreground/60 capitalize">{currentUser.role}</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

// ─── Reusable nav link with collapsed tooltip ─────────────────────────────────
function SidebarLink({
  to, icon: Icon, label, collapsed,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  collapsed: boolean;
}) {
  const link = (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors',
          isActive && ' text-sidebar-accent-foreground font-medium border-l-2 border-sidebar-primary',
          collapsed && 'justify-center px-5'
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span>{label}</span>}
    </NavLink>
  );

  if (!collapsed) return link;

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex">{link}</div>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs font-medium">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
