import { describe, it, expect } from 'vitest';
import { buildPlanGrid } from './inventoryCalc';
import { detectBlends } from './blendPlanSummary';

// Generic terminal config (not Fort Worth) -- confirms the fix isn't
// terminal-specific. pumpable=10000, heel=0 make the RVP weighted-average
// math easy to hit an exact target butane_bbls for each acceptance case.
const terminalConfig = {
  id: 'generic-test-terminal',
  products: {
    regular: {
      label: 'Regular',
      tanks: [{ id: 'TK1', label: 'Tank 1', safeFill: 100000, heel: 0 }],
    },
  },
};

const START_DATE = '2026-04-16';
const BLEND_TARGET = 8.75; // default
const BUTANE_RVP = 52;
const PUMPABLE = 10000;
const HEEL = 0;
const TOV = PUMPABLE + HEEL;

// Solve rvpActual that yields an exact target butane_bbls, given the same
// formula buildPlanGrid uses: butane = (blendTarget - rvpActual) * tov / (BUTANE_RVP - blendTarget)
function rvpActualFor(targetButaneBbls) {
  const denom = BUTANE_RVP - BLEND_TARGET;
  const margin = (targetButaneBbls * denom) / TOV;
  return BLEND_TARGET - margin;
}

function runBlend(rvpActual) {
  const openingInventory = [{ tankId: 'TK1', pumpable: PUMPABLE, rvp: rvpActual }];
  // Blend active for the first period only; blend ends at the second
  // period (blendActive false there triggers the post-blend calculation).
  const manualInputs = {
    [`TK1-${START_DATE}-00-05`]: { blendActive: true },
  };

  const grid = buildPlanGrid({
    terminalConfig,
    openingInventory,
    receipts: [],
    planDays: 1,
    startDate: START_DATE,
    manualInputs,
  });

  const blendingPeriod = grid.find(e => e.tankId === 'TK1' && e.timeSlot === '00-05');
  const postBlendPeriod = grid.find(e => e.tankId === 'TK1' && e.timeSlot === '06-11');
  const blends = detectBlends(grid, terminalConfig);

  return { grid, blendingPeriod, postBlendPeriod, blends };
}

describe('Explicit Blend truck/volume display — generic across terminals', () => {
  it('75 bbl: Plan and Summary both show exact 75 bbl and 1 truck', () => {
    const { blendingPeriod, postBlendPeriod, blends } = runBlend(rvpActualFor(75));

    // Plan timeline: the blend itself is always visible regardless of size.
    expect(blendingPeriod.status).toBe('BLEND');
    expect(blendingPeriod.blendActive).toBe(true);

    // Plan: post-blend info block (rule 7).
    expect(postBlendPeriod.postBlendButane).toBeCloseTo(75, 6);
    expect(postBlendPeriod.postBlendTrucks).toBe(1);
    expect(postBlendPeriod.postBlendRVP).toBeCloseTo(BLEND_TARGET, 6);

    // Summary: same underlying blendSummary object (rule 8).
    expect(blends).toHaveLength(1);
    expect(blends[0].butane_bbls).toBeCloseTo(75, 6);
    expect(blends[0].actualButane).toBeCloseTo(75, 6);
    expect(blends[0].trucks).toBe(1);
  });

  it('189 bbl: 1 truck, exact volume preserved', () => {
    const { postBlendPeriod, blends } = runBlend(rvpActualFor(189));
    expect(postBlendPeriod.postBlendButane).toBeCloseTo(189, 6);
    expect(postBlendPeriod.postBlendTrucks).toBe(1);
    expect(blends[0].trucks).toBe(1);
    expect(blends[0].actualButane).toBeCloseTo(189, 6);
  });

  it('190 bbl: 1 truck, full 190 bbl', () => {
    const { postBlendPeriod, blends } = runBlend(rvpActualFor(190));
    expect(postBlendPeriod.postBlendButane).toBeCloseTo(190, 6);
    expect(postBlendPeriod.postBlendTrucks).toBe(1);
    expect(blends[0].trucks).toBe(1);
  });

  it('380 bbl: existing calculation displays 2 trucks', () => {
    const { postBlendPeriod, blends } = runBlend(rvpActualFor(380));
    expect(postBlendPeriod.postBlendTrucks).toBe(2);
    expect(blends[0].trucks).toBe(2);
    expect(blends[0].actualButane).toBeCloseTo(380, 6);
  });

  it('a manually selected blend with a low calculated volume is never removed from Plan or Summary', () => {
    const { blendingPeriod, blends } = runBlend(rvpActualFor(1)); // tiny, positive requirement
    expect(blendingPeriod.status).toBe('BLEND'); // not suppressed to IDLE/RACK
    expect(blends).toHaveLength(1); // still present in Summary
    expect(blends[0].trucks).toBe(1); // never 0 trucks for positive butane
  });

  it('regression: no butane needed (rvpActual already at/above target) still yields a blend row with no truck data', () => {
    const { blendingPeriod, blends } = runBlend(BLEND_TARGET + 0.5); // already above target
    expect(blendingPeriod.status).toBe('BLEND'); // status is independent of butane math
    expect(blends).toHaveLength(1);
    expect(blends[0].trucks).toBeNull();
    expect(blends[0].butane_bbls).toBeNull();
  });
});
