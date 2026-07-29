import { jsPDF } from 'jspdf';
import { TIME_SLOTS } from './inventoryCalc';
import { SLOT_START } from './blendPlanSummary';

const BLUE = '#004F71';
const TEAL = '#00B398';
const MUTED = '#5E7A8A';
const TEXT = '#063A52';

// Fixed tank display order — matches Kelly's spec ordering, independent of
// terminalConfig's product grouping.
const FIXED_TANK_ORDER = ['TK55', 'TK56', 'TK03', 'TK04', 'TK05'];

const STATUS_LABELS = {
  IDLE:     'IDLE',
  RACK:     'TO RACK',
  'RACK+RCV': 'TO RACK',
  BLEND:    'BLENDING',
  OVERFILL: 'OVERFILL',
  CONFLICT: 'CONFLICT',
  LOW:      'LOW',
  // RECEIPT intentionally has no status line — only RECEIVE lines fire for it.
};

function dayHeader(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    weekday: 'long', timeZone: 'UTC',
  });
  return `${weekday.toUpperCase()} ${m}/${d}`;
}

// Walks one tank's periods (already sorted by time slot) for a single day and
// returns an ordered list of { time, text } line items.
function buildTankDayLines(periods) {
  const lines = [];
  let prevStatus = undefined;
  let prevBatches = new Set();

  for (const p of periods) {
    if (p.status !== prevStatus) {
      const label = STATUS_LABELS[p.status];
      if (label) lines.push({ time: SLOT_START[p.timeSlot], text: label });
      prevStatus = p.status;
    }

    const currentBatches = new Set((p.receipts ?? []).map(r => r.batchCode).filter(Boolean));
    for (const batch of currentBatches) {
      if (!prevBatches.has(batch)) {
        lines.push({ time: SLOT_START[p.timeSlot], text: `RECEIVE ${batch}` });
      }
    }
    prevBatches = currentBatches;
  }

  return lines;
}

export function generatePlanPDF(grid, terminalConfig, startDate, planDays) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const marginX = 48;
  const pageHeight = doc.internal.pageSize.getHeight();
  const footerY = pageHeight - 40;
  const bottomLimit = footerY - 20;
  const now = new Date();

  // Group grid entries by date, then by tankId
  const byDate = {};
  for (const entry of grid) {
    (byDate[entry.date] ??= {});
    (byDate[entry.date][entry.tankId] ??= []).push(entry);
  }
  const slotOrder = { [TIME_SLOTS[0]]: 0, [TIME_SLOTS[1]]: 1, [TIME_SLOTS[2]]: 2, [TIME_SLOTS[3]]: 3 };
  const dates = Object.keys(byDate).sort();

  function drawFooter() {
    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(MUTED);
    doc.text(`Global Partners LP · Fort Worth · Generated ${now.toLocaleString()}`, marginX, footerY);
  }

  function addPage() {
    drawFooter();
    doc.addPage();
    return 60;
  }

  // Header
  let y = 60;
  doc.setFont('courier', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(BLUE);
  const terminalLabel = terminalConfig?.name ?? terminalConfig?.label ?? terminalConfig?.id ?? 'Terminal';
  doc.text(`Weekly Blend Plan — ${terminalLabel} — Week of ${startDate}`, marginX, y);
  y += 20;
  doc.setFont('courier', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(MUTED);
  doc.text(`${planDays} day plan`, marginX, y);
  y += 24;

  for (const date of dates) {
    const tanksForDate = byDate[date];

    // Day header — page break before if it won't fit with at least one tank line
    if (y + 40 > bottomLimit) y = addPage();
    doc.setFont('courier', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(BLUE);
    doc.text(dayHeader(date), marginX, y);
    y += 20;

    for (const tankId of FIXED_TANK_ORDER) {
      const periods = tanksForDate[tankId];
      if (!periods || periods.length === 0) continue; // no periods for this tank today

      const sorted = [...periods].sort((a, b) => slotOrder[a.timeSlot] - slotOrder[b.timeSlot]);
      const lines = buildTankDayLines(sorted);

      if (y + 18 > bottomLimit) y = addPage();
      doc.setFont('courier', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(TEAL);
      doc.text(`TK ${tankId.replace(/^TK/, '')}`, marginX, y);
      y += 16;

      doc.setFont('courier', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(TEXT);
      for (const line of lines) {
        if (y + 14 > bottomLimit) y = addPage();
        doc.text(`${line.text} (${line.time})`, marginX + 24, y);
        y += 14;
      }
      y += 6;
    }

    y += 10;
  }

  drawFooter();
  return doc;
}

export default generatePlanPDF;
