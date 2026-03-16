import { useLocation } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

export default function Header() {
  const location = useLocation();
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem('pulse-theme');
    return stored ? stored === 'dark' : true; // default dark
  });

  useEffect(() => {
    localStorage.setItem('pulse-theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  if (location.pathname.startsWith('/kiosk')) return null;

  const title = getTitle(location.pathname);

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-6">
      <h1 className="text-lg font-semibold text-card-foreground">{title}</h1>
      <Button variant="ghost" size="icon" onClick={() => setDark(!dark)} className="text-muted-foreground">
        {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
    </header>
  );
}

function getTitle(path: string): string {
  if (path === '/') return 'Global Overview';
  if (path.startsWith('/workcell')) return 'Workcell View';
  if (path.startsWith('/bay')) return 'Bay Detail';
  if (path.startsWith('/reports')) return 'Reports';
  if (path.startsWith('/documents')) return 'Documents';
  if (path.startsWith('/settings')) return 'Settings';
  return 'PULSE';
}
