/**
 * TankRow — renders a <tr> for one tank across all time periods.
 */
import VerticalTankGauge from './InventoryBar';

const C = {
  bg:          '#EEF3F6',
  blendBg:     'rgba(217,101,91,.08)',
  conflictBg:  'rgba(224,162,60,.08)',
  overfillBg:  'rgba(124,58,237,.08)',
  border:      'rgba(0,79,113,.20)',
  text:        '#063A52',
  muted:       '#5E7A8A',
  amber:       '#00B398',
  blue:        '#004F71',
  red:         '#D9655B',
  purple:      '#7c3aed',
};

const STATUS_BADGE = {
  BLEND:      { bg: 'rgba(217,101,91,.15)',  color: '#D9655B' },
  RACK:       { bg: 'rgba(0,179,152,.14)',   color: '#0a7e62' },
  RECEIPT:    { bg: 'rgba(0,79,113,.10)',    color: '#004F71' },
  IDLE:       { bg: 'rgba(0,79,113,.07)',    color: '#5E7A8A' },
  CONFLICT:   { bg: 'rgba(224,162,60,.15)',  color: '#92660a' },
  OVERFILL:   { bg: 'rgba(192,136,46,.18)',  color: '#8a5e12' },
  LOW:        { bg: 'rgba(0,79,113,.10)',    color: '#004F71' },
  'RACK+RCV': { bg: 'rgba(0,179,152,.14)',   color: '#0a7e62' },
};

const CELL_LEFT_BORDER = {
  BLEND:      '3px solid #D9655B',
  CONFLICT:   '3px solid #E0A23C',
  OVERFILL:   '3px solid #C0882E',
  'RACK+RCV': '3px solid #00B398',
};

const INV_COLOR = {
  BLEND:    '#D9655B',
  CONFLICT: '#92660a',
};

export default function TankRow({ tank, periods, cells, openingFillPct, toggleBlend, onToggleIdle, onToggleRack, onCellClick, dateIndexMap }) {
  return (
    <tr>
      {/* ── Row header ─── */}
      <td style={{
        padding: '6px 8px', backgroundColor: '#EEF3F6',
        borderBottom: `0.5px solid ${C.border}`,
        borderRight: '2px solid rgba(0,79,113,.15)',
        verticalAlign: 'middle', whiteSpace: 'nowrap', position: 'sticky', left: 0, zIndex: 1,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <VerticalTankGauge fillPct={openingFillPct} status="RACK" height={36} width={8} />
          <span style={{ fontSize: '11px', color: C.text }}>{tank.label}</span>
        </div>
      </td>

      {/* ── Period cells ─── */}
      {periods.map((p) => {
        const entry    = cells?.[p.key];
        const dayIndex = dateIndexMap?.[p.date] ?? 0;
        const dayBg    = dayIndex % 2 === 0 ? '#FFFFFF' : '#F5F8FA';

        if (!entry) {
          return (
            <td key={p.key} style={{
              minWidth: '160px', backgroundColor: dayBg,
              borderBottom: `0.5px solid ${C.border}`,
              borderRight: `0.5px solid ${C.border}`,
            }} />
          );
        }

        const { status } = entry;
        const badge    = STATUS_BADGE[status] ?? STATUS_BADGE.IDLE;
        const cellBg   = status === 'BLEND'    ? C.blendBg
                       : status === 'CONFLICT' ? C.conflictBg
                       : status === 'OVERFILL' ? C.overfillBg
                       : dayBg;
        const leftBorder = CELL_LEFT_BORDER[status];
        const invColor = INV_COLOR[status] ?? C.text;
        const recVol   = entry.receipts.reduce((s, r) => s + r.volume, 0);
        const liftVol  = entry.rackLoadings;

        return (
          <td
            key={p.key}
            onClick={() => onCellClick(entry)}
            style={{
              minWidth: '160px', padding: '8px 10px', verticalAlign: 'top',
              cursor: 'pointer', backgroundColor: cellBg,
              borderBottom: `0.5px solid ${C.border}`,
              borderRight: `0.5px solid ${C.border}`,
              borderLeft: leftBorder,
            }}
          >
            {/* Status badge — display only */}
            <div style={{ marginBottom: '3px' }}>
              <span
                style={{
                  fontSize: '10px', padding: '3px 8px', borderRadius: '5px', letterSpacing: '0.3px',
                  backgroundColor: badge.bg, color: badge.color,
                  fontFamily: "'Montserrat',sans-serif", fontWeight: 800,
                  userSelect: 'none', display: 'inline-block',
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
                  fontSize: '9px', padding: '1px 5px', borderRadius: '3px',
                  backgroundColor: entry.blendActive ? 'rgba(217,101,91,.15)' : 'rgba(0,79,113,.07)',
                  color: entry.blendActive ? '#D9655B' : '#9DB0BC',
                  fontFamily: "'Montserrat',sans-serif", cursor: 'pointer', userSelect: 'none',
                }}
              >
                BLEND
              </span>
              <span
                onClick={e => { e.stopPropagation(); onToggleIdle(tank.id, entry.date, entry.timeSlot); }}
                title={entry.manualIdle ? 'Remove idle' : 'Force idle'}
                style={{
                  fontSize: '9px', padding: '1px 5px', borderRadius: '3px',
                  backgroundColor: entry.manualIdle ? 'rgba(0,79,113,.12)' : 'rgba(0,79,113,.07)',
                  color: entry.manualIdle ? '#004F71' : '#9DB0BC',
                  fontFamily: "'Montserrat',sans-serif", cursor: 'pointer', userSelect: 'none',
                  display: entry.blendActive ? 'none' : 'inline-block',
                }}
              >
                IDLE
              </span>
              <span
                onClick={e => { e.stopPropagation(); onToggleRack(tank.id, entry.date, entry.timeSlot); }}
                title={entry.manualRack ? 'Remove rack override' : 'Force rack'}
                style={{
                  fontSize: '9px', padding: '1px 5px', borderRadius: '3px',
                  backgroundColor: entry.manualRack ? 'rgba(22,101,52,.20)' : 'rgba(0,79,113,.07)',
                  color: entry.manualRack ? '#22c55e' : '#9DB0BC',
                  fontFamily: "'Montserrat',sans-serif", cursor: 'pointer', userSelect: 'none',
                  display: entry.blendActive ? 'none' : 'inline-block',
                }}
              >
                RACK
              </span>
            </div>

            {/* Vertical gauge */}
            <div style={{ marginBottom: '5px' }}>
              <VerticalTankGauge fillPct={entry.fillPct} status={status} height={56} width={16} />
            </div>

            {/* Closing inventory */}
            <div className="font-mono" style={{ fontSize: '12px', fontWeight: 600, color: invColor, lineHeight: 1.3 }}>
              {Math.round(entry.closingInventory).toLocaleString()} bbl
            </div>

            {/* RVP */}
            <div className="font-mono" style={{ fontSize: '11px', fontWeight: 700, color: '#004F71', lineHeight: 1.3 }}>
              RVP {entry.closingRVP.toFixed(2)}
            </div>

            {/* Post-blend butane addition */}
            {entry.postBlendButane > 0 && (
              <>
                <div style={{ fontSize: '9px', color: '#00B398', fontFamily: 'monospace', marginTop: '3px' }}>
                  +{Math.round(entry.postBlendButane).toLocaleString()} bbl · {entry.postBlendTrucks} trucks
                </div>
                <div style={{ fontSize: '9px', color: '#004F71', fontFamily: 'monospace' }}>
                  RVP → {entry.postBlendRVP?.toFixed(2)}
                </div>
              </>
            )}

            {/* Batch codes */}
            {entry.receipts.length > 0 && (
              <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {entry.receipts.map((r, i) => (
                  <div key={i} style={{
                    fontSize: '8px', fontFamily: 'monospace', color: C.muted,
                    backgroundColor: 'transparent', border: 'none',
                    padding: '1px 0',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    maxWidth: '140px',
                  }}>
                    {r.batchCode ?? '—'}
                    <span style={{ color: C.text, marginLeft: '4px' }}>
                      {r.volume ? Math.round(r.volume).toLocaleString() : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Sub-labels */}
            {status === 'BLEND' && (
              <div style={{ fontSize: '8px', color: '#D9655B', letterSpacing: '0.06em', marginTop: '1px' }}>OFFLINE</div>
            )}
            {status === 'CONFLICT' && (
              <div style={{ fontSize: '8px', color: '#92660a', letterSpacing: '0.06em', marginTop: '1px' }}>CONFLICT</div>
            )}
            {status === 'OVERFILL' && (
              <div style={{ fontSize: '8px', color: '#C0882E', letterSpacing: '0.06em', marginTop: '1px' }}>OVER SAFE FILL</div>
            )}
            {entry.belowHeel && (
              <div style={{ fontSize: '8px', color: '#5E7A8A', letterSpacing: '0.06em', marginTop: '1px' }}>BELOW HEEL</div>
            )}

            {/* Flows: ↑ receipts, ↓ liftings, ↗ spill */}
            {(recVol > 0 || liftVol < 0 || entry.spillVolume > 0) && (
              <div className="font-mono" style={{ fontSize: '11px', fontWeight: 700, color: '#9DB0BC', marginTop: '2px' }}>
                {recVol > 0 && <span style={{ color: '#00B398' }}>↑{Math.round(recVol).toLocaleString()}</span>}
                {recVol > 0 && liftVol < 0 && ' '}
                {liftVol < 0 && <span style={{ color: '#5E7A8A' }}>↓{Math.round(Math.abs(liftVol)).toLocaleString()}</span>}
                {entry.spillVolume > 0 && (
                  <span style={{ color: '#C0882E' }}>{(recVol > 0 || liftVol < 0) ? ' ' : ''}↗{Math.round(entry.spillVolume).toLocaleString()} spill</span>
                )}
              </div>
            )}
          </td>
        );
      })}
    </tr>
  );
}
