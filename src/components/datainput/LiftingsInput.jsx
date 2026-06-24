import { useState } from 'react';
import { buildLiftingsGridWithBase, DEFAULT_DAILY_BASE } from '../../data/liftingsCurve';

const SLOT_DIST = { '00-05': 0.15, '06-11': 0.30, '12-17': 0.35, '18-23': 0.20 };
const SLOT_CONFIG = [
  { calcKey: '00-05', dist: 0.15 },
  { calcKey: '06-11', dist: 0.30 },
  { calcKey: '12-17', dist: 0.35 },
  { calcKey: '18-23', dist: 0.20 },
];
const TIME_SLOTS = ['00-05', '06-11', '12-17', '18-23'];
const WEEKDAY_MULT = {
  Monday: 1.0, Tuesday: 1.05, Wednesday: 1.0, Thursday: 1.05,
  Friday: 1.1, Saturday: 0.8, Sunday: 0.6,
};
const WEEKDAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const WEEKDAY_ABBR  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const C = {
  bg:       '#EEF3F6',
  panel:    '#FFFFFF',
  border:   'rgba(0,79,113,.13)',
  borderEm: 'rgba(0,79,113,.25)',
  text:     '#063A52',
  muted:    '#5E7A8A',
  amber:    '#00B398',
  blue:     '#004F71',
  red:      '#D9655B',
  green:    '#0a7e62',
};

function utcWeekdayName(dateStr) {
  return WEEKDAY_NAMES[new Date(dateStr + 'T00:00:00Z').getUTCDay()];
}
function utcWeekdayAbbr(dateStr) {
  return WEEKDAY_ABBR[new Date(dateStr + 'T00:00:00Z').getUTCDay()];
}
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

const thStyle = {
  padding: '4px 8px', fontSize: '10px', color: C.muted, fontWeight: 'normal',
  borderBottom: `1px solid ${C.border}`, textAlign: 'left', whiteSpace: 'nowrap',
  fontFamily: "'Montserrat',sans-serif",
};
const tdStyle = {
  padding: '3px 8px', fontSize: '11px', color: C.text,
  borderBottom: `0.5px solid ${C.border}`, whiteSpace: 'nowrap',
  fontFamily: "'Montserrat',sans-serif",
};

export default function LiftingsInput({ terminalConfig, liftings, onLiftingsChange, planDays, startDate }) {
  const [baseReg,  setBaseReg]  = useState(String(DEFAULT_DAILY_BASE.regular));
  const [basePrem, setBasePrem] = useState(String(DEFAULT_DAILY_BASE.premium));

  const dates = getDates(startDate, planDays);
  const productKeys = Object.keys(terminalConfig.products);

  // Build lookup: productKey-date-timeSlot → volume (summed across tanks)
  const lookup = {};
  for (const l of liftings) {
    const pk = Object.entries(terminalConfig.products)
      .find(([, p]) => p.tanks.some(t => t.id === l.tankId))?.[0];
    if (pk) lookup[`${pk}-${l.date}-${l.timeSlot}`] =
      (lookup[`${pk}-${l.date}-${l.timeSlot}`] ?? 0) + l.volume;
  }

  // Sum absolute liftings for a product on a given date across all slots
  function getDayTotal(productKey, date) {
    let sum = 0;
    for (const slot of TIME_SLOTS) sum += lookup[`${productKey}-${date}-${slot}`] ?? 0;
    return Math.abs(Math.round(sum));
  }

  // Expected daily total from current base inputs (for amber override detection)
  function getExpected(productKey, date) {
    const base = productKey === 'regular'
      ? (parseFloat(baseReg) || 0)
      : (parseFloat(basePrem) || 0);
    const mult = WEEKDAY_MULT[utcWeekdayName(date)] ?? 1;
    return Math.round(base * mult);
  }

  function handleCellChange(productKey, date, timeSlot, rawValue) {
    const totalNeg = -(Math.abs(parseFloat(rawValue) || 0));
    const tanks = terminalConfig.products[productKey]?.tanks ?? [];
    if (!tanks.length) return;
    const perTank = Math.round(totalNeg / tanks.length);
    const updated = liftings.map(l => {
      if (l.date === date && l.timeSlot === timeSlot &&
          tanks.some(t => t.id === l.tankId)) {
        return { ...l, volume: perTank };
      }
      return l;
    });
    onLiftingsChange(updated);
  }

  function handleDayChange(productKey, date, rawValue) {
    const newTotal = Math.abs(parseFloat(rawValue) || 0);
    const tanks = terminalConfig.products[productKey]?.tanks ?? [];
    if (!tanks.length) return;
    const updated = liftings.map(l => {
      if (l.date === date && tanks.some(t => t.id === l.tankId)) {
        const slot = SLOT_CONFIG.find(s => s.calcKey === l.timeSlot);
        const dist = slot?.dist ?? 0.25;
        return { ...l, volume: -(Math.round(newTotal * dist)) };
      }
      return l;
    });
    onLiftingsChange(updated);
  }

  function handleApply() {
    const base = {
      regular: parseFloat(baseReg) || 0,
      premium: parseFloat(basePrem) || 0,
    };
    onLiftingsChange(buildLiftingsGridWithBase(terminalConfig, startDate, planDays, base));
  }

  function handleReset() {
    setBaseReg(String(DEFAULT_DAILY_BASE.regular));
    setBasePrem(String(DEFAULT_DAILY_BASE.premium));
    onLiftingsChange(buildLiftingsGridWithBase(terminalConfig, startDate, planDays, DEFAULT_DAILY_BASE));
  }

  const inputStyle = {
    width: '72px', textAlign: 'right', fontSize: '11px',
    backgroundColor: '#EEF3F6', color: C.text, border: `1px solid ${C.border}`,
    borderRadius: '9px', padding: '2px 4px', fontFamily: "'Montserrat',sans-serif",
  };

  return (
    <div>
      <div style={{ fontSize: '10px', color: '#004F71', fontWeight: 'bold', letterSpacing: '0.07em', marginBottom: '10px', textTransform: 'uppercase' }}>
        Rack Liftings
      </div>

      {/* TOP: Weekly base rate */}
      <div style={{
        backgroundColor: '#FFFFFF', border: `1px solid ${C.border}`, borderRadius: '12px',
        padding: '10px 12px', marginBottom: '14px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: C.muted, fontFamily: "'Montserrat',sans-serif" }}>Regular</span>
            <input
              type="number"
              value={baseReg}
              onChange={e => setBaseReg(e.target.value)}
              className="font-mono"
              style={inputStyle}
            />
            <span style={{ fontSize: '11px', color: C.muted, fontFamily: "'Montserrat',sans-serif" }}>bbl/day</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: C.muted, fontFamily: "'Montserrat',sans-serif" }}>Premium</span>
            <input
              type="number"
              value={basePrem}
              onChange={e => setBasePrem(e.target.value)}
              className="font-mono"
              style={inputStyle}
            />
            <span style={{ fontSize: '11px', color: C.muted, fontFamily: "'Montserrat',sans-serif" }}>bbl/day</span>
          </div>

          <button
            onClick={handleApply}
            style={{
              padding: '3px 14px', fontSize: '11px', fontWeight: 700,
              backgroundColor: '#004F71', color: '#FFFFFF',
              border: 'none', borderRadius: '9px', cursor: 'pointer',
              fontFamily: "'Montserrat',sans-serif",
            }}
          >
            Apply
          </button>
        </div>
        <div style={{ fontSize: '10px', color: C.muted, marginTop: '6px', fontFamily: "'Montserrat',sans-serif" }}>
          Curve distributes across days and time slots automatically
        </div>
      </div>

      {/* BOTTOM: Day totals table */}
      <table style={{ borderCollapse: 'collapse', fontSize: '11px' }}>
        <thead>
          <tr>
            <th style={thStyle}>Day</th>
            <th style={{ ...thStyle, paddingRight: '16px' }}>Date</th>
            {productKeys.map(pk => (
              <th key={pk} style={{ ...thStyle, color: '#004F71' }}>
                {terminalConfig.products[pk].label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dates.map(date => (
            <tr key={date}>
              <td style={{ ...tdStyle, color: C.muted }}>{utcWeekdayAbbr(date)}</td>
              <td style={{ ...tdStyle, color: C.muted, paddingRight: '16px' }}>{shortDate(date)}</td>
              {productKeys.map(pk => {
                const actual   = getDayTotal(pk, date);
                const expected = getExpected(pk, date);
                const isOverride = actual !== expected;
                return (
                  <td key={pk} style={{ padding: '2px 4px', borderBottom: `0.5px solid ${C.border}` }}>
                    <input
                      type="number"
                      value={actual || ''}
                      onChange={e => handleDayChange(pk, date, e.target.value)}
                      className="font-mono"
                      style={{
                        ...inputStyle,
                        borderRadius: '6px',
                        color:  isOverride ? '#00B398' : C.text,
                        border: `1px solid ${isOverride ? '#00B398' : C.border}`,
                      }}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <button
        onClick={handleReset}
        style={{
          marginTop: '10px', fontSize: '11px', padding: '2px 8px',
          backgroundColor: '#FFFFFF', color: C.muted,
          border: `1px solid ${C.border}`, borderRadius: '9px', cursor: 'pointer',
          fontFamily: "'Montserrat',sans-serif",
        }}
      >
        Reset to curve defaults
      </button>
    </div>
  );
}
