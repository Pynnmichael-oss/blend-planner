/**
 * Core state hook for the Blend Planner.
 * Owns all planner state and exposes actions to the UI.
 */

import { useState, useMemo } from 'react';
import fortWorthConfig from '../config/fort-worth.json';
import tampaConfig from '../config/tampa.json';
import { fortWorthOpeningInventory } from '../mock/fort-worth-inventory';
import { fortWorthReceipts } from '../mock/fort-worth-t4';
import { buildPlanGrid } from '../data/inventoryCalc';
import { buildLiftingsGridWithBase, DEFAULT_DAILY_BASE } from '../data/liftingsCurve';

const TERMINAL_CONFIGS = {
  'fort-worth': fortWorthConfig,
  'tampa': tampaConfig,
};

const TODAY = new Date().toISOString().slice(0, 10);

export default function useBlendPlanner() {
  const [terminalId,       setTerminalId]       = useState('fort-worth');
  const [startDate,        setStartDate]        = useState(TODAY);
  const [openingInventory, setOpeningInventory] = useState(fortWorthOpeningInventory);
  const [receipts,         setReceipts]         = useState(fortWorthReceipts);
  const [manualInputs,     setManualInputs]     = useState({});
  const [planDays,         setPlanDays]         = useState(8);
  const [liftings,         setLiftings]         = useState(() =>
    buildLiftingsGridWithBase(fortWorthConfig, TODAY, 8, DEFAULT_DAILY_BASE)
  );
  const [receiptAllocations, setReceiptAllocations] = useState({});
  // Shape: "product-date-slot" → { primary: tankId, handoff: tankId|null, handoffVolume: number }
  const [rackTankAssignments, setRackTankAssignments] = useState({});
  const [parsedReceipts, setParsedReceipts] = useState(null);
  const [rvpValues,      setRvpValues]      = useState({});
  const [rvpConfirmed,   setRvpConfirmed]   = useState({});
  // null = show all slots; when set, hides slots before this value on the first day only
  const [startSlot, setStartSlot] = useState(null);
  const [specCeiling, setSpecCeiling] = useState(9.0);
  const [blendTarget, setBlendTarget] = useState(8.75);

  const terminalConfig = TERMINAL_CONFIGS[terminalId];

  const grid = useMemo(
    () => buildPlanGrid({
      terminalConfig, openingInventory, receipts, planDays, startDate,
      manualInputs, liftings, receiptAllocations, rackTankAssignments,
      startSlot, specCeiling, blendTarget,
    }),
    [terminalConfig, openingInventory, receipts, planDays, startDate,
     manualInputs, liftings, receiptAllocations, rackTankAssignments,
     startSlot, specCeiling, blendTarget],
  );

  function toggleBlend(tankId, date, timeSlot) {
    const key = `${tankId}-${date}-${timeSlot}`;
    setManualInputs(prev => ({
      ...prev,
      [key]: { ...prev[key], blendActive: !prev[key]?.blendActive },
    }));
  }

  function toggleIdle(tankId, date, timeSlot) {
    const key = `${tankId}-${date}-${timeSlot}`;
    setManualInputs(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        idle: !prev[key]?.idle,
        blendActive: false,
      },
    }));
  }

  function toggleRack(tankId, date, timeSlot) {
    const key = `${tankId}-${date}-${timeSlot}`;
    setManualInputs(prev => {
      const current = prev[key]?.manualRack ?? false;
      const productKey = Object.entries(terminalConfig.products)
        .find(([, p]) => p.tanks.some(t => t.id === tankId))?.[0];
      const updated = { ...prev };
      if (productKey) {
        terminalConfig.products[productKey].tanks.forEach(t => {
          const k = `${t.id}-${date}-${timeSlot}`;
          if (updated[k]?.manualRack) {
            updated[k] = { ...updated[k], manualRack: false };
          }
        });
      }
      updated[key] = { ...updated[key], manualRack: !current };
      return updated;
    });
  }

  function resetLiftings() {
    setLiftings(buildLiftingsGridWithBase(terminalConfig, startDate, planDays, DEFAULT_DAILY_BASE));
    setRackTankAssignments({});
  }

  function setReceiptAllocation(batchCode, date, timeSlot, tankId, volume) {
    const key = `${batchCode}-${date}-${timeSlot}-${tankId}`;
    setReceiptAllocations(prev => ({ ...prev, [key]: volume }));
  }

  // Sets the primary + optional handoff rack tank for a product/period
  function setRackTank(product, date, timeSlot, primary, handoff = null, handoffVolume = 0) {
    const key = `${product}-${date}-${timeSlot}`;
    setRackTankAssignments(prev => ({
      ...prev,
      [key]: { primary, handoff, handoffVolume },
    }));
  }

  return {
    terminalId, terminalConfig, startDate,
    openingInventory, receipts, manualInputs,
    planDays, liftings, receiptAllocations, rackTankAssignments,
    grid,
    setTerminalId, setStartDate, setOpeningInventory, setReceipts,
    setPlanDays, setLiftings, resetLiftings,
    toggleBlend, toggleIdle, toggleRack,
    setReceiptAllocation, setRackTank,
    parsedReceipts, setParsedReceipts,
    rvpValues, setRvpValues,
    rvpConfirmed, setRvpConfirmed,
    startSlot, setStartSlot,
    specCeiling, setSpecCeiling,
    blendTarget, setBlendTarget,
  };
}
