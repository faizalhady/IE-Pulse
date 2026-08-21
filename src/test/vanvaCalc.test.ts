/**
 * The one check that fails if the VA/NVA derivations break.
 *
 * Every expectation is pinned to a cell the workbook itself computed, so a
 * regression here means the dashboard has drifted from the source of truth.
 */

import { describe, expect, it } from 'vitest';

import {
  countable, nvaHistogram, plantTotals, reducibleDl, sizingPlan, sweepTarget, withMetricsAll,
} from '@/lib/va_nva/vanvaCalc';
import { SHEET1_ROWS } from '@/pages/vanva/mockVaNvaData';
import type { VaNvaRow } from '@/pages/vanva/types';

const rows = withMetricsAll(SHEET1_ROWS);
const byId = (id: string) => rows.find(r => r.id === id)!;

describe('vanvaCalc — matches the workbook', () => {
  it('reproduces ARISTANETWORKS (row 14: H=450, M=54.67%, P=90, Q=156)', () => {
    const r = byId('aristanetworks');
    expect(r.overallRound).toBe(450);
    expect(r.nvaRatio).toBeCloseTo(0.5466666, 6);
    expect(r.nvaTarget).toBeCloseTo(90, 6);
    expect(r.toReduce).toBeCloseTo(156, 6);
  });

  it('reproduces COLLINS decimals (row 20: H=12.4, I=9.1, Q=1.52)', () => {
    const r = byId('collins');
    expect(r.overallRound).toBeCloseTo(12.4, 6);
    expect(r.overallDecimal).toBeCloseTo(9.1, 6);
    expect(r.toReduce).toBeCloseTo(1.52, 6);
  });

  it('returns null — not 0% — where the workbook has no NVA MFG', () => {
    // Workbook M9/M10/M15/M16 print 0%, which reads as "perfectly lean".
    expect(byId('lam-gas-box-weldment').nvaRatio).toBeNull();
    expect(byId('keysight-pca').nvaRatio).toBeNull();
    expect(byId('lam-gas-box-weldment').status).toBe('unknown');
  });

  it('excludes rollup children and the AOP plan row from totals', () => {
    const ids = countable(rows).map(r => r.id);
    expect(ids).not.toContain('lam-gas-box-weldment');
    expect(ids).not.toContain('keysight-hla');
    expect(ids).not.toContain('aop-overall');
    expect(ids).toContain('lam-gas-box');
    expect(ids).toContain('keysight');
  });

  it('weights the plant NVA % by headcount, not by workcell', () => {
    const t = plantTotals(rows);
    // Sum of the countable rows, computed independently of the helper.
    const va = countable(rows).reduce((s, r) => s + (r.vaSizingRound ?? 0), 0);
    const nva = countable(rows).reduce((s, r) => s + (r.nvaMfg ?? 0), 0);
    expect(t.vaSizing).toBeCloseTo(va, 6);
    expect(t.nvaMfg).toBeCloseTo(nva, 6);
    expect(t.nvaRatio).toBeCloseTo(nva / (va + nva), 6);
    expect(t.vaRatio + t.nvaRatio).toBeCloseTo(1, 6);
  });

  it('counts only positive gaps as reducible DL', () => {
    // WABTEC is under 20% already (Q = −3.2) and must not offset ARISTA.
    expect(byId('wabtec').toReduce!).toBeLessThan(0);
    const positives = countable(rows).reduce((s, r) => s + Math.max(r.toReduce ?? 0, 0), 0);
    expect(reducibleDl(rows)).toBeCloseTo(positives, 6);
    expect(reducibleDl(rows)).toBeGreaterThan(0);
  });

  it('sweeps the target monotonically without float drift', () => {
    const sweep = sweepTarget(SHEET1_ROWS);
    expect(sweep[0].target).toBe(0.05);
    expect(sweep[sweep.length - 1].target).toBe(0.5);
    for (let i = 1; i < sweep.length; i++) {
      expect(sweep[i].reducible).toBeLessThanOrEqual(sweep[i - 1].reducible);
    }
  });

  it('buckets every measured workcell exactly once', () => {
    const hist = nvaHistogram(rows);
    const measuredCount = countable(rows).filter(r => r.nvaRatio !== null).length;
    expect(hist.reduce((s, b) => s + b.count, 0)).toBe(measuredCount);
  });
});

describe('sizingPlan', () => {
  const row = (id: string, va: number, nva: number): VaNvaRow => ({
    id, workcell: id, role: 'workcell',
    vaSizingRound: va, vaSizingDecimal: va, vaActual: va, crew: 1,
    nvaPpqt: nva, nvaMfg: nva,
  });

  it('matches the worked example: VA 5 + NVA 5 at 20% reduces by 3', () => {
    const p = sizingPlan(withMetricsAll([row('A', 5, 5)]), 0.2);
    expect(p.rows[0].nvaTarget).toBe(2);      // 10 * 0.20
    expect(p.rows[0].delta).toBe(3);          // 5 - 2
    expect(p.rows[0].reduce).toBe(3);
    expect(p.rows[0].add).toBe(0);
  });

  it('reports where the plan ACTUALLY lands, which is not the target', () => {
    // The known consequence of taking the target as a share of TODAY's total:
    // 5 VA + 2 NVA = 7, and 2/7 is 28.6%, not 20%. If this ever reads 20% the
    // formula has been switched and the tracker will disagree with this page.
    const p = sizingPlan(withMetricsAll([row('A', 5, 5)]), 0.2);
    expect(p.projectedRatio).toBeCloseTo(2 / 7, 5);
    expect(p.projectedRatio).not.toBeCloseTo(0.2, 3);
  });

  it('a workcell under target ADDS heads, it does not contribute 0', () => {
    // VA 9 + NVA 1 = 10, target 2 -> delta -1, so it can absorb one more.
    const p = sizingPlan(withMetricsAll([row('A', 9, 1)]), 0.2);
    expect(p.rows[0].delta).toBe(-1);
    expect(p.rows[0].reduce).toBe(0);
    expect(p.rows[0].add).toBe(1);
    expect(p.totalAdd).toBe(1);
  });

  it('rounds every head UP, in both directions', () => {
    // VA 5 + NVA 4 = 9, target 1.8 -> delta 2.2 -> 3 heads, never 2.
    const p = sizingPlan(withMetricsAll([row('A', 5, 4)]), 0.2);
    expect(p.rows[0].delta).toBeCloseTo(2.2, 5);
    expect(p.rows[0].reduce).toBe(3);
  });

  it('skips child and aggregate rows so nothing is counted twice', () => {
    const rows: VaNvaRow[] = [
      row('parent', 10, 10),
      { ...row('kid', 4, 4), role: 'child', parentId: 'parent' },
      { ...row('plan', 100, 100), role: 'aggregate' },
    ];
    const p = sizingPlan(withMetricsAll(rows), 0.2);
    expect(p.rows).toHaveLength(1);
    expect(p.rows[0].id).toBe('parent');
  });
});
