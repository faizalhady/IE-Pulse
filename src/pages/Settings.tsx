import { AccessManager } from '@/components/settings/AccessManager';
import { useAccessLevel } from '@/hooks/useAccessLevel';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { setFeatureFlag, useFeatureFlag } from '@/lib/featureFlags';
import { cn } from '@/lib/utils';
import { currentUser } from '@/mocks/data';
import { Bell, Monitor, Shield, Sliders, User } from 'lucide-react';
import { useState } from 'react';

type SettingsTab = 'profile' | 'roles' | 'display' | 'notifications' | 'system';

const TABS: { key: SettingsTab; label: string; icon: any }[] = [
  { key: 'roles', label: 'Roles & Access', icon: Shield },
  { key: 'profile', label: 'Profile', icon: User },
  { key: 'display', label: 'Display', icon: Monitor },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'system', label: 'System', icon: Sliders },
];

const ROLES = [
  { role: 'operator', label: 'Operator', desc: 'View kiosk and bay status. Read-only.' },
  { role: 'supervisor', label: 'Supervisor', desc: 'Full dashboard access. No system settings.' },
  { role: 'engineer', label: 'Engineer', desc: 'Full dashboard + raw data views.' },
  { role: 'admin', label: 'Admin', desc: 'Full access including settings and user management.' },
];

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        'w-9 h-5 rounded-full transition-colors relative flex-shrink-0',
        checked ? 'bg-primary' : 'bg-muted'
      )}
    >
      <span className={cn(
        'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all',
        checked ? 'left-[18px]' : 'left-0.5'
      )} />
    </button>
  );
}

// Shared section card — same visual as BayDetail rounded-xl cards
function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {(title || action) && (
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export default function Settings() {
  const { user } = useCurrentUser();
  const { isDeveloper, loading: accessLoading } = useAccessLevel();
  const currentNtid = user?.ntid ?? null;
  const [tab, setTab] = useState<SettingsTab>('roles');
  const [currentRole, setCurrentRole] = useState(currentUser.role);
  const [notifs, setNotifs] = useState({ critical: true, warning: false, wip: true, shift: true, email: false });
  const [display, setDisplay] = useState({ darkMode: true, compactTable: false, autoRefresh: true, showIdle: true });
  const appSwitcherEnabled = useFeatureFlag('appSwitcher');

  // Deny on unknown identity rather than assuming the best: this page edits who
  // can do what everywhere else. Hooks all run above this line so the early
  // return cannot change hook order.
  if (accessLoading) {
    return <div className="p-8 text-sm text-muted-foreground">Checking access...</div>;
  }
  if (!isDeveloper) {
    return (
      <div className="p-8">
        <div className="max-w-md rounded-xl border bg-card p-6">
          <h2 className="text-base font-semibold">Settings are restricted</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Roles &amp; access can only be changed by a developer. Ask one of them
            if you need something here.
          </p>
          {user?.ntid && (
            <p className="mt-3 font-mono text-[11px] text-muted-foreground">
              signed in as {user.ntid}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-0">

      {/* ── Sticky header — identical structure to BayDetail ── */}
      <div className="sticky top-0 z-20 bg-background border-b border-border px-6">
        <div className="pt-4 pb-3">
          <h1 className="text-xl font-semibold text-foreground">Settings</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Manage your preferences, roles, and system configuration</p>
        </div>
        <div className="flex gap-0 -mb-px">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2',
                tab === key
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content — px-6 pb-8 same as BayDetail content area ── */}
      <div className="px-6 pt-5 pb-8 space-y-4">

        {/* ── PROFILE ── */}
        {tab === 'profile' && (
          <div className="space-y-4">
            <Section title="Account Information">
              {/* Avatar row */}
              <div className="px-6 py-6 flex items-center gap-4 border-b border-border">
                <div
                  style={{ width: 56, height: 56, borderRadius: '50%' }}
                  className="bg-primary flex items-center justify-center text-primary-foreground text-xl font-bold flex-shrink-0 flex-grow-0"
                >
                  {currentUser.name.split(' ').filter(n => /^[a-zA-Z]/.test(n)).slice(0, 2).map(n => n[0].toUpperCase()).join('')}
                </div>
                <div className="flex flex-col gap-1">
                  <p className="font-semibold text-foreground text-base leading-none">{currentUser.name}</p>
                  <p className="text-sm text-muted-foreground capitalize leading-none">{currentUser.role} · {currentUser.id}</p>
                </div>
              </div>
              {/* Form fields */}
              <div className="px-6 py-6 space-y-5">
                {[
                  { label: 'Full Name', value: currentUser.name },
                  { label: 'Employee ID', value: currentUser.id },
                  { label: 'Department', value: 'Industrial Engineering' },
                  { label: 'Email', value: 'SyedFaizAlhady_SyedAhmadAlhady@jabil.com' },
                ].map(f => (
                  <div key={f.label}>
                    <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">
                      {f.label}
                    </label>
                    <input
                      defaultValue={f.value}
                      className="w-full px-4 py-3 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                    />
                  </div>
                ))}
                <div className="pt-2">
                  <button className="px-6 py-3 bg-primary text-primary-foreground text-sm rounded-lg font-medium hover:bg-primary/90 transition-colors">
                    Save Changes
                  </button>
                </div>
              </div>
            </Section>
          </div>
        )}

        {/* ── ROLES & ACCESS ── */}
        {tab === 'roles' && (
          <div className="space-y-4">
            <Section title="Person in charge">
              <div className="px-5 py-4">
                <p className="mb-3 text-xs text-muted-foreground">
                  Who owns each workcell and each app. Used to address notifications, and later to decide who can edit what.
                </p>
                <AccessManager currentNtid={currentNtid ?? undefined} />
              </div>
            </Section>

          </div>
        )}

        {/* ── DISPLAY ── */}
        {tab === 'display' && (
          <div className="space-y-4">
            <Section title="Display Preferences">
              {([
                { key: 'darkMode', label: 'Dark Mode', desc: 'Use dark theme across the entire app' },
                { key: 'compactTable', label: 'Compact Tables', desc: 'Reduce row padding in machine and bay tables' },
                { key: 'autoRefresh', label: 'Auto Refresh', desc: 'Automatically poll for new data every 10 seconds' },
                { key: 'showIdle', label: 'Show Idle Machines', desc: 'Include idle machines in the bay detail overview table' },
              ] as { key: keyof typeof display; label: string; desc: string }[]).map(({ key, label, desc }, i, arr) => (
                <div
                  key={key}
                  className={cn('flex items-center gap-4 px-5 py-4', i < arr.length - 1 && 'border-b border-border')}
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                  <Toggle checked={display[key]} onChange={v => setDisplay(d => ({ ...d, [key]: v }))} />
                </div>
              ))}
            </Section>

            <Section title="Experimental Features">
              <div className="flex items-center gap-4 px-5 py-4">
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">App Switcher</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Reveal the multi-app dropdown in the sidebar header. Off by default until additional apps ship.
                  </p>
                </div>
                <Toggle checked={appSwitcherEnabled} onChange={v => setFeatureFlag('appSwitcher', v)} />
              </div>
            </Section>
          </div>
        )}

        {/* ── NOTIFICATIONS ── */}
        {tab === 'notifications' && (
          <Section title="Alert Preferences">
            {([
              { key: 'critical', label: 'Critical Alerts', desc: 'Notify when bay productivity drops below 50%' },
              { key: 'warning', label: 'Warning Alerts', desc: 'Notify when bay productivity drops below 85%' },
              { key: 'wip', label: 'WIP Threshold', desc: 'Notify when pending WIP exceeds 40 units on any machine' },
              { key: 'shift', label: 'Shift Handover', desc: 'Send reminder notification at shift change time' },
              { key: 'email', label: 'Email Notifications', desc: 'Send a production summary email at end of each shift' },
            ] as { key: keyof typeof notifs; label: string; desc: string }[]).map(({ key, label, desc }, i, arr) => (
              <div
                key={key}
                className={cn('flex items-center gap-4 px-5 py-4', i < arr.length - 1 && 'border-b border-border')}
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                </div>
                <Toggle checked={notifs[key]} onChange={v => setNotifs(n => ({ ...n, [key]: v }))} />
              </div>
            ))}
          </Section>
        )}

        {/* ── SYSTEM ── */}
        {tab === 'system' && (
          <div className="space-y-4">
            <Section title="API Configuration">
              <div className="px-6 py-6 space-y-5">
                {[
                  { label: 'API Base URL', value: 'http://localhost:3000', placeholder: 'http://your-elysia-api', mono: true },
                  { label: 'Poll Interval', value: '10', placeholder: 'seconds', mono: true },
                  { label: 'SSE Endpoint', value: '/api/stream/bay/:bayId', placeholder: '/api/stream/...', mono: true },
                ].map(f => (
                  <div key={f.label}>
                    <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">
                      {f.label}
                    </label>
                    <input
                      defaultValue={f.value}
                      placeholder={f.placeholder}
                      className={cn(
                        'w-full px-4 py-3 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors',
                        f.mono && 'font-mono'
                      )}
                    />
                  </div>
                ))}
                <div className="pt-2">
                  <button className="px-6 py-3 bg-primary text-primary-foreground text-sm rounded-lg font-medium hover:bg-primary/90 transition-colors">
                    Save Configuration
                  </button>
                </div>
              </div>
            </Section>

            <Section title="System Info">
              <div className="divide-y divide-border">
                {[
                  { label: 'App Version', value: 'PULSE v0.1.0' },
                  { label: 'Build', value: 'pixel-perfect · main' },
                  { label: 'Data Mode', value: 'Mock (no API connected)' },
                  { label: 'Environment', value: 'Development' },
                  { label: 'Last Sync', value: new Date().toLocaleString('en-GB') },
                ].map(f => (
                  <div key={f.label} className="flex items-center justify-between px-5 py-3.5">
                    <span className="text-sm text-muted-foreground">{f.label}</span>
                    <span className="font-mono text-xs text-foreground">{f.value}</span>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        )}

      </div>
    </div>
  );
}
