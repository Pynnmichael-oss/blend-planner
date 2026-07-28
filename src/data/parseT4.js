/**
 * Parses raw T4 pipeline schedule text into PipelineReceipt objects.
 *
 * Two input formats are supported:
 *
 * 1. Tab-separated (paste from the Explorer T4 portal). Column indices (0-based):
 *      0  — Start datetime
 *      3  — Line (FM1, FM6, etc.)
 *      5  — Batch code  (EXP-[SUPPLIER]-[GRADE]-[CYCLE]-[SUFFIX])
 *      7  — Supplier
 *      11 — Volume (strip commas)
 *      13 — Rate (bbls/hr, strip commas)
 *
 * 2. Line-per-field (paste from Outlook, which flattens the T4 table so each
 *    field lands on its own physical line instead of being tab-separated).
 *    Field order is fixed (19 fields/record) but the header labels Outlook
 *    prints do NOT reliably describe the data beneath them — do not parse by
 *    header name, only by fixed position:
 *      0  Start Date       (M/D/YYYY H:MM, non-zero-padded)
 *      1  Line
 *      2  Ver
 *      3  Evt Loc
 *      4  Location Description
 *      5  Batch Code
 *      6  Sup               (always blank in this format)
 *      7  Con
 *      8  Tnk
 *      9  Grt
 *      10 Grt2
 *      11 Sch               (volume)
 *      12 UOM
 *      13 Rate
 *      14 Action
 *      15 Date Created
 *      16 Created By
 *      17 Remark
 *      18 Coverage
 *    The first 19 lines of the pasted text are a header block and are skipped;
 *    the remaining lines are walked in fixed groups of 19 (one record each).
 *
 * Format is detected by presence of a tab character: if the raw text contains
 * no tabs at all, it is treated as the line-per-field format; otherwise the
 * tab-separated path is used.
 *
 * In both formats: grade is parsed from batchCode position 2 (split by "-"),
 * product is derived from terminalConfig.gradeMap, and rows whose grade isn't
 * in the terminal's gradeMap (e.g. "75" / ULSD) are silently dropped.
 */

const BATCH_CODE_PATTERN = /^EXP-[A-Z]+-[A-Z0-9]+-\d{3}-[A-Z]+$/;
const OUTLOOK_RECORD_FIELD_COUNT = 19;

function normalizeDatetime(raw) {
  const dt = new Date(raw);
  if (isNaN(dt.getTime())) return raw;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}T${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}:00`;
}

function resolveProduct(grade, terminalConfig) {
  for (const [productKey, grades] of Object.entries(terminalConfig.gradeMap)) {
    if (grades.includes(grade)) return productKey;
  }
  return null;
}

function parseT4Tabs(rawText, terminalConfig) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const receipts = [];

  for (const line of lines) {
    const cols = line.split('\t');
    if (cols.length < 14) continue;

    const startDatetime = normalizeDatetime(cols[0].trim());
    const lineCode       = cols[3].trim();
    const batchCode      = cols[5].trim();
    const supplier       = cols[7].trim();
    const volume         = parseFloat(cols[11].replace(/,/g, ''));
    const rate           = parseFloat(cols[13].replace(/,/g, ''));

    if (!startDatetime || !batchCode || isNaN(volume) || isNaN(rate)) continue;

    const grade   = batchCode.split('-')[2] ?? '';
    const product = resolveProduct(grade, terminalConfig);
    if (!product) continue; // grade not in this terminal's gradeMap

    receipts.push({
      receiptId: `${batchCode}__${startDatetime}__${lineCode}`,
      startDatetime,
      batchCode,
      supplier,
      line: lineCode,
      volume,
      rate,
      grade,
      product,
      rvp: null, // TODO: wire to pipeline RVP source
    });
  }

  return receipts;
}

function parseT4OutlookLines(rawText, terminalConfig) {
  const allLines = rawText.split('\n').map(l => l.replace(/\r$/, ''));
  // Trim only leading/trailing fully-empty lines from the paste; interior
  // blank/whitespace-only lines are real field values (e.g. the blank Sup field).
  let start = 0;
  let end = allLines.length;
  while (start < end && allLines[start].trim() === '') start++;
  while (end > start && allLines[end - 1].trim() === '') end--;
  const lines = allLines.slice(start, end);

  const body = lines.slice(OUTLOOK_RECORD_FIELD_COUNT);
  const receipts = [];

  for (let i = 0; i + OUTLOOK_RECORD_FIELD_COUNT <= body.length; i += OUTLOOK_RECORD_FIELD_COUNT) {
    const rec = body.slice(i, i + OUTLOOK_RECORD_FIELD_COUNT);

    const startDatetime = normalizeDatetime(rec[0].trim());
    const lineCode       = rec[1].trim();
    const batchCode      = rec[5].trim();
    const supplier       = ''; // field 6 ("Sup") is always blank in this format
    const volume         = parseFloat(rec[11].replace(/,/g, ''));
    const rate           = parseFloat(rec[13].replace(/,/g, ''));

    if (!BATCH_CODE_PATTERN.test(batchCode)) continue;
    if (!startDatetime || isNaN(volume) || isNaN(rate)) continue;

    const grade   = batchCode.split('-')[2] ?? '';
    const product = resolveProduct(grade, terminalConfig);
    if (!product) continue; // grade not in this terminal's gradeMap (e.g. "75" / ULSD)

    receipts.push({
      receiptId: `${batchCode}__${startDatetime}__${lineCode}`,
      startDatetime,
      batchCode,
      supplier,
      line: lineCode,
      volume,
      rate,
      grade,
      product,
      rvp: null, // TODO: wire to pipeline RVP source
    });
  }

  return receipts;
}

export function parseT4(rawText, terminalConfig) {
  if (rawText.includes('\t')) {
    return parseT4Tabs(rawText, terminalConfig);
  }
  return parseT4OutlookLines(rawText, terminalConfig);
}
