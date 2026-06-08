/**
 * Core inventory calculation engine.
 * Builds the full grid of TimePeriod objects for all tanks across all days.
 * Pure function — no side effects.
 */

import { calcClosingRVP } from './rvpCalc';
import { distributeReceipts } from './distributeReceipts';

export const TIME_SLOTS = ["00-05", "06-11", "12-17", "18-23"];

// startDate anchors the grid — no longer derived from receipts.
export function buildDateList(startDate, planDays) {
  const dates = [];
  for (let i = 0; i < planDays; i++) {
    const d = new Date(startDate + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

export function buildPlanGrid({
  terminalConfig,
  openingInventory,
  receipts,
  planDays = 8,
  startDate,
  manualInputs = {},
  liftings = [],
  receiptAllocations = {},
  // Shape: "product-date-slot" → { primary: tankId, handoff: tankId|null, handoffVolume: number }
  rackTankAssignments = {},
}) {
  const dates = buildDateList(startDate, planDays);
  const openingMap = Object.fromEntries(openingInventory.map(t => [t.tankId, t]));

  // Tank → product lookup
  const tankToProduct = {};
  for (const [pk, product] of Object.entries(terminalConfig.products))
    for (const tank of product.tanks) tankToProduct[tank.id] = pk;

  // Pre-aggregate liftings to product/period totals
  const productPeriodLiftings = {};
  for (const l of liftings) {
    const pk = tankToProduct[l.tankId];
    if (!pk) continue;
    const key = `${pk}-${l.date}-${l.timeSlot}`;
    productPeriodLiftings[key] = (productPeriodLiftings[key] ?? 0) + l.volume;
  }

  const lastPeriod = {}; // tankId → { closingInventory, closingRVP }
  const result = [];

  for (const date of dates) {
    for (const timeSlot of TIME_SLOTS) {
      for (const [productKey, product] of Object.entries(terminalConfig.products)) {

        // ── Receipt assignment for this product/period ─────────────────
        // TODO: default allocation — refine per Kelly
        const receiptAssignment = {}; // tankId → [{ volume, rvp }]

        for (const receipt of receipts.filter(r => r.product === productKey)) {
          const slices = distributeReceipts([receipt], date, timeSlot);
          if (!slices.length) continue;
          const { volume: sliceVol, rvp } = slices[0];

          const hasAlloc = product.tanks.some(
            t => receiptAllocations[`${receipt.batchCode}-${date}-${timeSlot}-${t.id}`] !== undefined
          );

          if (hasAlloc) {
            for (const tank of product.tanks) {
              const vol = receiptAllocations[`${receipt.batchCode}-${date}-${timeSlot}-${tank.id}`] ?? 0;
              if (vol > 0) (receiptAssignment[tank.id] ??= []).push({ volume: vol, rvp });
            }
          } else {
            // Phase 1 fallback: first non-blending tank
            const assignTank =
              product.tanks.find(t => !manualInputs[`${t.id}-${date}-${timeSlot}`]?.blendActive)
              ?? product.tanks[0];
            if (assignTank) (receiptAssignment[assignTank.id] ??= []).push({ volume: sliceVol, rvp });
          }
        }

        // ── Rack tank assignment: primary + optional handoff ──────────
        const periodKey    = `${productKey}-${date}-${timeSlot}`;
        const totalLifting = productPeriodLiftings[periodKey] ?? 0;
        const assignment   = rackTankAssignments[periodKey] ?? null;

        let primaryRackId  = assignment?.primary  ?? null;
        let handoffRackId  = assignment?.handoff  ?? null;
        let handoffVolume  = assignment?.handoffVolume ?? 0;

        // Auto-select primary if none designated and demand exists
        if (!primaryRackId && totalLifting !== 0) {
          // TODO: Kelly — confirm auto-select logic
          const nonBlending = product.tanks.filter(
            t => !manualInputs[`${t.id}-${date}-${timeSlot}`]?.blendActive
          );
          const pool = nonBlending.length ? nonBlending : product.tanks;
          primaryRackId = pool.reduce((bestId, tank) => {
            const rvp     = lastPeriod[tank.id]?.closingRVP ?? openingMap[tank.id]?.rvp ?? 0;
            const bestRvp = lastPeriod[bestId]?.closingRVP  ?? openingMap[bestId]?.rvp  ?? 0;
            return rvp > bestRvp ? tank.id : bestId;
          }, pool[0]?.id ?? null);
        }

        // Volume allocation: primary gets remainder, handoff gets its slice
        const clampedHandoff = Math.min(Math.abs(handoffVolume), Math.abs(totalLifting));
        const primaryVolume  = totalLifting + clampedHandoff;  // totalLifting is negative; clampedHandoff is positive sign adjustment
        // Simpler: primary = totalLifting - (-handoffVolume) = totalLifting + handoffVolume_magnitude
        // Actually: totalLifting is negative. handoffVolume is the portion assigned to handoff (also negative).
        // primary receives: totalLifting - handoffVolume  (less negative = smaller outbound)
        // handoff receives: handoffVolume
        const primaryLift = handoffRackId ? (totalLifting - handoffVolume) : totalLifting;
        const handoffLift = handoffRackId ? handoffVolume : 0;

        // ── Build one TimePeriod per tank ─────────────────────────────
        for (const tank of product.tanks) {
          const manualKey    = `${tank.id}-${date}-${timeSlot}`;
          const manual       = manualInputs[manualKey] ?? {};
          const prev         = lastPeriod[tank.id];
          const opening      = prev ? prev.closingInventory : (openingMap[tank.id]?.pumpable ?? 0);
          const openingRVP   = prev ? prev.closingRVP       : (openingMap[tank.id]?.rvp      ?? 0);
          const tankReceipts = receiptAssignment[tank.id] ?? [];
          const blendActive  = manual.blendActive ?? false;

          // Determine this tank's rack role
          const isPrimary  = tank.id === primaryRackId && totalLifting !== 0;
          const isHandoff  = tank.id === handoffRackId && handoffRackId !== null;
          const isRackTank = isPrimary || isHandoff;

          const rackLoadings = isPrimary ? primaryLift
                             : isHandoff ? handoffLift
                             : 0;

          const receiptVolume = tankReceipts.reduce((s, r) => s + r.volume, 0);
          const hasConflict   = blendActive && receiptVolume > 0;

          const closingInventory = opening + (hasConflict ? 0 : receiptVolume) + rackLoadings;

          const closingRVP = calcClosingRVP({
            openingRVP,
            openingVolume: opening,
            heel: tank.heel,
            receipts: hasConflict ? [] : tankReceipts,
          });

          const fillPct = closingInventory / tank.safeFill;
          const space   = tank.safeFill - closingInventory;

          // Status — derived only, never manually set
          let status;
          if      (hasConflict)       status = "CONFLICT";
          else if (blendActive)       status = "BLEND";
          else if (receiptVolume > 0) status = "RECEIPT";
          else if (isRackTank)        status = "RACK";
          else                        status = "IDLE";

          result.push({
            tankId: tank.id,
            productKey,
            date,
            timeSlot,
            openingInventory: opening,
            openingRVP,
            receipts: tankReceipts,
            rackLoadings,
            blendActive,
            closingInventory,
            closingRVP,
            fillPct,
            space,
            status,
            conflictMessage: hasConflict
              ? "Pipeline receipt blocked — tank is blending. Reallocate this batch."
              : undefined,
          });

          lastPeriod[tank.id] = { closingInventory, closingRVP };
        }
      }
    }
  }

  return result;
}
