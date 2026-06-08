/**
 * Distributes pipeline receipt volume across 6-hour time windows.
 * Each receipt has a startDatetime, volume, and rate (bbls/hr).
 * endDatetime = startDatetime + (volume / rate) hours
 * For each window, overlap hours * rate = volume assigned to that window.
 * Handles carryover across midnight into the next day's 00-05 window.
 *
 * @param {PipelineReceipt[]} receipts
 * @param {string} date - "YYYY-MM-DD"
 * @param {string} timeSlot - "00-05" | "06-11" | "12-17" | "18-23"
 * @returns {{ volume: number, rvp: number }[]} array of receipt slices for this window
 */
export function distributeReceipts(receipts, date, timeSlot) {
  const slotStartHour = { "00-05": 0, "06-11": 6, "12-17": 12, "18-23": 18 }[timeSlot];
  const slotEndHour   = slotStartHour + 6;

  // Window boundaries as ms since epoch
  const dayMs = new Date(date + 'T00:00:00').getTime(); // local time — must match T4 datetime parsing convention
  const windowStart = dayMs + slotStartHour * 3600_000;
  const windowEnd   = dayMs + slotEndHour   * 3600_000;

  const result = [];

  for (const receipt of receipts) {
    const receiptStart = new Date(receipt.startDatetime).getTime();
    const durationMs   = (receipt.volume / receipt.rate) * 3600_000;
    const receiptEnd   = receiptStart + durationMs;

    const overlapStart = Math.max(receiptStart, windowStart);
    const overlapEnd   = Math.min(receiptEnd,   windowEnd);

    if (overlapEnd <= overlapStart) continue;

    const overlapHours = (overlapEnd - overlapStart) / 3600_000;
    const volume = overlapHours * receipt.rate;

    result.push({ volume, rvp: receipt.rvp });
  }

  return result;
}
