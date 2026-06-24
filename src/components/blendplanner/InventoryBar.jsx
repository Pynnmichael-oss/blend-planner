/**
 * VerticalTankGauge — tank shell with fill rising from the bottom.
 * Props: { fillPct, status, height = 48, width = 16 }
 */

const STATUS_FILL = {
  BLEND:      { color: '#D9655B', opacity: 0.7 },
  RACK:       { color: '#00B398', opacity: 1   },
  RECEIPT:    { color: '#004F71', opacity: 0.7 },
  IDLE:       { color: '#9DB0BC', opacity: 1   },
  CONFLICT:   { color: '#E0A23C', opacity: 1   },
  OVERFILL:   { color: '#C0882E', opacity: 1   },
  'RACK+RCV': { color: '#00B398', opacity: 1   },
};

export default function VerticalTankGauge({ fillPct, status, height = 48, width = 16 }) {
  const pct = Math.min(1, Math.max(0, fillPct ?? 0));

  let fillColor, fillOpacity = 1;
  if (pct > 0.95) {
    fillColor = '#C0882E';
  } else if (pct < 0.15) {
    fillColor = '#D9655B';
  } else {
    const s = STATUS_FILL[status] ?? STATUS_FILL.IDLE;
    fillColor   = s.color;
    fillOpacity = s.opacity;
  }

  return (
    <div style={{
      width, height, position: 'relative',
      backgroundColor: '#E5ECF0',
      borderRadius: '3px 3px 0 0',
      border: '0.5px solid rgba(0,79,113,.2)',
      overflow: 'hidden', flexShrink: 0,
    }}>
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: `${pct * 100}%`,
        backgroundColor: fillColor,
        opacity: fillOpacity,
      }} />
    </div>
  );
}
