/**
 * Reads the FuelsManager snapshot confirmed on the terminal-blending-dashboard
 * (assets/js/fuels-snapshot.js -> saveSnapshot()), shared via localStorage
 * because both apps deploy as GitHub Pages project sites under the same
 * pynnmichael-oss.github.io origin.
 *
 * Shape on disk: { tanks: { [tankId]: { available, workingCap, product,
 * pulledAt, skippedBadRows } | null }, confirmedAt }. Tank ids are already
 * dashboard-side-mapped to Blend-Planner's own internal scheme (e.g. "TK55"),
 * so no further id translation is needed here.
 *
 * Pure module — does not touch parseFuelsManager.js or React state. Never
 * throws; any malformed/stale/unreadable snapshot logs a console.warn and
 * resolves to null so the caller can fall back to the manual upload path.
 */

export const SHARED_SNAPSHOT_KEY = 'gp_fuelsManagerSnapshot';

/**
 * @returns {{ [tankId]: number } | null} pumpable bbls per tank, in the same
 *   shape handleFuelsManagerConfirm() already accepts from the manual
 *   FuelsManagerUpload path — or null if there's nothing usable.
 */
export function readSharedFuelsManagerSnapshot() {
  let raw;
  try {
    raw = localStorage.getItem(SHARED_SNAPSHOT_KEY);
  } catch (err) {
    console.warn('[sharedFuelsManagerSnapshot] localStorage unavailable:', err);
    return null;
  }
  if (!raw) return null;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.warn('[sharedFuelsManagerSnapshot] could not parse shared snapshot, ignoring:', err);
    return null;
  }

  if (!parsed || typeof parsed !== 'object' || !parsed.tanks || typeof parsed.tanks !== 'object') {
    console.warn('[sharedFuelsManagerSnapshot] shared snapshot has an unexpected shape, ignoring.');
    return null;
  }

  const inventoryByTank = {};
  for (const [tankId, entry] of Object.entries(parsed.tanks)) {
    if (!entry || typeof entry !== 'object') continue; // tank present but no valid reading (dashboard writes null)
    const available = Number(entry.available);
    if (!Number.isFinite(available) || available <= 0) continue;
    inventoryByTank[tankId] = available;
  }

  if (Object.keys(inventoryByTank).length === 0) {
    console.warn('[sharedFuelsManagerSnapshot] shared snapshot had no usable tank readings, ignoring.');
    return null;
  }

  return inventoryByTank;
}
