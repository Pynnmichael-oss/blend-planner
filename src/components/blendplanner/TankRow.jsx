/**
 * TankRow — renders a <tr> for one tank across all time periods.
 */
import VerticalTankGauge from './InventoryBar';

const C = {
  bg:          '#111827',
  blendBg:     '#1a0a0a',
  conflictBg:  '#1a1200',
  border:      '#1e293b',
  borderDay:   '#2a2d3a',
  text:        '#f1f5f9',
  muted:       '#64748b',
  amber:       '#f59e0b',
  blue:        '#60a5fa',
  red:         '#ef4444',
};

const STATUS_BADGE = {
  BLEND:    { bg: '#ef4444', color: '#ffffff' },
  RACK:     { bg: '#166534', color: '#dcfce7' },
  RECEIPT:  { bg: '#92400e', color: '#fef3c7' },
  IDLE:     { bg: '#1e293b', color: '#64748b' },
  CONFLICT: { bg: '#f59e0b', color: '#000000' },
};

const CELL_LEFT_BORDER = {
  BLEND:    '3px solid #ef4444',
  CONFLICT: '3px solid #f59e0b',
};

const INV_COLOR = {
  BLEND:    '#fca5a5',
  CONFLICT: '#fde68a',
};

function isDaySep(periods, idx) {
  if (idx >= periods.length - 1) return true;
  return periods[idx].date !== periods[idx + 1].date;
}

export default function TankRow({ tank, periods, cells, openingFillPct, toggleBlend, onCellClick }) {
  return (
    <tr>
      {/* ── Row header ─── */}
      <td style={{
        padding: '6px 8px', backgroundColor: C.bg,
        borderBottom: `0.5px solid ${C.border}`, borderRight: `1px solid ${C.borderDay}`,
        verticalAlign: 'middle', whiteSpace: 'nowrap', position: 'sticky', left: 0, zIndex: 1,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <VerticalTankGauge fillPct={openingFillPct} status="RACK" height={36} width={8} />
          <span style={{ fontSize: '11px', color: C.text }}>{tank.label}</span>
        </div>
      </td>

      {/* ── Period cells ─── */}
      {periods.map((p, idx) => {
        const entry  = cells?.[p.key];
        const daySep = isDaySep(periods, idx);

        if (!entry) {
          return (
            <td key={p.key} style={{
              minWidth: '108px', backgroundColor: C.bg,
              borderBottom: `0.5px solid ${C.border}`,
              borderRight: daySep ? `1px solid ${C.borderDay}` : `0.5px solid ${C.border}`,
            }} />
          );
        }

        const { status } = entry;
        const badge    = STATUS_BADGE[status] ?? STATUS_BADGE.IDLE;
        const cellBg   = status === 'BLEND' ? C.blendBg : status === 'CONFLICT' ? C.conflictBg : C.bg;
        const leftBorder = CELL_LEFT_BORDER[status];
        const invColor = INV_COLOR[status] ?? C.text;
        const recVol   = entry.receipts.reduce((s, r) => s + r.volume, 0);
        const liftVol  = entry.rackLoadings;

        return (
          <td
            key={p.key}
            onClick={() => onCellClick(entry)}
            style={{
              minWidth: '108px', padding: '6px 8px', verticalAlign: 'top',
              cursor: 'pointer', backgroundColor: cellBg,
              borderBottom: `0.5px solid ${C.border}`,
              borderRight: daySep ? `1px solid ${C.borderDay}` : `0.5px solid ${C.border}`,
              borderLeft: leftBorder,
            }}
          >
            {/* Status badge — click toggles blend */}
            <div style={{ marginBottom: '4px' }}>
              <span
                onClick={e => { e.stopPropagation(); toggleBlend(tank.id, entry.date, entry.timeSlot); }}
                style={{
                  fontSize: '9px', padding: '1px 5px', borderRadius: '3px',
                  backgroundColor: badge.bg, color: badge.color,
                  fontFamily: 'monospace', cursor: 'pointer', userSelect: 'none', display: 'inline-block',
                }}
              >
                {status}
              </span>
            </div>

            {/* Vertical gauge */}
            <div style={{ marginBottom: '5px' }}>
              <VerticalTankGauge fillPct={entry.fillPct} status={status} height={48} width={16} />
            </div>

            {/* Closing inventory */}
            <div className="font-mono" style={{ fontSize: '11px', color: invColor, lineHeight: 1.3 }}>
              {Math.round(entry.closingInventory).toLocaleString()} bbl
            </div>

            {/* RVP */}
            <div className="font-mono" style={{ fontSize: '10px', color: C.blue, lineHeight: 1.3 }}>
              RVP {entry.closingRVP.toFixed(2)}
            </div>

            {/* OFFLINE / CONFLICT inline label */}
            {(status === 'BLEND') && (
              <div style={{ fontSize: '8px', color: C.red, letterSpacing: '0.06em', marginTop: '1px' }}>OFFLINE</div>
            )}
            {(status === 'CONFLICT') && (
              <div style={{ fontSize: '8px', color: C.amber, letterSpacing: '0.06em', marginTop: '1px' }}>CONFLICT</div>
            )}

            {/* Flows: ↑ receipts, ↓ liftings */}
            {(recVol > 0 || liftVol < 0) && (
              <div className="font-mono" style={{ fontSize: '9px', color: C.muted, marginTop: '2px' }}>
                {recVol  > 0 && <span style={{ color: status === 'CONFLICT' ? C.amber : C.amber }}>↑{Math.round(recVol).toLocaleString()}</span>}
                {recVol  > 0 && liftVol < 0 && ' '}
                {liftVol < 0 && <span>↓{Math.round(Math.abs(liftVol)).toLocaleString()}</span>}
              </div>
            )}
          </td>
        );
      })}
    </tr>
  );
}
