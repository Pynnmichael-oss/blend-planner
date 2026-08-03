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

import { truckCountFor } from './truckCalc';

const BUTANE_RVP = 52;

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
  // Any positive butane requirement dispatches at least one truck (we
  // sometimes order less than a full 190 bbl load and still bring one
  // physical truck) — never rounds up beyond that, to avoid breaching the
  // RVP spec ceiling.
  const trucks = truckCountFor(butane_bbls);

  return {
    butane_bbls,
    trucks_min: trucks,
    trucks_max: trucks,
  };
}
