import { useApp } from '@/context/AppContext';
import { AppConfig, AppId } from '@/config/apps';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface AppSwitcherProps {
  collapsed: boolean;
}

export default function AppSwitcher({ collapsed }: AppSwitcherProps) {
  const { activeApp, apps, setActiveApp } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const Icon = activeApp.icon;

  const handleSelectApp = (app: AppConfig) => {
    setActiveApp(app.id as AppId);
    navigate(app.navItems[0].to);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center border-b border-sidebar-border">
        <button
          onClick={() => setOpen(o => !o)}
          className={cn(
            'flex flex-1 items-center gap-2.5 px-3 py-3',
            'hover:bg-sidebar-accent transition-colors',
            collapsed && 'justify-center px-0'
          )}
        >
          <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md', activeApp.iconBg)}>
            <Icon className={cn('h-4 w-4', activeApp.color)} />
          </div>
          {!collapsed && (
            <>
              <div className="flex flex-col items-start leading-none flex-1 min-w-0">
                <span className="text-sm font-semibold text-sidebar-accent-foreground truncate">
                  {activeApp.label}
                </span>
                <span className="text-[10px] text-sidebar-foreground/50 truncate">
                  {activeApp.description}
                </span>
              </div>
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/40" />
            </>
          )}
        </button>
      </div>

      {open && (
        <div className={cn(
          'absolute z-50 top-full mt-1 w-56 rounded-lg border border-sidebar-border',
          'bg-sidebar shadow-lg py-1',
          collapsed ? 'left-full ml-2 top-0 mt-0' : 'left-2 right-2 w-auto'
        )}>
          {apps.map((app: AppConfig) => {
            const AppIcon = app.icon;
            const isActive = app.id === activeApp.id;
            return (
              <button
                key={app.id}
                onClick={() => handleSelectApp(app)}
                className={cn(
                  'flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors',
                  'hover:bg-sidebar-accent',
                  isActive && 'bg-sidebar-accent/60'
                )}
              >
                <div className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-md', app.iconBg)}>
                  <AppIcon className={cn('h-3.5 w-3.5', app.color)} />
                </div>
                <div className="flex flex-col items-start leading-none flex-1 min-w-0">
                  <span className={cn('font-medium text-sidebar-accent-foreground', isActive && 'font-semibold')}>
                    {app.label}
                  </span>
                  <span className="text-[10px] text-sidebar-foreground/50 truncate">{app.description}</span>
                </div>
                {isActive && <Check className="h-3.5 w-3.5 text-sidebar-primary shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
