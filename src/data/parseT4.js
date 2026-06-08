/**
 * Parses raw T4 pipeline schedule text (tab-separated) into PipelineReceipt objects.
 * Column indices (0-based):
 *   0  — Start datetime
 *   3  — Line (FM1, FM6, etc.)
 *   5  — Batch code  (EXP-[SUPPLIER]-[GRADE]-[CYCLE]-[SUFFIX])
 *   7  — Supplier
 *   11 — Volume (strip commas)
 *   13 — Rate (bbls/hr, strip commas)
 * Grade is parsed from batchCode position 2 (split by "-").
 * Product derived from terminalConfig.gradeMap.
 */

export function parseT4(rawText, terminalConfig) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const receipts = [];

  for (const line of lines) {
    const cols = line.split('\t');
    if (cols.length < 14) continue;

    const raw = cols[0].trim();
    const dt = new Date(raw);
    const startDatetime = isNaN(dt.getTime())
      ? raw
      : `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}T${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}:00`;
    const lineCode      = cols[3].trim();
    const batchCode     = cols[5].trim();
    const supplier      = cols[7].trim();
    const volume        = parseFloat(cols[11].replace(/,/g, ''));
    const rate          = parseFloat(cols[13].replace(/,/g, ''));

    if (!startDatetime || !batchCode || isNaN(volume) || isNaN(rate)) continue;

    const grade = batchCode.split('-')[2] ?? '';

    let product = null;
    for (const [productKey, grades] of Object.entries(terminalConfig.gradeMap)) {
      if (grades.includes(grade)) { product = productKey; break; }
    }
    if (!product) continue; // grade not in this terminal's gradeMap

    receipts.push({
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
