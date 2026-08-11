/**
 * useSavedReport — save / load / autosave for a named report.
 *
 * Shared by OLE 4Q and Cycle Time 4Q. Owns identity, the saved list, the
 * debounced autosave, and the dirty indicator; the caller owns the content.
 *
 * Two behaviours here are load-bearing and non-obvious. Do not "simplify" them:
 *
 *   loadedIdRef  The id is read at SAVE time, not closed over. Autosaves are
 *                serialised, and a queued one must see the id the previous one
 *                just created — otherwise it INSERTs a second row instead of
 *                updating the first.
 *
 *   saveChain    Writes are chained, never concurrent. Two in flight against a
 *                brand-new report both see id=null and both insert.
 */

import type { SavedReport, SavedReportMeta, SavedReportsClient, UserInfo } from '@/lib/shared/savedReportsApi';
import { fetchUserInfo, setLocalUser } from '@/lib/shared/savedReportsApi';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/** Payload schema version. Bump when a module's payload shape changes in a way
 *  that old saves cannot be read as-is, and convert on load. Rows written
 *  before versioning have no `v` at all, so readers use `payload.v ?? 1`. */
export const SAVED_REPORT_VERSION = 1;

export type AutoState = 'idle' | 'saving' | 'error';

export interface UseSavedReportOptions<T> {
  /** Bound client — build it at module scope with savedReports(base, module, type). */
  api: SavedReportsClient;
  /** The save's display label. */
  name: string;
  /** What gets persisted as JSON. `v` is added automatically. */
  payload: T;
  /**
   * What "changed" means for the dirty flag. Defaults to the whole payload.
   *
   * OLE passes a NARROWER key than its payload on purpose: scope is persisted
   * but does not by itself mark the report unsaved. Preserved as-is — widening
   * it is a behaviour change, not a cleanup.
   */
  dirtyKey?: string;
  /** Autosave only while this is true (OLE gates on being in the editor). */
  autosave?: boolean;
}

export function useSavedReport<T>({
  api, name, payload, dirtyKey, autosave = true,
}: UseSavedReportOptions<T>) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [savedList, setSavedList] = useState<SavedReportMeta[]>([]);
  /** The saved row's id — the identity. null = never saved. */
  const [loadedId, setLoadedId] = useState<number | null>(null);
  const loadedIdRef = useRef<number | null>(null);
  useEffect(() => { loadedIdRef.current = loadedId; }, [loadedId]);

  const saveChain = useRef<Promise<unknown>>(Promise.resolve());
  const [autoState, setAutoState] = useState<AutoState>('idle');
  const [saveMsg, setSaveMsg] = useState('');

  const key = dirtyKey ?? JSON.stringify(payload);
  /** The content as last saved or loaded. Anything else means unsaved work. */
  const [savedSnapshot, setSavedSnapshot] = useState(key);
  const dirty = key !== savedSnapshot;

  const refreshSaves = useCallback(async (u: UserInfo | null) => {
    if (!u) return;
    try {
      setSavedList(await api.list());
    } catch (e) {
      console.error('saved reports list failed', e);
    }
  }, [api]);

  useEffect(() => {
    // Null user is normal in dev (/userinfo lives on the server) — the report
    // stays fully usable, only save/load is hidden.
    fetchUserInfo().then(u => { setUser(u); refreshSaves(u); });
  }, [refreshSaves]);

  /** Identity, asking for it once if the server couldn't tell us (dev). */
  const ensureUser = useCallback(async (): Promise<UserInfo | null> => {
    if (user) return user;
    const ntid = window.prompt(
      'Could not identify you automatically (normal on a dev machine).\nEnter your NTID to save:',
      '',
    );
    if (!ntid?.trim()) return null;
    const u: UserInfo = { userNtid: ntid.trim(), userName: ntid.trim(), userEmail: '' };
    setLocalUser(u);
    setUser(u);
    await refreshSaves(u);
    return u;
  }, [user, refreshSaves]);

  /** Single write path — used by the Save button AND the autosave, so "Saved"
   *  can never be shown for a report that was never persisted. */
  const persist = useCallback(async (u: UserInfo, opts: {
    id: number | null; name: string; payload: T; snapshot: string; announce: boolean;
  }) => {
    const label = opts.name.trim() || 'Untitled report';
    const res = await api.save({
      id: opts.id, name: label, user: u,
      payload: { v: SAVED_REPORT_VERSION, ...opts.payload },
    });
    setLoadedId(res.id);
    loadedIdRef.current = res.id;
    setSavedSnapshot(opts.snapshot);
    if (opts.announce) {
      setSaveMsg(`Saved "${label}"`);
      setTimeout(() => setSaveMsg(''), 4000);
    }
    await refreshSaves(u);
    return res;
  }, [api, refreshSaves]);

  /** Manual save. The title is the save's LABEL, not its identity — `loadedId`
   *  is. So a rename just updates that row: it cannot duplicate, and it cannot
   *  clobber a different save that happens to share the title. */
  const save = useCallback(async () => {
    const u = await ensureUser();
    if (!u) return;
    try {
      await persist(u, { id: loadedIdRef.current, name, payload, snapshot: key, announce: true });
    } catch (e) {
      console.error(e);
      setSaveMsg(e instanceof Error ? e.message : 'Save failed');
      setTimeout(() => setSaveMsg(''), 4000);
    }
  }, [ensureUser, persist, name, payload, key]);

  /* Autosave. Debounced, so typing a sentence is one write and not one per
     keystroke. Runs only once we know who you are: on a dev machine saving
     needs an NTID prompt, and a prompt fired by a timer would be an ambush, so
     the manual button stays as the fallback there. */
  useEffect(() => {
    // 'saving' would otherwise schedule a second write on top of the one in
    // flight, because dirty stays true until the snapshot lands.
    if (!dirty || !user || !autosave || autoState === 'saving') return;
    // A failed autosave has to keep trying on its own. There is no button left
    // to press, so giving up would quietly lose the work.
    const timer = setTimeout(() => {
      setAutoState('saving');
      saveChain.current = saveChain.current
        .then(() => persist(user, {
          id: loadedIdRef.current, name, payload, snapshot: key, announce: false,
        }))
        .then(() => setAutoState('idle'))
        .catch(e => { console.error('autosave failed', e); setAutoState('error'); });
    }, autoState === 'error' ? 5000 : 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, key, user, autosave, autoState]);

  /** Load one save. Returns the record so the caller can apply its content;
   *  the caller then calls markSaved() with its own fingerprint of it. */
  const load = useCallback(async (id: number): Promise<SavedReport<T> | null> => {
    const u = user ?? (await ensureUser());
    if (!u) return null;
    const rec = await api.load<T>(id);
    setLoadedId(rec.id);
    return rec;
  }, [api, user, ensureUser]);

  const remove = useCallback(async (id: number) => {
    if (!user) return;
    const rec = savedList.find(s => s.id === id);
    if (!window.confirm(`Delete saved plan "${rec?.name ?? id}"?`)) return;
    try {
      await api.remove(id);
      await refreshSaves(user);
    } catch (e) { console.error(e); }
  }, [api, user, savedList, refreshSaves]);

  /** Reset the dirty baseline — after applying loaded content, or after
   *  starting a new report. Pass the fingerprint of what is now on screen. */
  const markSaved = useCallback((snapshot: string) => setSavedSnapshot(snapshot), []);

  /** Begin a fresh report: no id yet, and the given content is the baseline. */
  const startNew = useCallback((snapshot: string) => {
    setLoadedId(null);
    loadedIdRef.current = null;
    setSavedSnapshot(snapshot);
  }, []);

  return useMemo(() => ({
    user, savedList, loadedId, autoState, saveMsg, dirty,
    setSaveMsg, ensureUser, refreshSaves,
    save, load, remove, persist, markSaved, startNew,
  }), [user, savedList, loadedId, autoState, saveMsg, dirty,
    ensureUser, refreshSaves, save, load, remove, persist, markSaved, startNew]);
}
