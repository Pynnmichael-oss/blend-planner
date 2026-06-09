/**
 * Default rack lifting demand curve.
 * Keyed by "WEEKDAY|TIMESLOT" (e.g. "Monday|00:00-05:59").
 * Values are negative bbls (outbound from terminal).
 */

const WEEKDAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

const WEEKDAY_MULT = {
  Monday: 1.0, Tuesday: 1.05, Wednesday: 1.0, Thursday: 1.05,
  Friday: 1.1, Saturday: 0.8, Sunday: 0.6,
};

// curveKey: display/storage format; calcKey: inventory calc format ("00-05")
const SLOT_CONFIG = [
  { curveKey: '00:00-05:59', calcKey: '00-05', dist: 0.15 },
  { curveKey: '06:00-11:59', calcKey: '06-11', dist: 0.30 },
  { curveKey: '12:00-17:59', calcKey: '12-17', dist: 0.35 },
  { curveKey: '18:00-23:59', calcKey: '18-23', dist: 0.20 },
];

const DAILY_BASE = { regular: -13200, premium: -3800 };

export const DEFAULT_DAILY_BASE = { regular: 13200, premium: 3800 };

// { regular: { "Monday|00:00-05:59": -1980, ... }, premium: { ... } }
export const defaultLiftingsCurve = (() => {
  const curve = { regular: {}, premium: {} };
  for (const [product, daily] of Object.entries(DAILY_BASE)) {
    for (const weekday of WEEKDAYS) {
      const mult = WEEKDAY_MULT[weekday];
      for (const { curveKey, dist } of SLOT_CONFIG) {
        curve[product][`${weekday}|${curveKey}`] = Math.round(daily * mult * dist);
      }
    }
  }
  return curve;
})();

const CALC_TO_CURVE = Object.fromEntries(SLOT_CONFIG.map(s => [s.calcKey, s.curveKey]));
const UTC_WEEKDAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function utcWeekday(dateStr) {
  return UTC_WEEKDAY_NAMES[new Date(dateStr + 'T00:00:00Z').getUTCDay()];
}

export function getDefaultLifting(product, weekday, timeSlot) {
  const curveKey = CALC_TO_CURVE[timeSlot] ?? timeSlot;
  return defaultLiftingsCurve[product]?.[`${weekday}|${curveKey}`] ?? 0;
}

// dailyBase: { regular: number, premium: number } — positive bbl/day values
export function buildLiftingsGridWithBase(terminalConfig, startDate, planDays, dailyBase) {
  const result = [];
  for (let i = 0; i < planDays; i++) {
    const d = new Date(startDate + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + i);
    const date    = d.toISOString().slice(0, 10);
    const weekday = utcWeekday(date);

    for (const [productKey, product] of Object.entries(terminalConfig.products)) {
      const tanks = product.tanks;
      if (tanks.length === 0) continue;
      const baseAbs = dailyBase[productKey] ?? 0;
      const mult    = WEEKDAY_MULT[weekday] ?? 1;
      for (const { calcKey: timeSlot, dist } of SLOT_CONFIG) {
        const total   = Math.round(-baseAbs * mult * dist);
        const perTank = Math.round(total / tanks.length);
        for (const tank of tanks) {
          result.push({ tankId: tank.id, date, timeSlot, volume: perTank });
        }
      }
    }
  }
  return result;
}

export function buildLiftingsGrid(terminalConfig, startDate, planDays) {
  const result = [];
  for (let i = 0; i < planDays; i++) {
    const d = new Date(startDate + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + i);
    const date    = d.toISOString().slice(0, 10);
    const weekday = utcWeekday(date);

    for (const [productKey, product] of Object.entries(terminalConfig.products)) {
      const tanks = product.tanks;
      if (tanks.length === 0) continue;
      for (const { calcKey: timeSlot } of SLOT_CONFIG) {
        const total  = getDefaultLifting(productKey, weekday, timeSlot);
        const perTank = Math.round(total / tanks.length);
        for (const tank of tanks) {
          result.push({ tankId: tank.id, date, timeSlot, volume: perTank });
        }
      }
    }
  }
  return result;
}
