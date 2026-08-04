/**
 * AccessManager.tsx
 * ─────────────────
 * Roles & Access — one row per PERSON.
 *
 * The table only DISPLAYS. Everything editable lives in a dialog, the same way
 * the OLE 4Q report gathers its scope: a person's access is several related
 * choices (level, apps, workcells) that only make sense together, so editing
 * them inline meant a row of controls nobody could read.
 *
 * Two dialogs, because they answer different questions:
 *   Access        what they ARE and what they LEAD
 *   Notifications what they get EMAILED about
 */

import { PersonSearch } from '@/components/shared/PersonSearch';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { HcPerson } from '@/lib/hc/hcApi';
import { cn } from '@/lib/utils';
import { Bell, Check, Loader2, Plus, Search, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

const BASE = import.meta.env.DEV ? 'http://localhost:9007/api' : '/ietools/ole/api';
const API = `${BASE}/access`;

// Both modules: OLE knows its 10 workcells (SMH lives there), Cycle Time its 36.
const WORKCELL_SOURCES = [
  { url: `${BASE}/workcells`, pick: (r: { workcell: string }) => r.workcell },
  { url: `${BASE}/cycle-time/customers`, pick: (r: { customer: string }) => r.customer },
];

const APPS = [
  { id: 'ole', label: 'OLE' },
  { id: 'cycle_time', label: 'Cycle Time' },
  { id: 'ppqt', label: 'PPQT' },
  { id: 'ipk', label: 'IPK' },
  { id: 'lbr', label: 'LBR' },
  { id: 'ebuild', label: 'eBuild' },
];

type Level = 'viewer' | 'admin' | 'super_admin' | 'developer';

const LEVELS: { id: Level; label: string; desc: string; cls: string }[] = [
  { id: 'viewer',      label: 'Viewer',      desc: 'Read only. The default for everyone.', cls: 'bg-muted text-muted-foreground' },
  { id: 'admin',       label: 'Admin',       desc: 'Extra features in the apps they are scoped to.', cls: 'bg-blue-500/15 text-blue-500' },
  { id: 'super_admin', label: 'Super admin', desc: 'Edit any workcell, not just their own.', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  { id: 'developer',   label: 'Developer',   desc: 'Everything, everywhere.', cls: 'bg-purple-500/15 text-purple-500' },
];
// super_admin and developer outrank admin, so they sort above it.
const LEVEL_RANK: Record<Level, number> = { developer: 0, super_admin: 1, admin: 2, viewer: 3 };

const LEVEL_META = Object.fromEntries(LEVELS.map(l => [l.id, l])) as Record<Level, typeof LEVELS[number]>;

/** Notification types. One today; the store is keyed so a second costs a row. */
const NOTIFICATIONS = [
  { key: 'ole_smh', label: 'OLE — SMH incompletion', desc: 'Models with no SMH value, for the workcells they lead.' },
];

interface User {
  ntid: string;
  name: string | null;
  email: string | null;
  position: string | null;
  customer: string | null;
  level: Level;
  apps: string[];
  workcells: string[];
  primary_workcell: string | null;
  notifications: Record<string, boolean>;
}

function Box({ on }: { on: boolean }) {
  return (
    <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
      on ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40')}>
      {on && <Check className="h-3 w-3" strokeWidth={3} />}
    </span>
  );
}

// ─── Access dialog ───────────────────────────────────────────────────────────

function AccessDialog({ user, workcells, onClose, onSave, saving }: {
  user: User;
  workcells: string[];
  onClose: () => void;
  onSave: (u: User) => void;
  saving: boolean;
}) {
  const [level, setLevel] = useState<Level>(user.level);
  const [apps, setApps] = useState<string[]>(user.apps);
  const [picked, setPicked] = useState<string[]>(user.workcells);
  const [primary, setPrimary] = useState<string | null>(user.primary_workcell);
  const [q, setQ] = useState('');

  const allApps = apps.includes('all');
  const shown = useMemo(
    () => (q.trim() ? workcells.filter(w => w.toLowerCase().includes(q.trim().toLowerCase())) : workcells),
    [workcells, q]);

  const toggleApp = (id: string) => {
    if (allApps) { setApps([id]); return; }              // leaving "all" starts a fresh list
    const next = apps.includes(id) ? apps.filter(a => a !== id) : [...apps, id];
    setApps(next.length ? next : ['all']);               // empty is meaningless — fall back to all
  };
  const toggleWc = (w: string) => {
    const next = picked.includes(w) ? picked.filter(x => x !== w) : [...picked, w];
    setPicked(next);
    // First workcell becomes primary; dropping the primary hands it to the next.
    if (!next.includes(primary ?? '')) setPrimary(next[0] ?? null);
    else if (!primary && next.length) setPrimary(next[0]);
  };

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <div className="mb-4">
          <h3 className="text-base font-semibold">{user.name ?? user.ntid}</h3>
          <p className="text-xs text-muted-foreground">
            {user.ntid}{user.email ? ` · ${user.email}` : ' · no email on record'}
          </p>
        </div>

        <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
          {/* Level */}
          <div>
            <Label>Access level</Label>
            <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
              {LEVELS.map(l => (
                <button key={l.id} onClick={() => setLevel(l.id)}
                  className={cn('rounded-lg border px-3 py-2 text-left transition-colors',
                    level === l.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50')}>
                  <div className="flex items-center gap-2">
                    <Box on={level === l.id} />
                    <span className="text-sm font-medium">{l.label}</span>
                  </div>
                  <p className="ml-6 text-[11px] text-muted-foreground">{l.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Apps */}
          <div>
            <Label>Applies to</Label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <button onClick={() => setApps(['all'])}
                className={cn('flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors',
                  allApps ? 'border-primary bg-primary/5' : 'hover:bg-muted/50')}>
                <Box on={allApps} />All apps
              </button>
              {APPS.map(a => (
                <button key={a.id} onClick={() => toggleApp(a.id)}
                  className={cn('flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors',
                    !allApps && apps.includes(a.id) ? 'border-primary bg-primary/5' : 'hover:bg-muted/50')}>
                  <Box on={!allApps && apps.includes(a.id)} />{a.label}
                </button>
              ))}
            </div>
          </div>

          {/* Workcells */}
          <div>
            <div className="flex items-baseline justify-between">
              <Label>Leads these workcells</Label>
              <span className="text-[11px] text-muted-foreground">
                {picked.length} selected{primary ? ` · ${primary} addressed first` : ''}
              </span>
            </div>
            <div className="relative mt-1.5">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Filter workcells…"
                className="h-8 pl-8 text-xs" />
            </div>
            <div className="mt-1.5 grid max-h-52 gap-1 overflow-y-auto sm:grid-cols-3">
              {shown.map(w => (
                <button key={w} onClick={() => toggleWc(w)}
                  className={cn('flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs transition-colors',
                    picked.includes(w) ? 'border-primary bg-primary/5' : 'hover:bg-muted/50')}>
                  <Box on={picked.includes(w)} />
                  <span className="truncate">{w}</span>
                  {primary === w && <span className="ml-auto text-[9px] text-amber-500">1st</span>}
                </button>
              ))}
            </div>
            {picked.length > 1 && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground">Address first:</span>
                {picked.map(w => (
                  <button key={w} onClick={() => setPrimary(w)}
                    className={cn('rounded-full px-2 py-0.5 text-[10px] transition-colors',
                      primary === w ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' : 'bg-muted text-muted-foreground hover:text-foreground')}>
                    {w}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button disabled={saving} className="flex-1"
            onClick={() => onSave({ ...user, level, apps, workcells: picked, primary_workcell: primary })}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Notification dialog ─────────────────────────────────────────────────────

function NotifyDialog({ user, onClose, onSave, saving }: {
  user: User; onClose: () => void; onSave: (u: User) => void; saving: boolean;
}) {
  const [on, setOn] = useState<Record<string, boolean>>(user.notifications ?? {});

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <div className="mb-4">
          <h3 className="text-base font-semibold">Notifications — {user.name ?? user.ntid}</h3>
          <p className="text-xs text-muted-foreground">
            Reports are sent for the workcells this person leads.
          </p>
        </div>

        {user.workcells.length === 0 && (
          <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
            They lead no workcells, so there is nothing to send. Assign a workcell first.
          </div>
        )}
        {!user.email && (
          <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
            No email address in headcount — they would be skipped silently.
          </div>
        )}

        <div className="space-y-1.5">
          {NOTIFICATIONS.map(n => (
            <button key={n.key} onClick={() => setOn({ ...on, [n.key]: !on[n.key] })}
              className={cn('flex w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors',
                on[n.key] ? 'border-primary bg-primary/5' : 'hover:bg-muted/50')}>
              <div className="pt-0.5"><Box on={!!on[n.key]} /></div>
              <div>
                <div className="text-sm font-medium">{n.label}</div>
                <p className="text-[11px] text-muted-foreground">{n.desc}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button disabled={saving} className="flex-1"
            onClick={() => onSave({ ...user, notifications: on })}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add-person dialog ───────────────────────────────────────────────────────

/** Searching headcount and filtering the table are different actions that
 *  happened to look alike, so they used to share one box. Picking someone here
 *  hands straight off to the access dialog — a person with no level and no
 *  workcells is not worth creating and then having to go and edit. */
function AddPersonDialog({ existing, onClose, onPick }: {
  existing: Set<string>;
  onClose: () => void;
  onPick: (p: HcPerson) => void;
}) {
  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <div className="mb-3">
          <h3 className="text-base font-semibold">Add person</h3>
          <p className="text-xs text-muted-foreground">
            Search headcount by name or NTID. You'll set their access next.
          </p>
        </div>
        <PersonSearch autoFocus placeholder="Search name or NTID…" onPick={p => {
          if (p.ntid && existing.has(p.ntid)) { onClose(); return; }   // already listed
          onPick(p);
        }} />
        <p className="mt-3 text-[11px] text-muted-foreground">
          Anyone not listed is a viewer by default — you only need to add people who
          lead a workcell, need admin, or should receive reports.
        </p>
      </DialogContent>
    </Dialog>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{children}</span>;
}

// ─── Table ───────────────────────────────────────────────────────────────────

export function AccessManager({ currentNtid }: { currentNtid?: string }) {
  const [users, setUsers] = useState<User[]>([]);
  const [workcells, setWorkcells] = useState<string[]>([]);
  const [editing, setEditing] = useState<User | null>(null);
  const [notifying, setNotifying] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<User | null>(null);
  const [filter, setFilter] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await fetch(API).then(x => x.json());
      setUsers(r.users ?? []); setErr(null);
    } catch (e) { setErr(String(e)); }
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    Promise.allSettled(WORKCELL_SOURCES.map(s =>
      fetch(s.url).then(r => r.json()).then((l: unknown[]) => l.map(r => s.pick(r as never)).filter(Boolean))))
      .then(res => setWorkcells(
        Array.from(new Set(res.flatMap(r => (r.status === 'fulfilled' ? r.value : []))))
          .sort((a, b) => a.localeCompare(b))));
  }, []);

  async function save(u: User) {
    setSaving(true);
    try {
      const res = await fetch(`${API}/${u.ntid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: u.name, email: u.email, level: u.level, apps: u.apps,
          workcells: u.workcells, primary_workcell: u.primary_workcell,
          notifications: u.notifications, added_by: currentNtid ?? null,
        }),
      });
      if (!res.ok) setErr(`Save failed — ${res.status}`);
      await load();
      setEditing(null); setNotifying(null);
    } catch (e) { setErr(String(e)); }
    finally { setSaving(false); }
  }

  async function remove(ntid: string) {
    setSaving(true);
    try { await fetch(`${API}/${ntid}`, { method: 'DELETE' }); await load(); }
    finally { setSaving(false); }
  }

  /** Adding someone opens the dialog straight away — a viewer with no workcells
   *  is not a useful thing to create and then have to go and edit. */
  const addPerson = (p: HcPerson) => setEditing({
    ntid: p.ntid ?? '', name: p.legalName, email: p.email,
    position: p.businessTitle ?? null, customer: p.customer ?? null,
    level: 'viewer', apps: ['all'], workcells: [], primary_workcell: null, notifications: {},
  });

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u =>
      (u.name ?? '').toLowerCase().includes(q) ||
      u.ntid.toLowerCase().includes(q) ||
      (u.email ?? '').toLowerCase().includes(q) ||
      (u.position ?? '').toLowerCase().includes(q) ||
      (u.customer ?? '').toLowerCase().includes(q) ||
      u.workcells.some(w => w.toLowerCase().includes(q)) ||
      u.level.includes(q));
  }, [users, filter]);

  // You first, then the people who can change anything, then workcell leads.
  const sorted = useMemo(() => {
    const rank = (u: User) => (u.ntid === currentNtid ? -1 : LEVEL_RANK[u.level]);
    return [...visible].sort((a, b) =>
      rank(a) - rank(b) || (a.name ?? a.ntid).localeCompare(b.name ?? b.ntid));
  }, [visible, currentNtid]);

  return (
    <div className="space-y-3">
      {err && <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-500">{err}</div>}

      <div className="flex items-center gap-2">
        {/* Filters the table below — it does NOT search headcount. Use Add person for that. */}
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={filter} onChange={e => setFilter(e.target.value)}
            placeholder="Filter this list…" className="h-9 pl-8 text-sm" />
        </div>
        {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        <Button size="sm" className="ml-auto h-9 gap-1.5" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" />Add person
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="grid gap-3 border-b bg-muted/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
          style={{ gridTemplateColumns: '1.4fr 7.5rem 8rem 6.5rem 7.5rem 1.2fr 4.5rem 4rem' }}>
          <span>Person</span><span>Position</span><span>Customer</span><span>Level</span>
          <span>Apps</span><span>Workcells</span><span>Notify</span><span />
        </div>

        {sorted.map(u => (
          <div key={u.ntid}
            className={cn('grid items-center gap-3 border-b px-4 py-2 text-xs last:border-0',
              u.ntid === currentNtid
                ? 'bg-amber-400/10 hover:bg-amber-400/15 dark:bg-amber-400/[0.07] dark:hover:bg-amber-400/[0.12]'
                : 'hover:bg-muted/30')}
            style={{ gridTemplateColumns: '1.4fr 7.5rem 8rem 6.5rem 7.5rem 1.2fr 4.5rem 4rem' }}>
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="truncate font-medium">{u.name ?? u.ntid}</span>
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{u.ntid}</span>
              </div>
              <div className={cn('truncate text-[10px]', u.email ? 'text-muted-foreground' : 'text-amber-500')}>
                {u.email ?? 'no email on record'}
              </div>
            </div>

            <span className="truncate text-muted-foreground" title={u.position ?? ''}>
              {u.position ?? '—'}
            </span>

            <span className="truncate text-muted-foreground" title={u.customer ?? ''}>
              {u.customer ?? '—'}
            </span>

            <span><span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', LEVEL_META[u.level].cls)}>
              {LEVEL_META[u.level].label}</span></span>

            <span className="truncate text-muted-foreground">
              {u.apps.includes('all') ? 'All apps'
                : u.apps.map(a => APPS.find(x => x.id === a)?.label ?? a).join(', ')}
            </span>

            <span className="truncate text-muted-foreground" title={u.workcells.join(', ')}>
              {LEVEL_RANK[u.level] <= LEVEL_RANK.super_admin ? 'All workcells'
                : u.workcells.length === 0 ? '—'
                : u.workcells.length <= 2 ? u.workcells.join(', ')
                : `${u.workcells[0]} +${u.workcells.length - 1} more`}
            </span>

            <button onClick={() => setNotifying(u)}
              className={cn('flex items-center gap-1 text-[10px] transition-colors',
                Object.values(u.notifications).some(Boolean)
                  ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground/50 hover:text-foreground')}>
              <Bell className="h-3 w-3" />
              {Object.values(u.notifications).filter(Boolean).length || 'off'}
            </button>

            <div className="flex justify-end gap-1">
              <button onClick={() => setEditing(u)}
                className="rounded px-2 py-1 text-[11px] text-primary transition-colors hover:bg-primary/10">Edit</button>
              <button onClick={() => setConfirmDelete(u)}
                className="p-1 text-muted-foreground transition-colors hover:text-red-500">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}

        {visible.length === 0 && (
          <div className="px-4 py-8 text-center text-xs text-muted-foreground">
            {users.length === 0
              ? 'Nobody added yet. Everyone is a viewer by default.'
              : `Nobody here matches "${filter.trim()}".`}
          </div>
        )}
      </div>

      {confirmDelete && (
        <Dialog open onOpenChange={o => { if (!o) setConfirmDelete(null); }}>
          <DialogContent className="max-w-md">
            <h3 className="text-base font-semibold">Remove access?</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{confirmDelete.name ?? confirmDelete.ntid}</span>{' '}
              drops back to viewer
              {confirmDelete.workcells.length > 0 && (
                <> and stops receiving reports for {confirmDelete.workcells.join(', ')}</>
              )}.
            </p>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(null)}>Cancel</Button>
              <Button variant="destructive" className="flex-1" disabled={saving}
                onClick={() => { remove(confirmDelete.ntid); setConfirmDelete(null); }}>Remove</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
      {adding && (
        <AddPersonDialog
          existing={new Set(users.map(u => u.ntid))}
          onClose={() => setAdding(false)}
          onPick={p => { setAdding(false); addPerson(p); }}
        />
      )}
      {editing && <AccessDialog user={editing} workcells={workcells} saving={saving}
        onClose={() => setEditing(null)} onSave={save} />}
      {notifying && <NotifyDialog user={notifying} saving={saving}
        onClose={() => setNotifying(null)} onSave={save} />}
    </div>
  );
}
