import { useMemo, useState } from 'react';

export type SortDir = 'asc' | 'desc';
export interface SortState<K extends string> {
  key: K;
  dir: SortDir;
}

/**
 * Generic three-stage column sorter for tables. Clicking a column cycles
 * ascending → descending → default (unsorted, falls back to `defaultSort`).
 * `sort` is null while in the default state, so headers can show a neutral
 * icon. `accessors` maps a sort key to a value getter — define it at module
 * scope (a stable reference). null/undefined values always sort to the bottom.
 */
export function useSortable<T, K extends string>(
  rows: T[],
  accessors: Record<K, (row: T) => string | number | null | undefined>,
  defaultSort: { key: K; dir: SortDir },
) {
  const [sort, setSort] = useState<SortState<K> | null>(null);

  const effective = sort ?? defaultSort;
  const sorted = useMemo(() => {
    const get = accessors[effective.key];
    const dir = effective.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1; // nulls always last
      if (vb == null) return -1;
      if (typeof va === 'string' || typeof vb === 'string') {
        return String(va).localeCompare(String(vb)) * dir;
      }
      return ((va as number) - (vb as number)) * dir;
    });
  }, [rows, effective.key, effective.dir, accessors]);

  /** Cycle a column: new key → asc, asc → desc, desc → default (null). */
  const toggle = (key: K) =>
    setSort((s) => {
      if (!s || s.key !== key) return { key, dir: 'asc' };
      if (s.dir === 'asc') return { key, dir: 'desc' };
      return null;
    });

  return { sorted, sort, toggle };
}
