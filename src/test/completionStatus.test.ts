/**
 * The read-time status rules in CompletionDataTable.
 *
 * Both exist because a stored verdict can be older than the rule that produced
 * it, and a wrong verdict here is not a cosmetic bug — it is a model somebody
 * does NOT go and time because the table told them it was fine.
 */

import { describe, expect, it } from 'vitest';

import { dstatus } from '@/pages/cycletime/CompletionDataTable';
import type { DemandCompletionModel } from '@/lib/cycle_time/cycleTimeApi';

const model = (over: Partial<DemandCompletionModel>): DemandCompletionModel => ({
  rank: 1, plant: 'Plant 1', region: 'Plant 1', customer: 'LAM RESEARCH',
  assembly: 'X', units: 1, sources: 'planner', status: 'complete',
  ...over,
} as DemandCompletionModel);

describe('dstatus', () => {
  it('splits a legacy not_in_mes on the reason — waiting vs never coming', () => {
    // Different jobs: one waits for a build, the other will never get a scan.
    // A CURRENT backend already sends not_built / cannot_check; this only fires
    // against an older one that still sends the raw mart status.
    expect(dstatus(model({ status: 'not_in_mes', reason: 'no_production' }))).toBe('not_built');
    expect(dstatus(model({ status: 'not_in_mes', reason: 'workcell_not_on_mes' }))).toBe('cannot_check');
  });

  it('passes the canonical vocabulary straight through', () => {
    // The server owns the verdict now. These must survive untouched, or the
    // shim would start second-guessing the single source of truth.
    for (const s of ['not_built', 'cannot_check']) {
      expect(dstatus(model({ status: s as DemandCompletionModel['status'] }))).toBe(s);
    }
  });

  it('demotes a stored "complete" that still carries a gap', () => {
    // 87 rows in prod on 17 Aug: graded before the 16 Aug rule fix. Green with a
    // non-zero Gap in the next column is the one thing this table must not show.
    expect(dstatus(model({ status: 'complete', no_ct: 2 }))).toBe('incomplete');
    expect(dstatus(model({ status: 'complete', not_in_iedb: 1 }))).toBe('incomplete');
    // Unmapped is OUR gap, and still not a pass — we could not even name the step.
    expect(dstatus(model({ status: 'complete', unmapped: 1 }))).toBe('incomplete');
  });

  it('leaves a genuinely clean complete alone', () => {
    // The re-grade must be a no-op on screen; if this flips, the guard is wrong.
    expect(dstatus(model({ status: 'complete', no_ct: 0, not_in_iedb: 0, unmapped: 0 }))).toBe('complete');
    expect(dstatus(model({ status: 'complete' }))).toBe('complete');
  });

  it('passes every other status through untouched', () => {
    for (const s of ['incomplete', 'no_cycle_time', 'not_in_iedb', 'not_checked']) {
      expect(dstatus(model({ status: s as DemandCompletionModel['status'] }))).toBe(s);
    }
  });
});
