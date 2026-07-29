import { jsPDF } from 'jspdf';

const BLUE = '#004F71';
const TEAL = '#00B398';
const MUTED = '#5E7A8A';
const TEXT = '#063A52';

function fmt(value, decimals = 2) {
  if (value === null || value === undefined) return '—';
  if (typeof value !== 'number' || isNaN(value)) return '—';
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtPlain(value) {
  if (value === null || value === undefined) return '—';
  return String(value);
}

export function generateBlendPDF(blend) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const marginX = 48;
  let y = 60;

  // Header
  doc.setFont('courier', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(BLUE);
  doc.text(`Blend #${fmtPlain(blend.blendNumber)} — ${fmtPlain(blend.tankLabel)} (${fmtPlain(blend.product)})`, marginX, y);

  // Subheader
  y += 22;
  doc.setFont('courier', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(MUTED);
  doc.text(
    `${fmtPlain(blend.startDate)} ${fmtPlain(blend.startTime)} → ${fmtPlain(blend.endDate)} ${fmtPlain(blend.endTime)}  (${fmtPlain(blend.periods)} periods)`,
    marginX, y
  );

  // Divider
  y += 14;
  doc.setDrawColor(TEAL);
  doc.setLineWidth(1);
  doc.line(marginX, y, 564, y);

  // Value block
  const rows = [
    ['Est. Pumpable (bbl):', fmt(blend.estPumpable)],
    ['Heel (bbl):',          fmt(blend.heel)],
    ['Est. TOV (bbl):',      fmt(blend.estTOV)],
    ['RVP Actual:',          fmt(blend.rvpActual)],
    ['Butane Required (bbl):', fmt(blend.butane_bbls)],
    ['Trucks:',              fmt(blend.trucks, 0)],
    ['Actual Butane (bbl):', fmt(blend.actualButane)],
    ['Blended RVP:',         fmt(blend.blendedRVP)],
  ];

  y += 26;
  doc.setFontSize(11);
  const labelX = marginX;
  const valueX = 300;
  for (const [label, value] of rows) {
    doc.setFont('courier', 'normal');
    doc.setTextColor(TEXT);
    doc.text(label, labelX, y);
    doc.setFont('courier', 'bold');
    doc.setTextColor(BLUE);
    doc.text(value, valueX, y, { align: 'left' });
    y += 20;
  }

  // Footer
  const now = new Date();
  const stamp = now.toLocaleString();
  doc.setFont('courier', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(MUTED);
  doc.text(`Global Partners LP · Fort Worth · Generated ${stamp}`, marginX, 740);

  return doc;
}

export default generateBlendPDF;
