/**
 * Core inventory calculation engine.
 * Builds the full grid of TimePeriod objects for all tanks across all days.
 * Pure function — no side effects.
 */

import { calcClosingRVP } from './rvpCalc';
import { distributeReceipts } from './distributeReceipts';

export const TIME_SLOTS = ["00-05", "06-11", "12-17", "18-23"];

const BUTANE_RVP = 52;
const TRUCK_BBLS = 190;

const SLOT_ORDER = { "00-05": 0, "06-11": 1, "12-17": 2, "18-23": 3 };

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
  startSlot = null,
  specCeiling = 9.0,
  blendTarget = 8.75,
  transfers = {},
}) {
  // Inventory tracked as pumpable barrels above heel throughout.
  // heel is added back only for TOV in blend calculations.
  // Display: 0 = at heel, safeFill-heel = full pumpable capacity.

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

  const lastPeriod = {}; // tankId → { closingInventory (pumpable above heel), closingRVP, blendActive }
  const currentRackTank    = {}; // productKey → tankId
  const currentReceiptTank = {}; // productKey → tankId
  const lastRackedTank     = {}; // productKey → tankId
  const batchReceiptTank   = {}; // batchCode → tankId
  const lastResultIdx      = {}; // tankId → index of its most recent result entry
  const result = [];

  for (const date of dates) {
    for (const timeSlot of TIME_SLOTS) {

      // Skip slots before startSlot on the first day only
      if (date === dates[0] && startSlot !== null && SLOT_ORDER[timeSlot] < SLOT_ORDER[startSlot]) {
        for (const [, product] of Object.entries(terminalConfig.products)) {
          for (const tank of product.tanks) {
            lastPeriod[tank.id] = {
              closingInventory: openingMap[tank.id]?.pumpable ?? 0,
              closingRVP: openingMap[tank.id]?.rvp ?? 0,
            };
          }
        }
        continue;
      }

      for (const [productKey, product] of Object.entries(terminalConfig.products)) {

        // ── Receipt assignment for this product/period ─────────────────
        // TODO: default allocation — refine per Kelly
        const receiptAssignment = {}; // tankId → [{ volume, rvp, batchCode }]

        for (const receipt of receipts.filter(r => r.product === productKey)) {
          const slices = distributeReceipts([receipt], date, timeSlot);
          if (!slices.length) continue;
          const { volume: sliceVol, rvp, batchCode } = slices[0];

          const hasAlloc = product.tanks.some(
            t => receiptAllocations[`${receipt.batchCode}-${date}-${timeSlot}-${t.id}`] !== undefined
          );

          if (hasAlloc) {
            for (const tank of product.tanks) {
              const vol = receiptAllocations[`${receipt.batchCode}-${date}-${timeSlot}-${tank.id}`] ?? 0;
              if (vol > 0) (receiptAssignment[tank.id] ??= []).push({ volume: vol, rvp, batchCode });
            }
            // Track which tank received this batch for future periods
            const allocTank = product.tanks.find(t =>
              (receiptAllocations[`${receipt.batchCode}-${date}-${timeSlot}-${t.id}`] ?? 0) > 0
            );
            if (allocTank) batchReceiptTank[receipt.batchCode] = allocTank.id;
            // If manually allocated receipt tank is the current rack tank,
            // move rack to the next highest-RVP non-receipt non-blending tank
            if (allocTank && allocTank.id === currentRackTank[productKey]) {
              const newRackPool = product.tanks.filter(t =>
                t.id !== allocTank.id &&
                !manualInputs[`${t.id}-${date}-${timeSlot}`]?.blendActive &&
                !manualInputs[`${t.id}-${date}-${timeSlot}`]?.idle &&
                (lastPeriod[t.id]?.closingInventory ??
                  openingMap[t.id]?.pumpable ?? 0) > 0
              );
              if (newRackPool.length > 0) {
                const newRack = newRackPool.reduce((bestId, t) => {
                  const rvp     = lastPeriod[t.id]?.closingRVP ?? openingMap[t.id]?.rvp ?? 0;
                  const bestRvp = lastPeriod[bestId]?.closingRVP ?? openingMap[bestId]?.rvp ?? 0;
                  return rvp > bestRvp ? t.id : bestId;
                }, newRackPool[0].id);
                currentRackTank[productKey] = newRack;
                // Note: lastRackedTank intentionally not updated here —
                // this is a conflict resolution handoff, not a completed rack
              }
            }
          } else {
            // batch sticks to assigned tank for its full duration
            // — rolls only if tank goes offline (blend/idle/full)
            let receiptTankId = currentReceiptTank[productKey];

            // Batch-level override: if this batch was previously assigned,
            // keep it on that tank unless it's blending, idle, or full
            const batchTank = batchReceiptTank[receipt.batchCode];
            if (batchTank) {
              const batchTankConfig = product.tanks.find(t => t.id === batchTank);
              const batchTankOk = batchTankConfig &&
                !manualInputs[`${batchTank}-${date}-${timeSlot}`]?.blendActive &&
                !manualInputs[`${batchTank}-${date}-${timeSlot}`]?.idle &&
                (batchTankConfig.safeFill - batchTankConfig.heel -
                  (lastPeriod[batchTank]?.closingInventory ??
                  openingMap[batchTank]?.pumpable ?? 0)) > 0;
              if (batchTankOk) receiptTankId = batchTank;
              // If batch tank is unavailable, fall through to carry-forward
              // logic and batchReceiptTank will be updated below
            }

            // Validate carry-forward tank: not blending, not manually idle, has space
            const receiptValid = receiptTankId && product.tanks.some(t =>
              t.id === receiptTankId &&
              !manualInputs[`${t.id}-${date}-${timeSlot}`]?.blendActive &&
              !manualInputs[`${t.id}-${date}-${timeSlot}`]?.idle &&
              (t.safeFill - t.heel - (lastPeriod[t.id]?.closingInventory ??
                openingMap[t.id]?.pumpable ?? 0)) > 0
            );

            if (!receiptValid) {
              // Roll to last-racked tank if available, else most space
              const candidate = lastRackedTank[productKey];
              const candidateOk = candidate && product.tanks.some(t =>
                t.id === candidate &&
                !manualInputs[`${t.id}-${date}-${timeSlot}`]?.blendActive &&
                !manualInputs[`${t.id}-${date}-${timeSlot}`]?.idle
              );
              if (candidateOk) {
                receiptTankId = candidate;
              } else {
                const pool = product.tanks.filter(t =>
                  !manualInputs[`${t.id}-${date}-${timeSlot}`]?.blendActive &&
                  !manualInputs[`${t.id}-${date}-${timeSlot}`]?.idle
                );
                receiptTankId = (pool.length ? pool : product.tanks).reduce((bestId, t) => {
                  const space    = (t.safeFill - t.heel) - (lastPeriod[t.id]?.closingInventory ?? openingMap[t.id]?.pumpable ?? 0);
                  const bestTank = product.tanks.find(t2 => t2.id === bestId);
                  const bestSpace = bestTank
                    ? (bestTank.safeFill - bestTank.heel) - (lastPeriod[bestId]?.closingInventory ?? openingMap[bestId]?.pumpable ?? 0)
                    : -Infinity;
                  return space > bestSpace ? t.id : bestId;
                }, null);
              }
            }
            // receipt defers to lowest-volume non-rack tank — per operator spec
            const rackTankForProduct = currentRackTank[productKey];
            if (receiptTankId === rackTankForProduct) {
              const nonRackPool = product.tanks.filter(t =>
                t.id !== rackTankForProduct &&
                !manualInputs[`${t.id}-${date}-${timeSlot}`]?.blendActive &&
                !manualInputs[`${t.id}-${date}-${timeSlot}`]?.idle &&
                (t.safeFill - t.heel - (lastPeriod[t.id]?.closingInventory ??
                  openingMap[t.id]?.pumpable ?? 0)) > 0
              );
              if (nonRackPool.length > 0) {
                // receipt goes to highest-space non-rack tank
                // lowest-volume was sending receipts to TK03 (swing tank)
                // when TK56 had more room
                receiptTankId = nonRackPool.reduce((bestId, t) => {
                  const space = (t.safeFill - t.heel) -
                    (lastPeriod[t.id]?.closingInventory ?? openingMap[t.id]?.pumpable ?? 0);
                  const bestSpace = (product.tanks.find(t2 => t2.id === bestId)?.safeFill ?? 0) -
                    (product.tanks.find(t2 => t2.id === bestId)?.heel ?? 0) -
                    (lastPeriod[bestId]?.closingInventory ?? openingMap[bestId]?.pumpable ?? 0);
                  return space > bestSpace ? t.id : bestId;
                }, nonRackPool[0].id);
              }
              // If nonRackPool is empty, fall through — rack tank receives as last resort (RACK+RCV status)
            }

            if (receiptTankId) batchReceiptTank[receipt.batchCode] = receiptTankId;
            if (receiptTankId) currentReceiptTank[productKey] = receiptTankId;
            if (receiptTankId) (receiptAssignment[receiptTankId] ??= []).push({ volume: sliceVol, rvp, batchCode });
          }
        }

        // ── Rack tank assignment: primary + optional handoff ──────────
        const periodKey    = `${productKey}-${date}-${timeSlot}`;
        const totalLifting = productPeriodLiftings[periodKey] ?? 0;
        const assignment   = rackTankAssignments[periodKey] ?? null;

        // rack persists until blend/heel forces handoff — per operator spec
        let primaryRackId = assignment?.primary ?? null;
        let handoffRackId = assignment?.handoff  ?? null;
        let handoffVolume = assignment?.handoffVolume ?? 0;

        // Determine rack tank for this period
        // Manual override takes precedence
        if (!primaryRackId) {
          // Cell-level RACK button: highest priority after rackTankAssignments
          const manualRackTank = product.tanks.find(t =>
            manualInputs[`${t.id}-${date}-${timeSlot}`]?.manualRack === true &&
            !manualInputs[`${t.id}-${date}-${timeSlot}`]?.blendActive
          );
          if (manualRackTank) primaryRackId = manualRackTank.id;
        }

        if (!primaryRackId) {
          // post-blend rack handoff: blended tank takes rack immediately
          // — it now carries the highest RVP and should ship first
          const justFinishedBlend = product.tanks.find(t => {
            const wasBlending = lastPeriod[t.id]?.blendActive === true;
            const nowBlending = manualInputs[`${t.id}-${date}-${timeSlot}`]?.blendActive === true;
            return wasBlending && !nowBlending;
          });

          if (justFinishedBlend) {
            // Post-blend: switch rack to the tank that just finished
            // It now has the highest RVP and is ready to ship
            currentRackTank[productKey] = justFinishedBlend.id;
            lastRackedTank[productKey]  = justFinishedBlend.id;
          }

          // Existing currentStillValid check follows unchanged
          const current = currentRackTank[productKey];
          const currentStillValid = current && product.tanks.some(t =>
            t.id === current &&
            !manualInputs[`${t.id}-${date}-${timeSlot}`]?.blendActive &&
            (lastPeriod[current]?.closingInventory ?? openingMap[current]?.pumpable ?? 0) > 0
          );

          if (currentStillValid) {
            primaryRackId = current;
          } else {
            // rack auto-select: highest RVP first (most finished product ships,
            // raw product stays) — per blend spec
            const nonBlending = product.tanks.filter(t =>
              !manualInputs[`${t.id}-${date}-${timeSlot}`]?.blendActive &&
              (lastPeriod[t.id]?.closingInventory ?? openingMap[t.id]?.pumpable ?? 0) > 0
            );
            const pool = nonBlending.length ? nonBlending : product.tanks;
            primaryRackId = pool.reduce((bestId, tank) => {
              const rvp     = lastPeriod[tank.id]?.closingRVP ?? openingMap[tank.id]?.rvp ?? 0;
              const bestRvp = lastPeriod[bestId]?.closingRVP  ?? openingMap[bestId]?.rvp  ?? 0;
              return rvp > bestRvp ? tank.id : bestId;
            }, pool[0]?.id ?? null);
          }
        }

        // Persist the selected rack tank for this product
        if (primaryRackId) currentRackTank[productKey] = primaryRackId;
        if (primaryRackId) lastRackedTank[productKey]  = primaryRackId;

        // Volume allocation: primary gets remainder, handoff gets its slice
        const clampedHandoff = Math.min(Math.abs(handoffVolume), Math.abs(totalLifting));
        const primaryVolume  = totalLifting + clampedHandoff;  // totalLifting is negative; clampedHandoff is positive sign adjustment
        // Simpler: primary = totalLifting - (-handoffVolume) = totalLifting + handoffVolume_magnitude
        // Actually: totalLifting is negative. handoffVolume is the portion assigned to handoff (also negative).
        // primary receives: totalLifting - handoffVolume  (less negative = smaller outbound)
        // handoff receives: handoffVolume
        const primaryLift = handoffRackId ? (totalLifting - handoffVolume) : totalLifting;
        const handoffLift = handoffRackId ? handoffVolume : 0;

        // ── Transfer in-map for this period ──────────────────────────
        const transferInMap = {};
        for (const [key, t] of Object.entries(transfers)) {
          const [fromId, tDate, tSlot] = key.split('|');
          if (tDate === date && tSlot === timeSlot && t?.volume > 0) {
            transferInMap[t.toTankId] = (transferInMap[t.toTankId] ?? 0) + t.volume;
          }
        }

        // ── Build one TimePeriod per tank ─────────────────────────────
        for (const tank of product.tanks) {
          const manualKey    = `${tank.id}-${date}-${timeSlot}`;
          const manual       = manualInputs[manualKey] ?? {};
          const prev         = lastPeriod[tank.id];
          // opening is already pumpable above heel — no adjustment needed
          const opening    = prev
            ? prev.closingInventory
            : (openingMap[tank.id]?.pumpable ?? 0);
          const openingRVP = prev ? prev.closingRVP : (openingMap[tank.id]?.rvp ?? 0);
          const tankReceipts = receiptAssignment[tank.id] ?? [];
          const blendActive  = manual.blendActive ?? false;

          // Determine this tank's rack role
          const isPrimary  = tank.id === primaryRackId && totalLifting !== 0;
          const isHandoff  = tank.id === handoffRackId && handoffRackId !== null;
          const isRackTank = isPrimary || isHandoff;

          const rackLoadings = isPrimary ? primaryLift
                             : isHandoff ? handoffLift
                             : 0;

          const receiptVolume  = tankReceipts.reduce((s, r) => s + r.volume, 0);
          const isManualIdle   = manual.idle ?? false;
          const hasConflict    = blendActive && (receiptVolume > 0 || isRackTank);

          // safeFill cap — spill to next available tank per Kelly spec
          const pumpableMax    = tank.safeFill - tank.heel;
          const spaceAvailable = Math.max(0, pumpableMax - opening - rackLoadings);
          const cappedReceipts = hasConflict ? 0 : Math.min(receiptVolume, spaceAvailable);
          const spillVolume    = hasConflict ? 0 : (receiptVolume - cappedReceipts);

          const cappedTankReceipts = spillVolume > 0 && receiptVolume > 0
            ? tankReceipts.map(r => ({ ...r, volume: r.volume * (cappedReceipts / receiptVolume) }))
            : (hasConflict ? [] : tankReceipts);

          if (spillVolume > 0) {
            const spillRvp = tankReceipts.reduce((s, r) => s + r.rvp * r.volume, 0) / receiptVolume;
            const nextTank = product.tanks.find(
              t => t.id !== tank.id &&
                   !manualInputs[`${t.id}-${date}-${timeSlot}`]?.blendActive &&
                   (t.safeFill - t.heel) - (lastPeriod[t.id]?.closingInventory ?? openingMap[t.id]?.pumpable ?? 0) > 0
            );
            if (nextTank) (receiptAssignment[nextTank.id] ??= []).push({ volume: spillVolume, rvp: spillRvp });
          }

          const transferOutVol = transfers[`${tank.id}|${date}|${timeSlot}`]?.volume ?? 0;
          const transferInVol  = transferInMap[tank.id] ?? 0;

          const pumpableClosing = Math.max(
            opening + cappedReceipts + rackLoadings - transferOutVol + transferInVol, 0
          );
          // opening is already pumpable above heel — no further heel subtraction needed

          let closingRVP = calcClosingRVP({
            openingRVP,
            openingVolume: opening,
            heel: tank.heel,
            receipts: cappedTankReceipts,
          });

          if (transferInVol > 0) {
            const sourceEntry = Object.entries(transfers).find(([k, t]) => {
              const [, tDate, tSlot] = k.split('|');
              return t?.toTankId === tank.id && tDate === date && tSlot === timeSlot;
            });
            const fromTankId = sourceEntry?.[0]?.split('|')[0];
            const sourceRVP  = lastPeriod[fromTankId]?.closingRVP ?? 0;
            if (fromTankId && sourceRVP > 0) {
              const baseVol    = opening + cappedReceipts;
              const blendedVol = baseVol + transferInVol;
              closingRVP = blendedVol > 0
                ? (closingRVP * baseVol + sourceRVP * transferInVol) / blendedVol
                : closingRVP;
            }
          }

          const fillPct = pumpableMax > 0 ? pumpableClosing / pumpableMax : 0;
          const space   = pumpableMax - pumpableClosing;

          // Status — derived only, never manually set
          let status;
          if      (isManualIdle)                      status = "IDLE";
          else if (pumpableClosing >= pumpableMax)    status = "OVERFILL";
          else if (hasConflict)                       status = "CONFLICT";
          else if (blendActive)                       status = "BLEND";
          else {
            const onRack    = isRackTank && totalLifting !== 0;
            const onReceipt = cappedReceipts > 0;
            if      (onRack && onReceipt) status = "CONFLICT";
            // Rack and receipt on same tank is now a conflict,
            // should only occur when no other tank is available
            else if (onRack)              status = "RACK";
            else if (onReceipt)           status = "RECEIPT";
            else                          status = "IDLE";
          }

          // Detect blend-end: previous period was blending, this one is not
          const wasBlending = prev?.blendActive === true;
          const isBlendEnd  = wasBlending && !blendActive;

          let extraFields = {};
          let lastPeriodOverride = null;

          if (isBlendEnd) {
            const tov            = prev.closingInventory + tank.heel;
            const rvpActualBlend = prev.closingRVP;
            const margin         = blendTarget - rvpActualBlend;
            if (margin > 0 && rvpActualBlend < specCeiling) {
              const denom       = BUTANE_RVP - blendTarget;
              const butane_bbls = denom > 0 ? (margin * tov) / denom : 0;
              const trucks      = Math.floor(butane_bbls / TRUCK_BBLS);
              const actualButane = trucks * TRUCK_BBLS;
              if (trucks > 0) {
                const blendedRVP = ((rvpActualBlend * tov) + (BUTANE_RVP * actualButane))
                  / (tov + actualButane);
                const newPumpable = Math.max(pumpableClosing + actualButane, 0);
                extraFields = {
                  openingInventory: opening + actualButane,
                  openingRVP:       blendedRVP,
                  closingInventory: newPumpable,
                  closingTOV:       newPumpable + tank.heel,
                  closingRVP:       blendedRVP,
                  fillPct:          pumpableMax > 0 ? newPumpable / pumpableMax : 0,
                  space:            pumpableMax - newPumpable,
                  postBlendButane:  actualButane,
                  postBlendTrucks:  trucks,
                  postBlendRVP:     blendedRVP,
                };
                lastPeriodOverride = {
                  closingInventory: newPumpable,
                  closingRVP:       blendedRVP,
                  blendActive:      false,
                };
                // Attach blendSummary to the last blending period's result entry
                const prevIdx = lastResultIdx[tank.id];
                if (prevIdx !== undefined) {
                  result[prevIdx] = {
                    ...result[prevIdx],
                    blendSummary: {
                      estPumpable: prev.closingInventory,
                      tov, rvpActual: rvpActualBlend, rvpTarget: blendTarget,
                      butane_bbls, trucks, actualButane, blendedRVP,
                    },
                  };
                }
              }
            }
          }

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
            closingInventory: pumpableClosing,
            closingTOV: pumpableClosing + tank.heel,
            closingRVP,
            fillPct,
            space,
            status,
            isManualIdle,
            manualIdle: isManualIdle,
            manualRack: manual.manualRack ?? false,
            transferOutVol,
            transferInVol,
            spillVolume,
            spillWarning: spillVolume > 0,
            belowHeel: false,
            heel: tank.heel,
            safeFill: tank.safeFill,
            conflictMessage: hasConflict
              ? "Pipeline receipt blocked — tank is blending. Reallocate this batch."
              : undefined,
            ...extraFields,
          });

          lastPeriod[tank.id] = { closingInventory: pumpableClosing, closingRVP, blendActive };
          if (lastPeriodOverride) {
            lastPeriod[tank.id] = lastPeriodOverride;
            lastPeriodOverride = null;
          }
          lastResultIdx[tank.id] = result.length - 1;
        }
      }
    }
  }

  return result;
}
