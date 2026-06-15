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
  const currentRackTank    = {}; // productKey → tankId
  const currentReceiptTank = {}; // productKey → tankId
  const lastRackedTank     = {}; // productKey → tankId
  const batchReceiptTank   = {}; // batchCode → tankId
  const result = [];

  for (const date of dates) {
    for (const timeSlot of TIME_SLOTS) {
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
                (batchTankConfig.safeFill - (lastPeriod[batchTank]?.closingInventory ??
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
              (t.safeFill - (lastPeriod[t.id]?.closingInventory ??
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
                  const space    = t.safeFill - (lastPeriod[t.id]?.closingInventory ?? openingMap[t.id]?.pumpable ?? 0);
                  const bestTank = product.tanks.find(t2 => t2.id === bestId);
                  const bestSpace = bestTank
                    ? bestTank.safeFill - (lastPeriod[bestId]?.closingInventory ?? openingMap[bestId]?.pumpable ?? 0)
                    : -Infinity;
                  return space > bestSpace ? t.id : bestId;
                }, null);
              }
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
          const current = currentRackTank[productKey];
          const currentStillValid = current && product.tanks.some(t =>
            t.id === current &&
            !manualInputs[`${t.id}-${date}-${timeSlot}`]?.blendActive &&
            (lastPeriod[current]?.closingInventory ?? openingMap[current]?.pumpable ?? 0) >
              (product.tanks.find(t => t.id === current)?.heel ?? 0)
          );

          if (currentStillValid) {
            primaryRackId = current;
          } else {
            // rack auto-select: highest RVP first (most finished product ships,
            // raw product stays) — per blend spec
            const nonBlending = product.tanks.filter(t =>
              !manualInputs[`${t.id}-${date}-${timeSlot}`]?.blendActive &&
              (lastPeriod[t.id]?.closingInventory ?? openingMap[t.id]?.pumpable ?? 0) >
                (t.heel ?? 0)
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

          const receiptVolume  = tankReceipts.reduce((s, r) => s + r.volume, 0);
          const isManualIdle   = manual.idle ?? false;
          const hasConflict    = blendActive && (receiptVolume > 0 || isRackTank);

          // safeFill cap — spill to next available tank per Kelly spec
          const spaceAvailable = Math.max(0, tank.safeFill - opening - rackLoadings);
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
                   (t.safeFill - (lastPeriod[t.id]?.closingInventory ?? openingMap[t.id]?.pumpable ?? 0)) > 0
            );
            if (nextTank) (receiptAssignment[nextTank.id] ??= []).push({ volume: spillVolume, rvp: spillRvp });
          }

          const closingInventory = opening + cappedReceipts + rackLoadings;

          const closingRVP = calcClosingRVP({
            openingRVP,
            openingVolume: opening,
            heel: tank.heel,
            receipts: cappedTankReceipts,
          });

          const fillPct = closingInventory / tank.safeFill;
          const space   = tank.safeFill - closingInventory;

          // Status — derived only, never manually set
          const belowHeel = closingInventory < tank.heel;

          let status;
          if      (isManualIdle)                     status = "IDLE";
          else if (closingInventory > tank.safeFill)  status = "OVERFILL";
          else if (hasConflict)                       status = "CONFLICT";
          else if (blendActive)                       status = "BLEND";
          else {
            const onRack    = isRackTank && totalLifting !== 0;
            const onReceipt = cappedReceipts > 0;
            if      (onRack && onReceipt) status = "RACK+RCV";
            else if (onRack)              status = "RACK";
            else if (onReceipt)           status = "RECEIPT";
            else                          status = "IDLE";
          }
          if (belowHeel && status === 'IDLE') status = 'LOW';
          if (belowHeel && status === 'RACK') status = 'LOW';

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
            isManualIdle,
            manualIdle: isManualIdle,
            spillVolume,
            spillWarning: spillVolume > 0,
            belowHeel,
            heel: tank.heel,
            safeFill: tank.safeFill,
            conflictMessage: hasConflict
              ? "Pipeline receipt blocked — tank is blending. Reallocate this batch."
              : undefined,
          });

          lastPeriod[tank.id] = { closingInventory, closingRVP };
        }
      }
    }
  }

  // Post-blend pass: apply butane lump sum to first period after each blend run ends
  const byTank = {};
  for (const entry of result) (byTank[entry.tankId] ??= []).push(entry);

  const slotOrder = { "00-05": 0, "06-11": 1, "12-17": 2, "18-23": 3 };

  for (const entries of Object.values(byTank)) {
    entries.sort((a, b) => a.date !== b.date
      ? a.date < b.date ? -1 : 1
      : slotOrder[a.timeSlot] - slotOrder[b.timeSlot]);

    for (let i = 0; i < entries.length - 1; i++) {
      const curr = entries[i];
      const next = entries[i + 1];

      if (!curr.blendActive || next.blendActive) continue;

      const pumpableBeforeButane = curr.closingInventory;
      const heel = curr.heel ?? 0;
      const tov  = pumpableBeforeButane + heel;

      const rvpTarget = 8.75; // TODO: pull from terminalConfig.blendSpec
      const rvpActual = curr.closingRVP;
      const margin    = rvpTarget - rvpActual;

      if (margin <= 0) continue;

      const denominator = BUTANE_RVP - rvpTarget;
      const butane_bbls = denominator > 0 ? (margin * tov) / denominator : 0;
      const trucks       = Math.floor(butane_bbls / TRUCK_BBLS);
      const actualButane = trucks * TRUCK_BBLS;

      if (trucks === 0) continue;

      const blendedRVP = ((rvpActual * tov) + (BUTANE_RVP * actualButane)) / (tov + actualButane);

      const idx = result.indexOf(next);
      if (idx !== -1) {
        const updated = {
          ...next,
          openingInventory: next.openingInventory + actualButane,
          closingInventory: next.closingInventory + actualButane,
          openingRVP:  blendedRVP,
          closingRVP:  blendedRVP,
          fillPct:     (next.closingInventory + actualButane) / (next.safeFill ?? 1),
          space:       (next.safeFill ?? 0) - (next.closingInventory + actualButane),
          postBlendButane: actualButane,
          postBlendTrucks: trucks,
          postBlendRVP:    blendedRVP,
        };
        result[idx]     = updated;
        entries[i + 1]  = updated;
      }

      const currIdx = result.indexOf(curr);
      if (currIdx !== -1) {
        result[currIdx] = {
          ...curr,
          blendSummary: {
            estPumpable: pumpableBeforeButane,
            tov, rvpActual, rvpTarget,
            butane_bbls, trucks, actualButane, blendedRVP,
          },
        };
        entries[i] = result[currIdx];
      }
    }
  }

  return result;
}
