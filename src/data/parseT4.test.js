import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { parseT4 } from './parseT4';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const terminalConfig = {
  gradeMap: {
    regular: ['4C', '4D'],
    premium: ['3C', '3D'],
  },
};

describe('parseT4 — Outlook line-per-field format', () => {
  const raw = readFileSync(
    path.join(__dirname, '__fixtures__', 't4-outlook-lines.txt'),
    'utf8'
  );
  const receipts = parseT4(raw, terminalConfig);

  it('parses the correct total receipt count, excluding grade-75 (ULSD) rows', () => {
    expect(receipts).toHaveLength(36);
    expect(receipts.some(r => r.grade === '75')).toBe(false);
  });

  it('parses the first receipt correctly', () => {
    expect(receipts[0]).toMatchObject({
      batchCode: 'EXP-MTV-4D-401-PTA',
      startDatetime: '2026-07-27T05:30:00',
      volume: 10749.99,
      rate: 1459,
      supplier: '',
    });
  });

  it('parses the last receipt correctly', () => {
    const last = receipts[receipts.length - 1];
    expect(last).toMatchObject({
      batchCode: 'EXP-MTV-4D-422-PTA',
      startDatetime: '2026-08-09T21:32:00',
      volume: 10749.99,
      rate: 3000,
      supplier: '',
    });
  });

  it('produces a unique receiptId for every receipt', () => {
    const ids = receipts.map(r => r.receiptId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
