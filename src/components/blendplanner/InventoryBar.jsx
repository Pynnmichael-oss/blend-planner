/**
 * VerticalTankGauge — tank shell with fill rising from the bottom.
 * Props: { fillPct, status, height = 48, width = 16 }
 */

const STATUS_FILL = {
  BLEND:    { color: '#ef4444', opacity: 0.6 },
  RACK:     { color: '#378ADD', opacity: 1   },
  RECEIPT:  { color: '#f59e0b', opacity: 1   },
  IDLE:     { color: '#475569', opacity: 1   },
  CONFLICT: { color: '#f59e0b', opacity: 1   },
};

export default function VerticalTankGauge({ fillPct, status, height = 48, width = 16 }) {
  const pct = Math.min(1, Math.max(0, fillPct ?? 0));

  let fillColor, fillOpacity = 1;
  if (pct > 0.95) {
    fillColor = '#f59e0b';
  } else if (pct < 0.15) {
    fillColor = '#ef4444';
  } else {
    const s = STATUS_FILL[status] ?? STATUS_FILL.IDLE;
    fillColor   = s.color;
    fillOpacity = s.opacity;
  }

  return (
    <div style={{
      width, height, position: 'relative',
      backgroundColor: '#0f172a',
      borderRadius: '2px 2px 0 0',
      border: '0.5px solid #334155',
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
