import { useEffect, useState } from 'react';

import { useCurrentUser } from '@/hooks/useCurrentUser';

const BASE = import.meta.env.DEV ? '/ole-api/api' : '/api';

export type Level = 'viewer' | 'admin' | 'super_admin' | 'developer';

const RANK: Record<Level, number> = { viewer: 0, admin: 1, super_admin: 2, developer: 3 };

export interface Access {
  ntid: string | null;
  level: Level;
  workcells: string[];
  allWorkcells: boolean;
  isAdmin: boolean;
  isDeveloper: boolean;
  /** True until we know who you are AND what you may do. Gate on this before
   *  deciding to deny, or every page flashes "no access" on first paint. */
  loading: boolean;
}

const DENIED: Omit<Access, 'loading'> = {
  ntid: null, level: 'viewer', workcells: [], allWorkcells: false,
  isAdmin: false, isDeveloper: false,
};

/** What the signed-in Windows user may do.
 *
 *  This is a UI convenience, NOT a security boundary — see the note in
 *  api/routers/access.py. The backend runs as LocalSystem and never sees an
 *  authenticated caller, so anyone who can reach the API can call it directly
 *  with any ntid. Treat this as "don't show people controls they can't use",
 *  not as "this data is protected".
 */
export function useAccessLevel(): Access {
  const { user, error } = useCurrentUser();
  const ntid = user?.ntid ?? null;
  const [state, setState] = useState<Omit<Access, 'loading'> | null>(null);

  useEffect(() => {
    if (!ntid) return;
    let alive = true;
    fetch(`${BASE}/access/me/${encodeURIComponent(ntid)}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: {
        level: Level; workcells: string[]; all_workcells: boolean; is_admin: boolean;
      }) => {
        if (!alive) return;
        setState({
          ntid, level: d.level, workcells: d.workcells ?? [],
          allWorkcells: d.all_workcells, isAdmin: d.is_admin,
          isDeveloper: RANK[d.level] >= RANK.developer,
        });
      })
      .catch(() => { if (alive) setState({ ...DENIED, ntid }); });
    return () => { alive = false; };
  }, [ntid]);

  // Identity failed to resolve: stop loading and deny, rather than hanging on a
  // spinner forever.
  if (error && !ntid) return { ...DENIED, loading: false };
  return state ? { ...state, loading: false } : { ...DENIED, loading: true };
}
