import { StatusDot } from '@/components/StatusIndicator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { bays, currentUser, workcells } from '@/mocks/data';
import { Activity, BarChart3, ChevronLeft, ChevronRight, Factory, FileText, LineChart, MapPin, Settings } from 'lucide-react';
import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  if (location.pathname.startsWith('/kiosk')) return null;

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
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

      <nav className="flex-1 overflow-y-auto py-2 space-y-1">
        <SidebarLink to="/" icon={BarChart3} label="Global Overview" collapsed={collapsed} />

        {/* Workcells accordion */}
        <Collapsible defaultOpen>
          <SidebarLink to="/plants" icon={MapPin} label="Plants" collapsed={collapsed} />
          <CollapsibleTrigger asChild>
            <SidebarLink to="/workcells" icon={Factory} label="Workcells" collapsed={collapsed} />
          </CollapsibleTrigger>
          {!collapsed && (
            <CollapsibleContent className="pl-9 space-y-0.5">
              {workcells.map((wc) => (
                <NavLink
                  key={wc.id}
                  to={`/workcell/${wc.id}`}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors',
                      isActive && 'bg-sidebar-accent text-sidebar-accent-foreground font-medium border-l-2 border-sidebar-primary'
                    )
                  }
                >
                  <StatusDot status={wc.status} />
                  <span>{wc.name}</span>
                  <span className="ml-auto text-xs text-sidebar-foreground/60">
                    ({bays.filter((b) => b.workcellId === wc.id).map((b) => b.name.split(' ')[1]).filter((v, i, a) => a.indexOf(v) === i).join(', ')})
                  </span>
                </NavLink>
              ))}
            </CollapsibleContent>
          )}
        </Collapsible>


        <SidebarLink to="/reports" icon={LineChart} label="Reports" collapsed={collapsed} />
        <SidebarLink to="/documents" icon={FileText} label="Documents" collapsed={collapsed} />
      </nav>

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

function SidebarLink({
  to,
  icon: Icon,
  label,
  collapsed,
  isAccordion,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  collapsed: boolean;
  isAccordion?: boolean;
}) {
  const Component = isAccordion ? 'button' : NavLink;
  const props = isAccordion
    ? { className: cn('flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors', collapsed && 'justify-center') }
    : {
      to,
      className: ({ isActive }: { isActive: boolean }) =>
        cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors',
          isActive && 'bg-sidebar-accent text-sidebar-accent-foreground font-medium border-l-2 border-sidebar-primary',
          collapsed && 'justify-center'
        ),
    };

  return (
    // @ts-expect-error dynamic component
    <Component {...props}>
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span>{label}</span>}
    </Component>
  );
}
