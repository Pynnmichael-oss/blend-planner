/**
 * Blend plan detection logic from Kelly's spec.
 * Finds maximal contiguous runs of blendActive = true per tank.
 */

const TIME_SLOT_ORDER = { "00-05": 0, "06-11": 1, "12-17": 2, "18-23": 3 };
const SLOT_START = { "00-05": "00:00", "06-11": "06:00", "12-17": "12:00", "18-23": "18:00" };
const SLOT_END   = { "00-05": "05:59", "06-11": "11:59", "12-17": "17:59", "18-23": "23:59" };

function isNextDay(a, b) {
  return new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z') === 86_400_000;
}

function isConsecutive(prev, curr) {
  const po = TIME_SLOT_ORDER[prev.timeSlot];
  const co = TIME_SLOT_ORDER[curr.timeSlot];
  if (prev.date === curr.date) return co === po + 1;
  return co === 0 && po === 3 && isNextDay(prev.date, curr.date);
}

function buildBlendRow(blendNumber, tankId, tankMeta, periods) {
  const first       = periods[0];
  const last        = periods[periods.length - 1];
  const penultimate = periods.length > 1 ? periods[periods.length - 2] : null;
  const heel        = tankMeta?.heel ?? 0;
  const bs          = last.blendSummary ?? null;

  return {
    blendNumber,
    tankId,
    tankLabel:    tankMeta?.label    ?? tankId,
    product:      tankMeta?.productKey ?? '',
    startDate:    first.date,
    startTime:    SLOT_START[first.timeSlot],
    endDate:      last.date,
    endTime:      SLOT_END[last.timeSlot],
    periods:      periods.length,
    estPumpable:  bs?.estPumpable  ?? null,
    heel,
    estTOV:       bs?.tov          ?? null,
    rvpActual:    bs?.rvpActual    ?? null,
    butane_bbls:  bs?.butane_bbls  ?? null,
    trucks:       bs?.trucks       ?? null,
    actualButane: bs?.actualButane ?? null,
    blendedRVP:   bs?.blendedRVP   ?? null,
    minMargin:    1.8,
    maxMargin:    2.1,
    truckStart:   `${first.date} ${SLOT_START[first.timeSlot]}`,
    // O-3: single-period blends have no truck finish
    truckFinish:  penultimate
      ? `${penultimate.date} ${SLOT_END[penultimate.timeSlot]}`
      : null,
  };
}

export function detectBlends(grid, terminalConfig) {
  // Build tank metadata lookup
  const tankMeta = {};
  for (const [productKey, product] of Object.entries(terminalConfig.products))
    for (const tank of product.tanks)
      tankMeta[tank.id] = { ...tank, productKey, productLabel: product.label };

  // Group grid by tank, sorted by date + slot
  const byTank = {};
  for (const entry of grid) (byTank[entry.tankId] ??= []).push(entry);

  const blends = [];

  for (const [tankId, entries] of Object.entries(byTank)) {
    const sorted = [...entries].sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return TIME_SLOT_ORDER[a.timeSlot] - TIME_SLOT_ORDER[b.timeSlot];
    });

    let run = [];
    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i];
      if (p.blendActive) {
        if (run.length > 0 && !isConsecutive(sorted[i - 1], p)) {
          // Gap — close current run, start fresh
          blends.push(buildBlendRow(0, tankId, tankMeta[tankId], run));
          run = [];
        }
        run.push(p);
      } else if (run.length) {
        blends.push(buildBlendRow(0, tankId, tankMeta[tankId], run));
        run = [];
      }
    }
    if (run.length) blends.push(buildBlendRow(0, tankId, tankMeta[tankId], run));
  }

  // Sort by start date/time and assign final blend numbers
  blends.sort((a, b) => {
    if (a.startDate !== b.startDate) return a.startDate < b.startDate ? -1 : 1;
    return a.startTime < b.startTime ? -1 : 1;
  });
  blends.forEach((b, i) => { b.blendNumber = i + 1; });

  return blends;
}
