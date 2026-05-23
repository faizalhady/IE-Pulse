import { useEffect, useState } from 'react';

// Same-origin path. Served by nginx in prod via `location /userinfo/`
// (reverse-proxied to AD_GET on the box), and by the Vite dev proxy locally.
const USER_INFO_URL = '/userinfo/RetrieveUserInfoNoParam';

export interface CurrentUser {
  fullName: string | null;
  email: string | null;
  department: string | null;
  jobTitle: string | null;
  location: string | null;
}

interface ApiUserInfo {
  userName?: string;
  userEmail?: string;
  userNtid?: string;
  department?: string;
  title?: string;
  officeLocation?: string;
}

let cached: CurrentUser | null = null;
let inflight: Promise<CurrentUser> | null = null;

async function fetchUser(): Promise<CurrentUser> {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = fetch(USER_INFO_URL, { credentials: 'include' })
    .then((res) => {
      if (!res.ok) throw new Error(`User info ${res.status}`);
      return res.json();
    })
    .then((data: ApiUserInfo): CurrentUser => {
      const user: CurrentUser = {
        fullName: data.userName ?? null,
        email: data.userEmail ?? null,
        department: data.department ?? null,
        jobTitle: data.title ?? null,
        location: data.officeLocation ?? null,
      };
      cached = user;
      return user;
    })
    .finally(() => { inflight = null; });
  return inflight;
}

/** Split a name on whitespace AND camel-case boundaries, e.g. "SyedFaizAlhady SyedAhmadAlhady" → ["Syed","Faiz","Alhady","Syed","Ahmad","Alhady"]. */
export function splitNameWords(name: string): string[] {
  return name
    .split(/\s+/)
    .flatMap((token) => token.split(/(?=[A-Z])/))
    .filter(Boolean);
}

/** First N words of the camel-split name, joined with spaces. Defaults to 2 (sidebar style). */
export function shortName(name: string, count = 2): string {
  return splitNameWords(name).slice(0, count).join(' ');
}

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(cached);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (cached) return;
    let alive = true;
    fetchUser()
      .then((u) => { if (alive) setUser(u); })
      .catch((e) => { if (alive) setError(e); });
    return () => { alive = false; };
  }, []);

  return { user, error };
}
