import { describe, it, expect } from 'vitest';
import { resolveTruckLoad, truckCountFor, formatTruckCount, TRUCK_BBLS } from './truckCalc';

describe('truckCalc — generic across terminals (no terminal-specific behavior)', () => {
  describe('resolveTruckLoad', () => {
    it('returns zero trucks / zero volume for zero or negative demand', () => {
      expect(resolveTruckLoad(0)).toEqual({ trucks: 0, actualButane: 0 });
      expect(resolveTruckLoad(-5)).toEqual({ trucks: 0, actualButane: 0 });
    });

    it('75 bbl (< 1 truck): 1 truck, exact volume preserved', () => {
      expect(resolveTruckLoad(75)).toEqual({ trucks: 1, actualButane: 75 });
    });

    it('150 bbl (< 1 truck): 1 truck, exact volume preserved', () => {
      expect(resolveTruckLoad(150)).toEqual({ trucks: 1, actualButane: 150 });
    });

    it('189 bbl (just under 1 truck): 1 truck, exact volume preserved', () => {
      expect(resolveTruckLoad(189)).toEqual({ trucks: 1, actualButane: 189 });
    });

    it('190 bbl (exactly 1 full truck): 1 truck, full 190 bbl', () => {
      expect(resolveTruckLoad(190)).toEqual({ trucks: 1, actualButane: 190 });
    });

    it('380 bbl (exactly 2 full trucks): 2 trucks, full 380 bbl', () => {
      expect(resolveTruckLoad(380)).toEqual({ trucks: 2, actualButane: 380 });
    });

    it('above 190 bbl but not a whole multiple: preserves existing truncate-to-whole-trucks behavior', () => {
      // 300 bbl -> floor(300/190) = 1 truck, actual = 190 (unchanged from
      // prior truncating behavior for the >=1-truck regime)
      expect(resolveTruckLoad(300)).toEqual({ trucks: 1, actualButane: 190 });
    });

    it('never produces a fractional truck count', () => {
      for (const bbl of [1, 75, 189, 190, 191, 300, 380, 381, 1000]) {
        const { trucks } = resolveTruckLoad(bbl);
        expect(Number.isInteger(trucks)).toBe(true);
      }
    });

    it('respects a custom truck capacity', () => {
      expect(resolveTruckLoad(50, 100)).toEqual({ trucks: 1, actualButane: 50 });
      expect(resolveTruckLoad(250, 100)).toEqual({ trucks: 2, actualButane: 200 });
    });

    it('uses the standard 190 bbl capacity by default', () => {
      expect(TRUCK_BBLS).toBe(190);
    });
  });

  describe('truckCountFor (range endpoints)', () => {
    it('returns null when the input itself is null/undefined', () => {
      expect(truckCountFor(null)).toBeNull();
      expect(truckCountFor(undefined)).toBeNull();
    });

    it('returns 0 for zero/negative volume', () => {
      expect(truckCountFor(0)).toBe(0);
      expect(truckCountFor(-10)).toBe(0);
    });

    it('resolves a positive sub-190 endpoint to 1 truck (range fix)', () => {
      expect(truckCountFor(75)).toBe(1);
      expect(truckCountFor(189)).toBe(1);
    });

    it('preserves existing range behavior above 190 bbl', () => {
      expect(truckCountFor(380)).toBe(2);
      expect(truckCountFor(300)).toBe(1);
    });

    it('never returns a fractional or blank value for positive input', () => {
      for (const bbl of [1, 75, 189, 190, 300, 380]) {
        expect(Number.isInteger(truckCountFor(bbl))).toBe(true);
        expect(truckCountFor(bbl)).toBeGreaterThan(0);
      }
    });
  });

  describe('formatTruckCount', () => {
    it('formats singular', () => {
      expect(formatTruckCount(1)).toBe('1 truck');
    });
    it('formats plural', () => {
      expect(formatTruckCount(4)).toBe('4 trucks');
    });
    it('formats an existing range as "low-high trucks"', () => {
      expect(formatTruckCount(1, 2)).toBe('1-2 trucks');
    });
    it('falls back to a dash for null', () => {
      expect(formatTruckCount(null)).toBe('—');
    });
  });
});
