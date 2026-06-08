/**
 * Mock T4 pipeline receipts for Fort Worth terminal.
 * Used for development and testing before live T4 paste input is wired up.
 */

export const fortWorthReceipts = [
  { startDatetime: "2026-04-16T01:07:00", batchCode: "EXP-MTV-4C-201-PTA", supplier: "MTV", line: "FM1", volume: 14250, rate: 4880, rvp: 7.0, grade: "4C", product: "regular" },
  { startDatetime: "2026-04-16T14:22:00", batchCode: "EXP-EXN-4D-202-PTA", supplier: "EXN", line: "FM1", volume: 11999, rate: 4880, rvp: 7.2, grade: "4D", product: "regular" },
  { startDatetime: "2026-04-17T03:15:00", batchCode: "EXP-MTV-3D-203-PTA", supplier: "MTV", line: "FM6", volume: 11999, rate: 4880, rvp: 7.0, grade: "3D", product: "premium" },
  { startDatetime: "2026-04-17T18:40:00", batchCode: "EXP-EXN-4C-204-PTA", supplier: "EXN", line: "FM1", volume: 13100, rate: 4880, rvp: 7.1, grade: "4C", product: "regular" },
  { startDatetime: "2026-04-18T08:00:00", batchCode: "EXP-MTV-3C-205-PTA", supplier: "MTV", line: "FM6", volume: 9800,  rate: 4880, rvp: 6.9, grade: "3C", product: "premium" },
  { startDatetime: "2026-04-19T02:30:00", batchCode: "EXP-EXN-75-206-PTA", supplier: "EXN", line: "FM1", volume: 15200, rate: 4880, rvp: 7.3, grade: "75", product: "regular" },
  { startDatetime: "2026-04-20T11:15:00", batchCode: "EXP-MTV-4D-207-PTA", supplier: "MTV", line: "FM1", volume: 12800, rate: 4880, rvp: 7.0, grade: "4D", product: "regular" },
  { startDatetime: "2026-04-21T06:00:00", batchCode: "EXP-EXN-3D-208-PTA", supplier: "EXN", line: "FM6", volume: 11500, rate: 4880, rvp: 7.1, grade: "3D", product: "premium" },
];
