import AppSwitcher from '@/components/layout/AppSwitcher';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useApp } from '@/context/AppContext';
import { shortName, useCurrentUser } from '@/hooks/useCurrentUser';
import { cn } from '@/lib/utils';
import { useAccessLevel } from '@/hooks/useAccessLevel';
import { Settings, Moon, PanelLeftClose, PanelLeftOpen,
 Sun
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { activeApp, collapsed, setCollapsed } = useApp();
  const { user } = useCurrentUser();
  const { isDeveloper } = useAccessLevel();

  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem('pulse-theme');
    return stored ? stored === 'dark' : false;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('pulse-theme', dark ? 'dark' : 'light');
  }, [dark]);

  if (location.pathname.startsWith('/kiosk')) return null;

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
          return <SidebarLink key={item.to} to={item.to} icon={item.icon} label={item.label} collapsed={collapsed} exact={item.exact !== false} />;
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
        {/* Access settings — sits directly above the theme toggle. Goes straight
            to Roles & Access rather than the Settings landing tab: it is the
            only section there with a backing store. Hidden for everyone but
            developers, who are the only ones the route will let in. */}
        {isDeveloper && (collapsed ? (
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex">
                  <button
                    onClick={() => navigate('/settings')}
                    className="flex w-full items-center justify-center rounded-md px-3 py-2 text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                  >
                    <Settings className="h-4 w-4 shrink-0" />
                  </button>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs font-medium">Roles &amp; Access</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <button
            onClick={() => navigate('/settings')}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            <Settings className="h-4 w-4 shrink-0" />
            <span>Roles &amp; Access</span>
          </button>
        ))}
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
        {user?.fullName && (() => {
          const display = shortName(user.fullName, 2);
          const initials = display.split(' ').map(w => w[0]?.toUpperCase() ?? '').join('');
          const avatar = (
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
          );
          if (collapsed) {
            return (
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex justify-center px-2 py-1.5">{avatar}</div>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="text-xs font-medium">
                    {display}
                    {user.jobTitle && <div className="text-[10px] opacity-70">{user.jobTitle}</div>}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          }
          return (
            <div className="flex items-center gap-2 px-2 py-1.5">
              {avatar}
              <div className="flex flex-col leading-none min-w-0">
                <span className="text-xs font-medium text-sidebar-accent-foreground truncate">{display}</span>
                {user.jobTitle && (
                  <span className="text-[10px] text-sidebar-foreground/60 truncate">{user.jobTitle}</span>
                )}
              </div>
            </div>
          );
        })()}
      </div>
    </aside>
  );
}

function SidebarLink({
  to, icon: Icon, label, collapsed, exact = true,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  collapsed: boolean;
  exact?: boolean;
}) {
  const location = useLocation();
  const navigate = useNavigate();

  const handleClick = (e: React.MouseEvent) => {
    if (location.pathname === to) {
      // Same exact route: re-trigger via navigate + scroll-to-top so the click feels responsive.
      e.preventDefault();
      navigate(to, { replace: true });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    // If we're at a sub-route (e.g. /report/wc/X) the default NavLink behavior already
    // navigates up to `to` — no special handling needed.
  };

  const link = (
    <NavLink
      to={to}
      end={exact}
      onClick={handleClick}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors',
          isActive && 'bg-sidebar-accent text-sidebar-accent-foreground font-medium',
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
