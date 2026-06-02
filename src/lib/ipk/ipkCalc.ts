/**
 * ipkCalc.ts
 * ───────────
 * Pure client-side IPK calculation. Shared by:
 *   - IPKSimulate Tab C (Manual / Calculator mode — live results)
 *   - IPKResults expandable breakdown rows (step-by-step display)
 *
 * The 4 calculation steps (per process group):
 *   1. Effective UPH = (3600 / CT) × FPY × EFF × Conv% × Machines
 *   2. IPK units     = (UPH↑ − UPH↓) × (Loading / UPH↑)
 *   3. WIP + buffer  = FLOOR(IPK × (1 + buffer))
 *   4. Trolleys      = CEIL(WIP / boardsPerTrolley)
 *
 * All inputs are plain numbers so the same helper backs both the mock data
 * pipeline and the interactive calculator without an API roundtrip.
 */

export interface IPKCalcInput {
  bottleneckCtSec: number;   // bottleneck cycle time, seconds
  fpy: number;               // first-pass yield, 0..1
  efficiency: number;        // line efficiency, 0..1
  conversionPct: number;     // conversion factor, 0..1
  qtyEquipment: number;      // machines / stations
  loadingQty: number;        // demand for the period
  uphUpstream: number;       // effective UPH of upstream group (UPH↑)
  uphDownstream: number;     // effective UPH of this group's drain (UPH↓)
  bufferPct: number;         // non-occupancy buffer, e.g. 0.15
  boardsPerTrolley: number;  // conversion to trolleys
}

export interface IPKCalcResult {
  effectiveUph: number;   // step 1 (1 decimal)
  ipkUnits: number;       // step 2 (rounded)
  wipWithBuffer: number;  // step 3 (floored)
  ipkTrolleys: number;    // step 4 (ceiled)
}

/** Step 1 — effective units-per-hour at the bottleneck. */
export function effectiveUph(i: Pick<IPKCalcInput,
  'bottleneckCtSec' | 'fpy' | 'efficiency' | 'conversionPct' | 'qtyEquipment'>): number {
  if (i.bottleneckCtSec <= 0) return 0;
  const raw = 3600 / i.bottleneckCtSec;
  return raw * i.fpy * i.efficiency * i.conversionPct * (i.qtyEquipment || 1);
}

/** Full 4-step calculation for one process group. */
export function calcIPK(i: IPKCalcInput): IPKCalcResult {
  const uph = effectiveUph(i);

  // Step 2 — IPK units. Drains to zero if there's no upstream throughput or
  // upstream ≤ downstream (no buffer accumulates).
  const delta = i.uphUpstream - i.uphDownstream;
  const ipkUnitsRaw =
    i.uphUpstream > 0 && delta > 0
      ? delta * (i.loadingQty / i.uphUpstream)
      : 0;
  const ipkUnits = Math.round(ipkUnitsRaw);

  // Step 3 — WIP with non-occupancy buffer.
  const wipWithBuffer = Math.floor(ipkUnits * (1 + i.bufferPct));

  // Step 4 — convert to trolleys.
  const ipkTrolleys =
    i.boardsPerTrolley > 0 ? Math.ceil(wipWithBuffer / i.boardsPerTrolley) : 0;

  return {
    effectiveUph: Number(uph.toFixed(1)),
    ipkUnits,
    wipWithBuffer,
    ipkTrolleys,
  };
}

/** Total trolleys required for a group = IPK + in/out + reject + on-hold. */
export function totalRequired(r: {
  ipkTrolleys: number;
  inOutTrolleys: number;
  rejectTrolleys: number;
  onHoldTrolleys: number;
}): number {
  return r.ipkTrolleys + r.inOutTrolleys + r.rejectTrolleys + r.onHoldTrolleys;
}
