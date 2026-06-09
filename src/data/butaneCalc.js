/**
 * Butane demand calculator.
 * Solves the weighted-average RVP equation for the volume of butane required
 * to bring the current tank blend up to rvpTarget:
 *
 *   rvpTarget = (rvpActual × baseVol + BUTANE_RVP × B) / (baseVol + B)
 *   → B = (rvpTarget − rvpActual) × baseVol / (BUTANE_RVP − rvpTarget)
 *
 * baseVol = pumpable + heel (full working volume exposed to blend).
 */

const BUTANE_RVP = 52;
const TRUCK_BBLS = 190;

/**
 * @param {{ pumpable: number, heel: number, rvpTarget: number, rvpActual: number }}
 * @returns {{ butane_bbls: number, trucks_min: number, trucks_max: number }}
 */
export function calcButaneDemand({ pumpable, heel, rvpTarget, rvpActual }) {
  const baseVol    = pumpable + heel;
  const denominator = BUTANE_RVP - rvpTarget;

  if (rvpActual >= rvpTarget || denominator <= 0) {
    return { butane_bbls: 0, trucks_min: 0, trucks_max: 0 };
  }

  const butane_bbls = ((rvpTarget - rvpActual) * baseVol) / denominator;

  return {
    butane_bbls,
    trucks_min: Math.floor(butane_bbls / TRUCK_BBLS),
    trucks_max: Math.floor(butane_bbls / TRUCK_BBLS), // truncate both — rounding up risks breaching 9.0 ceiling
  };
}
