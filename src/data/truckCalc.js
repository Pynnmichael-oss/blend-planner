/**
 * Shared butane-truck resolution logic. Generic across terminals — do not
 * special-case any specific terminal id here.
 *
 * Standard truck capacity is 190 bbl. Any positive butane requirement gets
 * at least one truck; a truck ordered below full capacity still delivers
 * the exact requested volume (we sometimes order less than 190 bbl and
 * still bring one physical truck), rather than being rounded up to a full
 * load or rounded down to zero. At/above one full truck, the existing
 * truncate-to-whole-trucks behavior is unchanged.
 */

export const TRUCK_BBLS = 190;

/**
 * Resolves a single butane requirement into an actual delivered volume and
 * truck count.
 *
 * @param {number} butaneBbls
 * @param {number} [truckBbls]
 * @returns {{ trucks: number, actualButane: number }}
 */
export function resolveTruckLoad(butaneBbls, truckBbls = TRUCK_BBLS) {
  if (!(butaneBbls > 0)) return { trucks: 0, actualButane: 0 };

  const trucksFloor = Math.floor(butaneBbls / truckBbls);
  if (trucksFloor > 0) {
    // At/above one full truck: preserve existing truncate-to-whole-trucks
    // behavior (never rounds up, so blends never overshoot the RVP target).
    return { trucks: trucksFloor, actualButane: trucksFloor * truckBbls };
  }

  // Positive but below one full truck: one truck is still dispatched,
  // carrying the exact requested volume.
  return { trucks: 1, actualButane: butaneBbls };
}

/**
 * Truck count only, for callers (e.g. a min/max range display) that don't
 * need the resolved actual-delivered volume.
 *
 * @param {number|null} butaneBbls
 * @param {number} [truckBbls]
 * @returns {number|null} null when butaneBbls itself is null/undefined
 */
export function truckCountFor(butaneBbls, truckBbls = TRUCK_BBLS) {
  if (butaneBbls === null || butaneBbls === undefined) return null;
  if (!(butaneBbls > 0)) return 0;
  return Math.max(1, Math.floor(butaneBbls / truckBbls));
}

/**
 * Formats a truck count (or low/high range) for display.
 *
 * @param {number|null} trucks
 * @param {number|null} [trucksHigh] - if provided, formats as a range
 * @returns {string}
 */
export function formatTruckCount(trucks, trucksHigh) {
  if (trucks === null || trucks === undefined) return '—';
  if (trucksHigh !== undefined && trucksHigh !== null && trucksHigh !== trucks) {
    return `${trucks}-${trucksHigh} trucks`;
  }
  return trucks === 1 ? '1 truck' : `${trucks} trucks`;
}
