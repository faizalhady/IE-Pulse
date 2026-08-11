/**
 * ScopePicker.tsx — pick a report's scope as plants and workcells.
 *
 * Shared by OLE 4Q (inside a Dialog) and the Cycle Time Incompletion Report
 * (inside a collapsible card). Only the TREE is shared, not the container: the
 * two wrap it differently, and a component that owned its own chrome would have
 * to grow a mode prop to serve both.
 *
 * SELECTION MODEL — the part worth protecting
 * A plant reads "all" purely because the picked workcells happen to equal that
 * plant's full set. It is DERIVED on every render, never stored. So ticking or
 * unticking any single workcell makes the plant highlight fall away on its own,
 * with no extra bookkeeping and no way for the two to disagree.
 *
 * `picked` is always an explicit list here. The "empty means everything"
 * convention some callers use is theirs to translate at the boundary — folding
 * it in would make an empty array ambiguous for everyone else.
 */

import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

/** Tri-state tick. Exported because callers render their own rows beside the
 *  tree (Cycle Time has an "All" row above it) and those must match. */
export function ScopeBox({ on, partial = false }: { on: boolean; partial?: boolean }) {
  return (
    <span className={cn(
      'flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors',
      on || partial ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40',
    )}>
      {on && <Check className="h-3 w-3" strokeWidth={3} />}
      {partial && !on && <span className="h-0.5 w-2 rounded bg-primary-foreground" />}
    </span>
  );
}

export type PlantState = 'all' | 'some' | 'none';

/** Derived, never stored — see the selection model note above. Exported so a
 *  caller can label a plant without re-deriving the rule differently. */
export function plantState(workcells: string[], picked: string[]): PlantState {
  const n = workcells.filter(w => picked.includes(w)).length;
  return n === 0 ? 'none' : n === workcells.length ? 'all' : 'some';
}

export interface ScopePickerProps {
  /** Plant keys, in the order they should appear. */
  plants: string[];
  /** Plant key → its workcells. */
  byPlant: Record<string, string[]>;
  /** Currently picked workcells. Always explicit. */
  picked: string[];
  onChange: (next: string[]) => void;
  /** Display name for a plant key — Cycle Time maps JPE → "Plant 2". */
  labelPlant?: (plant: string) => string;
  /** Workcell grid columns. Defaults to OLE's, which sits in a max-w-2xl dialog. */
  gridClassName?: string;
}

export function ScopePicker({
  plants,
  byPlant,
  picked,
  onChange,
  labelPlant = (p) => p,
  gridClassName = 'grid-cols-2 lg:grid-cols-3',
}: ScopePickerProps) {
  const togglePlant = (p: string) => {
    const list = byPlant[p] ?? [];
    onChange(plantState(list, picked) === 'all'
      ? picked.filter(w => !list.includes(w))
      : [...new Set([...picked, ...list])]);
  };

  const toggleWc = (w: string) =>
    onChange(picked.includes(w) ? picked.filter(x => x !== w) : [...picked, w]);

  return (
    <>
      {plants.map(p => {
        const list = byPlant[p] ?? [];
        const st = plantState(list, picked);
        return (
          <div key={p}>
            <button onClick={() => togglePlant(p)}
              className="flex w-full items-center gap-2.5 rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-muted/50">
              <ScopeBox on={st === 'all'} partial={st === 'some'} />
              <span className="text-sm font-semibold">{labelPlant(p)}</span>
              <span className="text-[11px] text-muted-foreground">
                {list.filter(w => picked.includes(w)).length}/{list.length}
              </span>
            </button>

            <div className={cn('mt-1.5 ml-6 grid gap-1.5', gridClassName)}>
              {list.map(w => {
                const on = picked.includes(w);
                return (
                  <button key={w} onClick={() => toggleWc(w)}
                    className={cn(
                      'flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition-colors',
                      on ? 'border-primary/50 bg-primary/5' : 'border-border hover:bg-muted/50',
                    )}>
                    <ScopeBox on={on} />
                    <span className="truncate">{w}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}
