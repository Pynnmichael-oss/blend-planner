import { buildLiftingsGrid } from '../../data/liftingsCurve';
import { TIME_SLOTS } from '../../data/inventoryCalc';

const SLOT_LABEL = { "00-05": "00:00", "06-11": "06:00", "12-17": "12:00", "18-23": "18:00" };
const WEEKDAY_ABBR = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const C = {
  bg: '#0f1117', panel: '#1a1d27', border: '#2a2d3a',
  text: '#e2e8f0', muted: '#64748b', amber: '#f59e0b',
};

function getDates(startDate, planDays) {
  const dates = [];
  for (let i = 0; i < planDays; i++) {
    const d = new Date(startDate + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function shortDate(dateStr) {
  const [, m, d] = dateStr.split('-');
  return `${parseInt(m)}/${parseInt(d)}`;
}

function weekdayAbbr(dateStr) {
  return WEEKDAY_ABBR[new Date(dateStr + 'T00:00:00Z').getUTCDay()];
}

export default function LiftingsInput({ terminalConfig, liftings, onLiftingsChange, planDays, startDate }) {
  const dates = getDates(startDate, planDays);

  // Build lookup: tankId-date-slot → volume
  const lookup = {};
  for (const l of liftings) lookup[`${l.tankId}-${l.date}-${l.timeSlot}`] = l.volume;

  // Sum liftings for a product/date/slot across all its tanks
  function getProductTotal(productKey, date, timeSlot) {
    const tanks = terminalConfig.products[productKey]?.tanks ?? [];
    return tanks.reduce((sum, t) => sum + (lookup[`${t.id}-${date}-${timeSlot}`] ?? 0), 0);
  }

  // On edit: redistribute new total evenly across tanks for this product/date/slot
  function handleCellChange(productKey, date, timeSlot, rawValue) {
    const totalNeg = -(Math.abs(parseFloat(rawValue) || 0));
    const tanks = terminalConfig.products[productKey]?.tanks ?? [];
    if (!tanks.length) return;
    const perTank = Math.round(totalNeg / tanks.length);

    const updated = liftings.map(l => {
      if (l.date === date && l.timeSlot === timeSlot && tanks.some(t => t.id === l.tankId)) {
        return { ...l, volume: perTank };
      }
      return l;
    });
    onLiftingsChange(updated);
  }

  const thStyle = {
    padding: '2px 4px', fontSize: '10px', color: C.muted, fontWeight: 'normal',
    borderBottom: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}`,
    textAlign: 'center', backgroundColor: C.panel, whiteSpace: 'nowrap',
  };

  return (
    <div>
      <div style={{ fontSize: '10px', color: C.amber, fontWeight: 'bold', letterSpacing: '0.07em', marginBottom: '6px', textTransform: 'uppercase' }}>
        Rack Liftings (bbl)
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: '11px' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, textAlign: 'left', minWidth: '60px' }}></th>
              {dates.map(date => (
                <th key={date} colSpan={4} style={{ ...thStyle, color: C.amber }}>
                  {weekdayAbbr(date)} {shortDate(date)}
                </th>
              ))}
            </tr>
            <tr>
              <th style={{ ...thStyle, textAlign: 'left' }}></th>
              {dates.flatMap(date =>
                TIME_SLOTS.map(slot => (
                  <th key={`${date}-${slot}`} style={thStyle}>{SLOT_LABEL[slot]}</th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {Object.entries(terminalConfig.products).map(([pk, product]) => (
              <tr key={pk} style={{ borderTop: `1px solid ${C.border}` }}>
                <td style={{ padding: '3px 6px', color: C.text, whiteSpace: 'nowrap', backgroundColor: C.panel, fontSize: '11px' }}>
                  {product.label}
                </td>
                {dates.flatMap(date =>
                  TIME_SLOTS.map(slot => {
                    const total = getProductTotal(pk, date, slot);
                    return (
                      <td key={`${date}-${slot}`} style={{ padding: '1px 2px', borderRight: `1px solid ${C.border}`, backgroundColor: C.bg }}>
                        <input
                          type="number"
                          value={Math.abs(total) || ''}
                          onChange={e => handleCellChange(pk, date, slot, e.target.value)}
                          className="font-mono"
                          style={{
                            width: '54px', textAlign: 'right', fontSize: '11px',
                            backgroundColor: 'transparent', color: C.text,
                            border: 'none', outline: 'none', padding: '2px 3px',
                          }}
                        />
                      </td>
                    );
                  })
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        onClick={() => onLiftingsChange(buildLiftingsGrid(terminalConfig, startDate, planDays))}
        style={{
          marginTop: '6px', fontSize: '11px', padding: '2px 8px',
          backgroundColor: C.panel, color: C.muted,
          border: `1px solid ${C.border}`, borderRadius: '3px', cursor: 'pointer',
        }}
      >
        Reset to curve defaults
      </button>
    </div>
  );
}
