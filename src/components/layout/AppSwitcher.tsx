import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AppConfig, AppId } from '@/config/apps';
import { useApp } from '@/context/AppContext';
import { IS_SINGLE_APP } from '@/lib/buildContext';
import { useFeatureFlag } from '@/lib/featureFlags';
import { cn } from '@/lib/utils';
import { AlertTriangle, Grip } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

/** Modules that are live/in-production. Everything else gets a "not live" warning. */
const LIVE_APPS = new Set<AppId>(['ole', 'cycle-time']);

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

  // Header row: active app icon + label + 9-dot grid trigger (replaces the
  // previous up/down chevron). Collapsed: only the app icon shows.
  const HeaderContent = (
    <div
      className={cn(
        'flex flex-1 items-center gap-2.5 px-3 py-3 outline-none',
        switcherEnabled && 'hover:bg-zinc-800/50 transition-colors cursor-pointer',
        collapsed && 'justify-center px-0 py-4',
      )}
    >
      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-sm', activeApp.iconBg)}>
        <ActiveIcon className={cn('h-4 w-4', activeApp.color)} />
      </div>
      {!collapsed && (
        <>
          <div className="flex flex-col items-start leading-none flex-1 min-w-0">
            <span className="text-sm font-bold text-zinc-100 truncate">{activeApp.label}</span>
          </div>
          {switcherEnabled && <Grip className="h-4 w-4 shrink-0 text-zinc-400" />}
        </>
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
        align="start"
        side="right"
        sideOffset={8}
        alignOffset={12}
      >
        <DropdownMenuLabel className="text-[11px] text-zinc-400 font-semibold px-4 pt-3 pb-2">
          Switch Application
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-zinc-800 mx-0 my-0" />

        <div className="max-h-[90vh] overflow-y-auto">
          {grouped.map(([category, list], idx) => (
            <div key={category} className={cn(idx > 0 && 'border-t border-zinc-800')}>
              <p className="px-4 pt-3 pb-2 text-[13px] font-bold text-zinc-100">{category}</p>
              <TooltipProvider delayDuration={150}>
                <div className="grid grid-cols-3 gap-1 px-2 pb-3">
                  {list.map(app => {
                    const AppIcon = app.icon;
                    const isActive = app.id === activeApp.id;
                    const isLive = LIVE_APPS.has(app.id as AppId);
                    return (
                      <Tooltip key={app.id}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => handleSelectApp(app)}
                            className={cn(
                              'flex flex-col items-center gap-2 px-2 py-3 rounded-lg transition-colors text-center group',
                              isActive ? 'bg-zinc-800/80' : 'hover:bg-zinc-800/50',
                            )}
                          >
                            <div className="relative">
                              <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full shadow-sm', app.iconBg)}>
                                <AppIcon className={cn('h-5 w-5', app.color)} />
                              </div>
                              {isLive ? (
                                // On air — live module
                                <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5" title="Live module">
                                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                  <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-zinc-950" />
                                </span>
                              ) : (
                                // Warning — not live yet
                                <span
                                  className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 ring-2 ring-zinc-950"
                                  title="Not live yet"
                                >
                                  <AlertTriangle className="h-2.5 w-2.5 text-zinc-950" />
                                </span>
                              )}
                            </div>
                            <span className={cn(
                              'text-xs font-medium truncate w-full px-0.5',
                              isActive ? 'text-zinc-100' : 'text-zinc-300 group-hover:text-zinc-100',
                            )}>
                              {app.label}
                            </span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs font-medium max-w-[220px]">
                          {app.description}
                          <span className={cn('mt-1 block font-semibold', isLive ? 'text-emerald-400' : 'text-amber-400')}>
                            {isLive ? '● Live module' : '⚠ Not live yet'}
                          </span>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </TooltipProvider>
            </div>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
