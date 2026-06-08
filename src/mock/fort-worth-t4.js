/**
 * Mock T4 pipeline receipts for Fort Worth terminal.
 * Used for development and testing before live T4 paste input is wired up.
 */

const d = (n, h=0, m=0) => { const x = new Date(); x.setDate(x.getDate()+n); x.setHours(h,m,0,0); return x.toISOString().slice(0,16).replace('T',' '); };

export const fortWorthReceipts = [
  { startDatetime: d(0,  1,  7), batchCode: "EXP-MTV-4C-201-PTA", supplier: "MTV", line: "FM1", volume: 14250, rate: 4880, rvp: 7.0, grade: "4C", product: "regular" },
  { startDatetime: d(1, 14, 22), batchCode: "EXP-EXN-4D-202-PTA", supplier: "EXN", line: "FM1", volume: 11999, rate: 4880, rvp: 7.2, grade: "4D", product: "regular" },
  { startDatetime: d(2,  3, 15), batchCode: "EXP-MTV-3D-203-PTA", supplier: "MTV", line: "FM6", volume: 11999, rate: 4880, rvp: 7.0, grade: "3D", product: "premium" },
  { startDatetime: d(3, 18, 40), batchCode: "EXP-EXN-4C-204-PTA", supplier: "EXN", line: "FM1", volume: 13100, rate: 4880, rvp: 7.1, grade: "4C", product: "regular" },
  { startDatetime: d(4,  8,  0), batchCode: "EXP-MTV-3C-205-PTA", supplier: "MTV", line: "FM6", volume:  9800, rate: 4880, rvp: 6.9, grade: "3C", product: "premium" },
  { startDatetime: d(5,  2, 30), batchCode: "EXP-EXN-75-206-PTA", supplier: "EXN", line: "FM1", volume: 15200, rate: 4880, rvp: 7.3, grade: "75", product: "regular" },
  { startDatetime: d(6, 11, 15), batchCode: "EXP-MTV-4D-207-PTA", supplier: "MTV", line: "FM1", volume: 12800, rate: 4880, rvp: 7.0, grade: "4D", product: "regular" },
  { startDatetime: d(7,  6,  0), batchCode: "EXP-EXN-3D-208-PTA", supplier: "EXN", line: "FM6", volume: 11500, rate: 4880, rvp: 7.1, grade: "3D", product: "premium" },
];
