import { createContext, useContext, useState } from 'react';
import { APPS, AppConfig, AppId, getApp } from '@/config/apps';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AppContextValue {
  activeApp: AppConfig;
  setActiveApp: (id: AppId) => void;
  apps: AppConfig[];
  collapsed: boolean;
  setCollapsed: (val: boolean) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AppContext = createContext<AppContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [activeAppId, setActiveAppId] = useState<AppId>(() => {
    const stored = localStorage.getItem('pulse-active-app');
    return (stored as AppId) ?? 'pulse';
  });

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
