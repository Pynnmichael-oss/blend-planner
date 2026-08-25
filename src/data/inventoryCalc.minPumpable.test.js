import { describe, it, expect, vi } from 'vitest';
import { buildPlanGrid } from './inventoryCalc';

// Generic terminal config (not Fort Worth) -- confirms the cascade isn't
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

describe('MIN_PUMPABLE floor — same-period cascade', () => {
  it('splits rack draw across two tanks in the same period when the primary would breach the 500 bbl floor', () => {
    const terminalConfig = twoTankConfig();
    const openingInventory = [
      { tankId: 'TK1', pumpable: 1000, rvp: 5 },
      { tankId: 'TK2', pumpable: 5000, rvp: 3 },
    ];
    const liftings = [
      { tankId: 'TK1', date: START_DATE, timeSlot: '00-05', volume: -800 },
    ];
    const rackTankAssignments = {
      [`regular-${START_DATE}-00-05`]: { primary: 'TK1', handoff: null, handoffVolume: 0 },
    };

    const grid = buildPlanGrid({
      terminalConfig,
      openingInventory,
      receipts: [],
      planDays: 1,
      startDate: START_DATE,
      liftings,
      rackTankAssignments,
    });

    const tk1 = find(grid, 'TK1');
    const tk2 = find(grid, 'TK2');

    // TK1 draws down to exactly the 500 bbl floor, not below.
    expect(tk1.rackLoadings).toBeCloseTo(-500, 6);
    expect(tk1.closingInventory).toBeCloseTo(500, 6);
    expect(tk1.status).toBe('RACK');

    // The remaining 300 bbl of demand cascades to TK2 in the SAME period.
    expect(tk2.rackLoadings).toBeCloseTo(-300, 6);
    expect(tk2.closingInventory).toBeCloseTo(4700, 6);
    expect(tk2.status).toBe('RACK');
  });

  it('does not cascade when the primary tank has enough room above the floor', () => {
    const terminalConfig = twoTankConfig();
    const openingInventory = [
      { tankId: 'TK1', pumpable: 5000, rvp: 5 },
      { tankId: 'TK2', pumpable: 5000, rvp: 3 },
    ];
    const liftings = [
      { tankId: 'TK1', date: START_DATE, timeSlot: '00-05', volume: -800 },
    ];
    const rackTankAssignments = {
      [`regular-${START_DATE}-00-05`]: { primary: 'TK1', handoff: null, handoffVolume: 0 },
    };

    const grid = buildPlanGrid({
      terminalConfig,
      openingInventory,
      receipts: [],
      planDays: 1,
      startDate: START_DATE,
      liftings,
      rackTankAssignments,
    });

    const tk1 = find(grid, 'TK1');
    const tk2 = find(grid, 'TK2');

    expect(tk1.closingInventory).toBeCloseTo(4200, 6);
    expect(tk2.rackLoadings).toBe(0);
    expect(tk2.closingInventory).toBeCloseTo(5000, 6);
  });

  it('excludes a blending tank from receiving cascaded rack draw', () => {
    const terminalConfig = twoTankConfig();
    const openingInventory = [
      { tankId: 'TK1', pumpable: 1000, rvp: 5 },
      { tankId: 'TK2', pumpable: 5000, rvp: 3 },
    ];
    const liftings = [
      { tankId: 'TK1', date: START_DATE, timeSlot: '00-05', volume: -800 },
    ];
    const rackTankAssignments = {
      [`regular-${START_DATE}-00-05`]: { primary: 'TK1', handoff: null, handoffVolume: 0 },
    };
    const manualInputs = {
      [`TK2-${START_DATE}-00-05`]: { blendActive: true },
    };

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const grid = buildPlanGrid({
      terminalConfig,
      openingInventory,
      receipts: [],
      planDays: 1,
      startDate: START_DATE,
      liftings,
      rackTankAssignments,
      manualInputs,
    });

    const tk1 = find(grid, 'TK1');
    const tk2 = find(grid, 'TK2');

    // TK1 still caps at the floor; TK2 is blending so it can't absorb the
    // cascade — total rack output is capped, not crashed.
    expect(tk1.closingInventory).toBeCloseTo(500, 6);
    expect(tk2.rackLoadings).toBe(0);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('caps total rack output and warns when no eligible tank has room left', () => {
    const terminalConfig = {
      id: 'generic-test-terminal',
      products: {
        regular: {
          label: 'Regular',
          tanks: [{ id: 'TK1', label: 'Tank 1', safeFill: 10000, heel: 0 }],
        },
      },
    };
    const openingInventory = [{ tankId: 'TK1', pumpable: 600, rvp: 5 }];
    const liftings = [
      { tankId: 'TK1', date: START_DATE, timeSlot: '00-05', volume: -800 },
    ];
    const rackTankAssignments = {
      [`regular-${START_DATE}-00-05`]: { primary: 'TK1', handoff: null, handoffVolume: 0 },
    };

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const grid = buildPlanGrid({
      terminalConfig,
      openingInventory,
      receipts: [],
      planDays: 1,
      startDate: START_DATE,
      liftings,
      rackTankAssignments,
    });

    const tk1 = find(grid, 'TK1');

    // Only 100 bbl of headroom exists above the 500 floor — the rest of the
    // 800 bbl demand is undeliverable and must not crash or overdraw.
    expect(tk1.closingInventory).toBeCloseTo(500, 6);
    expect(tk1.rackLoadings).toBeCloseTo(-100, 6);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });
});
