import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AppConfig, AppId } from '@/config/apps';
import { useApp } from '@/context/AppContext';
import { IS_SINGLE_APP } from '@/lib/buildContext';
import { useFeatureFlag } from '@/lib/featureFlags';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown } from 'lucide-react';
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

  const Icon = activeApp.icon;

  // Dev shell: every app's nav items live in this single build, so we use
  // react-router navigate. When each app becomes its own deployed bundle,
  // swap this for a window.location.href using app.basename.
  const handleSelectApp = (app: AppConfig) => {
    if (app.id === activeApp.id) return;
    setActiveApp(app.id as AppId);
    const first = app.navItems[0]?.to ?? '/';
    navigate(first);
  };

  const HeaderButton = (
    <button
      className={cn(
        'flex flex-1 items-center gap-2.5 px-3 py-3 outline-none',
        switcherEnabled && 'hover:bg-zinc-800/50 transition-colors',
        collapsed && 'justify-center px-0 py-4',
      )}
    >
      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-sm', activeApp.iconBg)}>
        <Icon className={cn('h-4 w-4', activeApp.color)} />
      </div>
      {!collapsed && (
        <>
          <div className="flex flex-col items-start leading-none flex-1 min-w-0">
            <span className="text-sm font-bold text-zinc-100 truncate">{activeApp.label}</span>
          </div>
          {switcherEnabled && <ChevronsUpDown className="h-4 w-4 shrink-0 text-zinc-400" />}
        </>
      )}
    </button>
  );

  // Switcher disabled → render the header button only (no dropdown wiring).
  if (!switcherEnabled) {
    return (
      <div className="flex items-center border-b border-zinc-800 bg-zinc-950 outline-none text-zinc-100">
        {HeaderButton}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="flex items-center border-b border-zinc-800 bg-zinc-950 outline-none cursor-pointer text-zinc-100">
          {HeaderButton}
        </div>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="w-[260px] rounded-xl bg-zinc-950 border border-zinc-800 shadow-xl p-1.5"
        align={collapsed ? 'center' : 'start'}
        side={collapsed ? 'right' : 'bottom'}
        sideOffset={8}
      >
        <DropdownMenuLabel className="text-[10px] text-zinc-400 font-bold px-2 py-1.5 uppercase tracking-wider">
          Switch Module
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-zinc-800 mx-1 mb-1" />

        {apps.map((app: AppConfig) => {
          const AppIcon = app.icon;
          const isActive = app.id === activeApp.id;
          return (
            <DropdownMenuItem
              key={app.id}
              onClick={() => handleSelectApp(app)}
              className={cn(
                'flex items-center gap-3 px-2.5 py-2 cursor-pointer transition-all rounded-lg',
                isActive
                  ? 'bg-zinc-800 text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100'
                  : 'text-zinc-300 focus:bg-zinc-800/50 focus:text-zinc-100',
              )}
            >
              <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md shadow-sm', app.iconBg)}>
                <AppIcon className={cn('h-3.5 w-3.5', app.color)} />
              </div>
              <div className="flex flex-col items-start leading-none flex-1 min-w-0">
                <span className={cn('font-semibold text-sm', isActive ? 'text-primary' : 'text-zinc-100')}>
                  {app.label}
                </span>
                <span className="text-[10px] text-zinc-500 truncate mt-1">{app.description}</span>
              </div>
              {isActive && <Check className="h-4 w-4 text-primary shrink-0 ml-auto" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
