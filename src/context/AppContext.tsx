import { createContext, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { APPS, AppConfig, AppId, getApp } from '@/config/apps';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AppContextValue {
  activeApp: AppConfig;
  setActiveApp: (id: AppId) => void;
  apps: AppConfig[];
  collapsed: boolean;
  setCollapsed: (val: boolean) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function detectAppFromPath(pathname: string): AppId {
  for (const app of APPS) {
    for (const item of app.navItems) {
      if (item.to !== '/' && pathname.startsWith(item.to)) return app.id;
    }
  }
  // fallback: exact match for root
  if (pathname === '/') return 'pulse';
  return (localStorage.getItem('pulse-active-app') as AppId) ?? 'pulse';
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AppContext = createContext<AppContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [activeAppId, setActiveAppId] = useState<AppId>(() =>
    detectAppFromPath(window.location.pathname)
  );

  // Sync active app whenever the route changes
  useEffect(() => {
    const detected = detectAppFromPath(location.pathname);
    setActiveAppId(detected);
    localStorage.setItem('pulse-active-app', detected);
  }, [location.pathname]);

  const setActiveApp = (id: AppId) => {
    localStorage.setItem('pulse-active-app', id);
    setActiveAppId(id);
  };

  return (
    <AppContext.Provider
      value={{
        activeApp: getApp(activeAppId),
        setActiveApp,
        apps: APPS,
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
