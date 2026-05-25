import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AppConfig, AppId } from '@/config/apps';
import { useApp } from '@/context/AppContext';
import { IS_SINGLE_APP } from '@/lib/buildContext';
import { useFeatureFlag } from '@/lib/featureFlags';
import { cn } from '@/lib/utils';
import { LayoutGrid } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

interface AppSwitcherProps {
  collapsed: boolean;
}

export default function AppSwitcher({ collapsed }: AppSwitcherProps) {
  const { activeApp, apps, setActiveApp } = useApp();
  const flag = useFeatureFlag('appSwitcher');
  // Single-app production builds never show the dropdown, regardless of flag.
  const switcherEnabled = flag && !IS_SINGLE_APP;
  const navigate = useNavigate();

  const ActiveIcon = activeApp.icon;

  // Group apps by category for the Google-style grid.
  const grouped = useMemo(() => {
    const map = new Map<string, AppConfig[]>();
    for (const a of apps) {
      const key = a.category ?? 'Other';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return Array.from(map.entries());
  }, [apps]);

  const handleSelectApp = (app: AppConfig) => {
    if (app.id === activeApp.id) return;
    setActiveApp(app.id as AppId);
    const first = app.navItems[0]?.to ?? '/';
    navigate(first);
  };

  // Header row: grid icon (trigger) + current app name + sub-label.
  // When collapsed: only the grid icon shows.
  const HeaderContent = (
    <div
      className={cn(
        'flex flex-1 items-center gap-2.5 px-3 py-3 outline-none',
        switcherEnabled && 'hover:bg-zinc-800/50 transition-colors cursor-pointer',
        collapsed && 'justify-center px-0 py-4',
      )}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-800/70 shadow-sm">
        <LayoutGrid className="h-4 w-4 text-zinc-200" />
      </div>
      {!collapsed && (
        <div className="flex flex-col items-start leading-none flex-1 min-w-0">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">IE Pulse</span>
          <span className="text-sm font-bold text-zinc-100 truncate mt-0.5 flex items-center gap-1.5">
            <ActiveIcon className={cn('h-3.5 w-3.5', activeApp.color)} />
            {activeApp.label}
          </span>
        </div>
      )}
    </div>
  );

  // Switcher disabled → render the header only (no dropdown).
  if (!switcherEnabled) {
    return (
      <div className="flex items-center border-b border-zinc-800 bg-zinc-950 outline-none text-zinc-100">
        {HeaderContent}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="flex items-center border-b border-zinc-800 bg-zinc-950 outline-none text-zinc-100">
          {HeaderContent}
        </div>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="w-[360px] rounded-xl bg-zinc-950 border border-zinc-800 shadow-2xl p-0 overflow-hidden"
        align={collapsed ? 'center' : 'start'}
        side={collapsed ? 'right' : 'bottom'}
        sideOffset={8}
      >
        <DropdownMenuLabel className="text-[11px] text-zinc-400 font-semibold px-4 pt-3 pb-2">
          Switch Module
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-zinc-800 mx-0 my-0" />

        <div className="max-h-[70vh] overflow-y-auto">
          {grouped.map(([category, list], idx) => (
            <div key={category} className={cn(idx > 0 && 'border-t border-zinc-800')}>
              <p className="px-4 pt-3 pb-2 text-[13px] font-bold text-zinc-100">{category}</p>
              <div className="grid grid-cols-3 gap-1 px-2 pb-3">
                {list.map(app => {
                  const AppIcon = app.icon;
                  const isActive = app.id === activeApp.id;
                  return (
                    <button
                      key={app.id}
                      onClick={() => handleSelectApp(app)}
                      className={cn(
                        'flex flex-col items-center gap-2 px-2 py-3 rounded-lg transition-colors text-center group',
                        isActive ? 'bg-zinc-800/80' : 'hover:bg-zinc-800/50',
                      )}
                      title={app.description}
                    >
                      <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full shadow-sm', app.iconBg)}>
                        <AppIcon className={cn('h-5 w-5', app.color)} />
                      </div>
                      <span className={cn(
                        'text-xs font-medium truncate w-full px-0.5',
                        isActive ? 'text-zinc-100' : 'text-zinc-300 group-hover:text-zinc-100',
                      )}>
                        {app.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
