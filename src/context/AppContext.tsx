import { createContext, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { APPS, AppConfig, AppId, getApp } from '@/config/apps';
import { BUILD_APP, BUILD_APPS, IS_SINGLE_APP } from '@/lib/buildContext';

const AVAILABLE_APPS = APPS.filter(a => BUILD_APPS.includes(a.id));

// ─── Types ────────────────────────────────────────────────────────────────────

interface AppContextValue {
  activeApp: AppConfig;
  setActiveApp: (id: AppId) => void;
  apps: AppConfig[];
  collapsed: boolean;
  setCollapsed: (val: boolean) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function detectAppFromPath(pathname: string, currentAppId?: AppId): AppId {
  // URL shape is /<module>/<rest> — module identifier is the first segment.
  const seg = pathname.split('/').filter(Boolean)[0];
  if (seg && APPS.some(a => a.id === seg)) return seg as AppId;
  if (currentAppId) return currentAppId;
  return (localStorage.getItem('pulse-active-app') as AppId) ?? 'pulse';
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AppContext = createContext<AppContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(true);
  const [activeAppId, setActiveAppId] = useState<AppId>(() => {
    if (IS_SINGLE_APP && BUILD_APP) return BUILD_APP.id;
    return detectAppFromPath(window.location.pathname, (localStorage.getItem('pulse-active-app') as AppId) || undefined);
  });

  // Sync active app whenever the route changes (dev / multi-app shell only).
  useEffect(() => {
    if (IS_SINGLE_APP) return;
    const detected = detectAppFromPath(location.pathname, activeAppId);
    if (detected !== activeAppId) {
      setActiveAppId(detected);
      localStorage.setItem('pulse-active-app', detected);
    }
  }, [location.pathname, activeAppId]);

  const setActiveApp = (id: AppId) => {
    if (IS_SINGLE_APP) return; // locked in single-app builds
    localStorage.setItem('pulse-active-app', id);
    setActiveAppId(id);
  };

  return (
    <AppContext.Provider
      value={{
        activeApp: getApp(activeAppId),
        setActiveApp,
        apps: AVAILABLE_APPS,
        collapsed,
        setCollapsed,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
