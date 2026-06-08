/**
 * TankRow — renders a <tr> for one tank across all time periods.
 */
import VerticalTankGauge from './InventoryBar';

const C = {
  bg:          '#111827',
  blendBg:     '#1a0a0a',
  conflictBg:  '#1a1200',
  overfillBg:  '#0f0a1a',
  border:      '#1e293b',
  borderDay:   '#2a2d3a',
  text:        '#f1f5f9',
  muted:       '#64748b',
  amber:       '#f59e0b',
  blue:        '#60a5fa',
  red:         '#ef4444',
  purple:      '#7c3aed',
};

const STATUS_BADGE = {
  BLEND:    { bg: '#ef4444', color: '#ffffff' },
  RACK:     { bg: '#166534', color: '#dcfce7' },
  RECEIPT:  { bg: '#92400e', color: '#fef3c7' },
  IDLE:     { bg: '#1e293b', color: '#64748b' },
  CONFLICT: { bg: '#f59e0b', color: '#000000' },
  OVERFILL: { bg: '#7c3aed', color: '#ffffff' },
  LOW:      { bg: '#1e3a5f', color: '#93c5fd' },
  'RACK+RCV': { bg: '#1a3a2a', color: '#86efac' },
};

const CELL_LEFT_BORDER = {
  BLEND:      '3px solid #ef4444',
  CONFLICT:   '3px solid #f59e0b',
  OVERFILL:   '3px solid #7c3aed',
  'RACK+RCV': '3px solid #22c55e',
};

const INV_COLOR = {
  BLEND:    '#fca5a5',
  CONFLICT: '#fde68a',
};

function isDaySep(periods, idx) {
  if (idx >= periods.length - 1) return true;
  return periods[idx].date !== periods[idx + 1].date;
}

export default function TankRow({ tank, periods, cells, openingFillPct, toggleBlend, onToggleIdle, onCellClick }) {
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
        const cellBg   = status === 'BLEND'    ? C.blendBg
                       : status === 'CONFLICT' ? C.conflictBg
                       : status === 'OVERFILL' ? C.overfillBg
                       : C.bg;
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
            {/* Status badge — display only */}
            <div style={{ marginBottom: '3px' }}>
              <span
                style={{
                  fontSize: '9px', padding: '1px 5px', borderRadius: '3px',
                  backgroundColor: badge.bg, color: badge.color,
                  fontFamily: 'monospace', userSelect: 'none', display: 'inline-block',
                }}
              >
                {status}
              </span>
            </div>

            {/* Blend / Idle controls */}
            <div style={{ display: 'flex', gap: '3px', marginBottom: '4px' }}>
              <span
                onClick={e => { e.stopPropagation(); toggleBlend(tank.id, entry.date, entry.timeSlot); }}
                title={entry.blendActive ? 'Remove blend' : 'Set blend'}
                style={{
                  fontSize: '8px', padding: '1px 5px', borderRadius: '3px',
                  backgroundColor: entry.blendActive ? '#ef4444' : '#1e293b',
                  color: entry.blendActive ? '#fff' : '#64748b',
                  fontFamily: 'monospace', cursor: 'pointer', userSelect: 'none',
                }}
              >
                BLEND
              </span>
              <span
                onClick={e => { e.stopPropagation(); onToggleIdle(tank.id, entry.date, entry.timeSlot); }}
                title={entry.manualIdle ? 'Remove idle' : 'Force idle'}
                style={{
                  fontSize: '8px', padding: '1px 5px', borderRadius: '3px',
                  backgroundColor: entry.manualIdle ? '#334155' : '#1e293b',
                  color: entry.manualIdle ? '#f1f5f9' : '#64748b',
                  fontFamily: 'monospace', cursor: 'pointer', userSelect: 'none',
                  display: entry.blendActive ? 'none' : 'inline-block',
                }}
              >
                IDLE
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

            {/* Sub-labels */}
            {status === 'BLEND' && (
              <div style={{ fontSize: '8px', color: C.red, letterSpacing: '0.06em', marginTop: '1px' }}>OFFLINE</div>
            )}
            {status === 'CONFLICT' && (
              <div style={{ fontSize: '8px', color: C.amber, letterSpacing: '0.06em', marginTop: '1px' }}>CONFLICT</div>
            )}
            {status === 'OVERFILL' && (
              <div style={{ fontSize: '8px', color: C.purple, letterSpacing: '0.06em', marginTop: '1px' }}>OVER SAFE FILL</div>
            )}
            {entry.belowHeel && (
              <div style={{ fontSize: '8px', color: '#93c5fd', letterSpacing: '0.06em', marginTop: '1px' }}>BELOW HEEL</div>
            )}

            {/* Flows: ↑ receipts, ↓ liftings, ↗ spill */}
            {(recVol > 0 || liftVol < 0 || entry.spillVolume > 0) && (
              <div className="font-mono" style={{ fontSize: '9px', color: C.muted, marginTop: '2px' }}>
                {recVol > 0 && <span style={{ color: C.amber }}>↑{Math.round(recVol).toLocaleString()}</span>}
                {recVol > 0 && liftVol < 0 && ' '}
                {liftVol < 0 && <span>↓{Math.round(Math.abs(liftVol)).toLocaleString()}</span>}
                {entry.spillVolume > 0 && (
                  <span style={{ color: C.purple }}>{(recVol > 0 || liftVol < 0) ? ' ' : ''}↗{Math.round(entry.spillVolume).toLocaleString()} spill</span>
                )}
              </div>
            )}
          </td>
        );
      })}
    </tr>
  );
}
