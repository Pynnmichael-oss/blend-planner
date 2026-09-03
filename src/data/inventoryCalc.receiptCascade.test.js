import { describe, it, expect } from 'vitest';
import { buildPlanGrid, MIN_PUMPABLE } from './inventoryCalc';

// Generic terminal config (not Fort Worth) — confirms the cascade isn't
// terminal-specific.
const START_DATE = '2026-04-16';

function twoTankConfig() {
  return {
    id: 'generic-test-terminal',
    products: {
      regular: {
        label: 'Regular',
        tanks: [
          { id: 'TK1', label: 'Tank 1', safeFill: 10000, heel: 0 },
          { id: 'TK2', label: 'Tank 2', safeFill: 10000, heel: 0 },
        ],
      },
    },
  };
}

function find(grid, tankId, timeSlot = '00-05') {
  return grid.find(e => e.tankId === tankId && e.timeSlot === timeSlot);
}

describe('receipt-assignment fallback — availSpace cap and co-receipt cascade', () => {
  it('caps the fallback-assigned tank at its availSpace instead of pushing it past pumpableMax', () => {
    const terminalConfig = twoTankConfig();
    // TK2 has more raw space than TK1, so the pre-existing "highest raw
    // space" fallback picks TK2 — but TK2's availSpace (below the
    // MIN_PUMPABLE buffer) is only 500, less than the 800 bbl receipt.
    const openingInventory = [
      { tankId: 'TK1', pumpable: 9200, rvp: 5 },  // avail = 10000-500-9200 = 300
      { tankId: 'TK2', pumpable: 9000, rvp: 5 },  // avail = 10000-500-9000 = 500
    ];
    const receipts = [{
      startDatetime: `${START_DATE}T00:00:00`,
      batchCode: 'TEST-CASCADE-1',
      supplier: 'TESTSUP',
      line: 'FM1',
      volume: 800,
      rate: 800, // lands entirely in the 00-05 window
      grade: 'X',
      product: 'regular',
      rvp: 5,
    }];

    const grid = buildPlanGrid({
      terminalConfig,
      openingInventory,
      receipts,
      planDays: 1,
      startDate: START_DATE,
    });

    const tk1 = find(grid, 'TK1');
    const tk2 = find(grid, 'TK2');

    // Neither tank breaches pumpableMax (10000).
    expect(tk1.closingInventory).toBeLessThanOrEqual(10000);
    expect(tk2.closingInventory).toBeLessThanOrEqual(10000);
    expect(tk1.spillWarning).toBe(false);
    expect(tk2.spillWarning).toBe(false);

    // TK2 (the selected fallback tank) takes only its availSpace (500 bbl),
    // landing exactly on the MIN_PUMPABLE buffer below safeFill.
    expect(tk2.closingInventory).toBeCloseTo(10000 - MIN_PUMPABLE, 6);
    // The remaining 300 bbl co-receipts onto TK1, the next-highest-availSpace
    // eligible tank, also landing exactly on its buffer.
    expect(tk1.closingInventory).toBeCloseTo(10000 - MIN_PUMPABLE, 6);
  });

  it('lets the last tank in the cascade take a true overflow when no tank has any availSpace left', () => {
    const terminalConfig = twoTankConfig();
    // Both tanks are already inside the MIN_PUMPABLE buffer (availSpace 0
    // on both), so the cascade has nowhere to route the receipt — it must
    // land on the tank it's stuck on rather than being silently dropped.
    const openingInventory = [
      { tankId: 'TK1', pumpable: 9950, rvp: 5 }, // avail = 0
      { tankId: 'TK2', pumpable: 9950, rvp: 5 }, // avail = 0
    ];
    const receipts = [{
      startDatetime: `${START_DATE}T00:00:00`,
      batchCode: 'TEST-CASCADE-2',
      supplier: 'TESTSUP',
      line: 'FM1',
      volume: 200,
      rate: 200,
      grade: 'X',
      product: 'regular',
      rvp: 5,
    }];

    const grid = buildPlanGrid({
      terminalConfig,
      openingInventory,
      receipts,
      planDays: 1,
      startDate: START_DATE,
    });

    // The overflow is not silently suppressed — it pushes the tank it
    // lands on to (or past) pumpableMax, which derives OVERFILL downstream,
    // exactly as the task calls for.
    const overfilled = find(grid, 'TK1').status === 'OVERFILL' || find(grid, 'TK2').status === 'OVERFILL';
    expect(overfilled).toBe(true);
  });
});
