import AppSwitcher from '@/components/layout/AppSwitcher';
import { StatusDot } from '@/components/StatusIndicator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useApp } from '@/context/AppContext';
import { useProductionSummary, useWorkcells } from '@/hooks/useMesData';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  Factory, Moon, PanelLeftClose, PanelLeftOpen,
  Sun
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';

export default function Sidebar() {
  const [workcellsOpen, setWorkcellsOpen] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const { activeApp, collapsed, setCollapsed } = useApp();

  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem('pulse-theme');
    return stored ? stored === 'dark' : true;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('pulse-theme', dark ? 'dark' : 'light');
  }, [dark]);

  const { data: apiWorkcells } = useWorkcells();
  const { data: apiProduction } = useProductionSummary();

  const activeWorkcells = useMemo(() => {
    if (!apiProduction) return apiWorkcells ?? [];
    const idsWithData = new Set(apiProduction.map(p => p.customer_id));
    return (apiWorkcells ?? []).filter(wc => idsWithData.has(wc.customer_id));
  }, [apiWorkcells, apiProduction]);

  if (location.pathname.startsWith('/kiosk')) return null;

  // Check if Workcells nav item is in the active app
  const hasWorkcells = activeApp.navItems.some(item => item.to === '/workcells');

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* ── App Switcher (includes collapse toggle) ── */}
      <AppSwitcher collapsed={collapsed} />

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto py-2 space-y-0.5">
        {activeApp.navItems.map((item) => {
          // Workcells gets special treatment — collapsible sub-items
          if (item.to === '/workcells' && !collapsed) {
            return (
              <Collapsible key={item.to} open={workcellsOpen} onOpenChange={setWorkcellsOpen}>
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
                <CollapsibleContent>
                  <div className="pl-3 pr-2 pb-1 pt-0.5 space-y-0.5">
                    {activeWorkcells.map((wc) => (
                      <NavLink
                        key={wc.customer_id}
                        to={`/workcell/${encodeURIComponent(wc.workcell_name)}`}
                        end
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
            );
          }

          return <SidebarLink key={item.to} to={item.to} icon={item.icon} label={item.label} collapsed={collapsed} />;
        })}
      </nav>

      {/* ── Footer ── */}
      <div className="border-t border-sidebar-border p-2 space-y-1">
        {/* Sidebar collapse toggle */}
        {collapsed ? (
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex">
                  <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="flex w-full items-center justify-center rounded-md px-3 py-2 text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                  >
                    <PanelLeftOpen className="h-4 w-4 shrink-0" />
                  </button>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs font-medium">Expand sidebar</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            <PanelLeftClose className="h-4 w-4 shrink-0" />
            <span>Collapse</span>
          </button>
        )}
        {collapsed ? (
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex">
                  <button
                    onClick={() => setDark(!dark)}
                    className="flex w-full items-center justify-center rounded-md px-3 py-2 text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                  >
                    {dark ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
                  </button>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs font-medium">
                {dark ? 'Light mode' : 'Dark mode'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <button
            onClick={() => setDark(!dark)}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            {dark ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
            <span>{dark ? 'Light mode' : 'Dark mode'}</span>
          </button>
        )}
        {/* <SidebarLink to="/settings" icon={Settings} label="Settings" collapsed={collapsed} /> */}
        {/* {!collapsed && (
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
        )} */}
      </div>
    </aside>
  );
}

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
      end
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors',
          isActive && 'text-sidebar-accent-foreground font-medium border-l-2 border-sidebar-primary',
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
