/**
 * Reads the FuelsManager snapshot shared with the terminal-blending-dashboard
 * via localStorage, because both apps deploy as GitHub Pages project sites
 * under the same pynnmichael-oss.github.io origin. The dashboard writes this
 * same key from two different paths that both produce the same shape:
 *   - a manual FuelsManager .xlsx confirm (assets/js/fuels-snapshot.js ->
 *     saveSnapshot())
 *   - its periodic live tank-feed sync (data/tanks.json ->
 *     syncLiveTankSnapshot()), which also stamps a `source` field
 *     (e.g. "SharePoint · Terminal Tank Readings")
 *
 * Shape on disk: { tanks: { [tankId]: { available, workingCap, product,
 * pulledAt, skippedBadRows, ... } | null }, confirmedAt, source? }. Tank ids
 * are already dashboard-side-mapped to Blend-Planner's own internal scheme
 * (e.g. "TK55"), so no further id translation is needed here.
 *
 * Pure module — does not touch parseFuelsManager.js or React state. Never
 * throws; any malformed/stale/unreadable snapshot logs a console.warn and
 * resolves to null so the caller can fall back to the manual upload path.
 */

export const SHARED_SNAPSHOT_KEY = 'gp_fuelsManagerSnapshot';

/**
 * @returns {{ inventoryByTank: { [tankId]: number }, confirmedAt: string|null,
 *   source: string|null } | null} `inventoryByTank` is pumpable bbls per tank,
 *   in the same shape handleFuelsManagerConfirm() already accepts from the
 *   manual FuelsManagerUpload path. `confirmedAt`/`source` describe when and
 *   how the dashboard last wrote this snapshot, for display only. Returns
 *   null if there's nothing usable.
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

  return {
    inventoryByTank,
    confirmedAt: typeof parsed.confirmedAt === 'string' ? parsed.confirmedAt : null,
    source: typeof parsed.source === 'string' ? parsed.source : null,
  };
}
