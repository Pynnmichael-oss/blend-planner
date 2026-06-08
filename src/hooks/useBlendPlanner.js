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
import { buildLiftingsGrid } from '../data/liftingsCurve';

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
    buildLiftingsGrid(fortWorthConfig, TODAY, 8)
  );
  const [receiptAllocations, setReceiptAllocations] = useState({});
  // Shape: "product-date-slot" → { primary: tankId, handoff: tankId|null, handoffVolume: number }
  const [rackTankAssignments, setRackTankAssignments] = useState({});
  const [parsedReceipts, setParsedReceipts] = useState(null);
  const [rvpValues,      setRvpValues]      = useState({});
  const [rvpConfirmed,   setRvpConfirmed]   = useState({});

  const terminalConfig = TERMINAL_CONFIGS[terminalId];

  const grid = useMemo(
    () => buildPlanGrid({
      terminalConfig, openingInventory, receipts, planDays, startDate,
      manualInputs, liftings, receiptAllocations, rackTankAssignments,
    }),
    [terminalConfig, openingInventory, receipts, planDays, startDate,
     manualInputs, liftings, receiptAllocations, rackTankAssignments],
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

  function resetLiftings() {
    setLiftings(buildLiftingsGrid(terminalConfig, startDate, planDays));
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
    toggleBlend, toggleIdle,
    setReceiptAllocation, setRackTank,
    parsedReceipts, setParsedReceipts,
    rvpValues, setRvpValues,
    rvpConfirmed, setRvpConfirmed,
  };
}
