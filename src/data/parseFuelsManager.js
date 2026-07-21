/**
 * Parser for FuelsManager tank gauge export workbooks.
 * Pure module — does not touch parseT4.js or any React state.
 */

import * as XLSX from 'xlsx';

export const TANK_ID_MAP = {
  "23155": "TK55",
  "23156": "TK56",
  "27403": "TK03",
  "27404": "TK04",
  "27405": "TK05",
};

function extractTankNumber(rawTank) {
  const match = String(rawTank ?? '').match(/\d+/);
  return match ? match[0] : null;
}

/**
 * Reads a FuelsManager .xlsx workbook and returns raw row objects.
 * Only the columns the planner cares about are kept.
 */
export function parseFuelsManagerWorkbook(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

  const result = [];
  for (const row of rows) {
    const tankNumber = extractTankNumber(row.Tank);
    const tankId = tankNumber ? TANK_ID_MAP[tankNumber] : undefined;
    if (!tankId) continue; // unmapped tanks (ULSD/ethanol etc.) skipped

    result.push({
      tankId,
      pulledAt: row.PulledAt,
      product: row.Product,
      available: Number(row.Available),
      tov: Number(row.TOV),
      workingCap: Number(row.WorkingCap),
    });
  }
  return result;
}

/**
 * Given parsed rows, picks the latest valid reading per tank.
 * Valid = Available > 0 AND Available <= WorkingCap * 1.2.
 * Rows are walked newest-first; invalid rows are skipped and counted.
 */
export function getLatestValidByTank(rows) {
  const byTank = {};
  for (const row of rows) {
    (byTank[row.tankId] ??= []).push(row);
  }

  const result = {};
  for (const [tankId, tankRows] of Object.entries(byTank)) {
    const sorted = [...tankRows].sort(
      (a, b) => new Date(b.pulledAt) - new Date(a.pulledAt)
    );

    let skippedBadRows = 0;
    let chosen = null;
    for (const row of sorted) {
      const isValid = row.available > 0 && row.available <= row.workingCap * 1.2;
      if (isValid && !chosen) {
        chosen = row;
      } else if (!isValid) {
        skippedBadRows += 1;
      }
    }

    if (chosen) {
      result[tankId] = {
        available: chosen.available,
        pulledAt: chosen.pulledAt,
        workingCap: chosen.workingCap,
        skippedBadRows,
      };
    }
  }
  return result;
}
