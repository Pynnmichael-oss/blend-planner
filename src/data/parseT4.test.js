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

describe('parseT4 — tab-separated, newline-per-row (Excel paste)', () => {
  const raw = readFileSync(
    path.join(__dirname, '__fixtures__', 't4-outlook-tab.tsv'),
    'utf8'
  );
  const receipts = parseT4(raw, terminalConfig);

  it('parses every row, excluding grade-75 (ULSD) rows', () => {
    expect(receipts).toHaveLength(24);
    expect(receipts.some(r => r.grade === '75')).toBe(false);
  });

  it('parses the first receipt correctly, including supplier from batch code', () => {
    expect(receipts[0]).toMatchObject({
      batchCode: 'EXP-MTV-4D-321-PTA',
      startDatetime: '2026-06-16T09:30:00',
      volume: 10749.99,
      rate: 1456.46,
      supplier: 'MTV',
      line: '3',
    });
  });

  it('produces a unique receiptId for every receipt', () => {
    const ids = receipts.map(r => r.receiptId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('parseT4 — tab-separated, flattened with no row breaks (paste straight from email)', () => {
  const raw = readFileSync(
    path.join(__dirname, '__fixtures__', 't4-email-flattened.txt'),
    'utf8'
  );
  const receipts = parseT4(raw, terminalConfig);

  it('still finds every row by pattern even with zero newlines between them', () => {
    expect(receipts).toHaveLength(11); // 12 rows in source, 1 is grade 75 (ULSD)
    expect(receipts.some(r => r.grade === '75')).toBe(false);
  });

  it('parses the first receipt correctly', () => {
    expect(receipts[0]).toMatchObject({
      batchCode: 'EXP-MTV-4D-421-PTA',
      startDatetime: '2026-08-06T00:00:00',
      volume: 2789.99,
      rate: 1394.88,
      supplier: 'MTV',
      line: '3',
    });
  });

  it('parses the last receipt correctly', () => {
    const last = receipts[receipts.length - 1];
    expect(last).toMatchObject({
      batchCode: 'EXP-EXN-4D-441-PAS',
      startDatetime: '2026-08-19T16:27:00',
      volume: 9249.99,
      rate: 1600,
      supplier: 'EXN',
    });
  });

  it('produces a unique receiptId for every receipt', () => {
    const ids = receipts.map(r => r.receiptId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
