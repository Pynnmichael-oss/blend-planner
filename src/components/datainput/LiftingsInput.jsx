import { useState } from 'react';
import { buildLiftingsGridWithBase, DEFAULT_DAILY_BASE } from '../../data/liftingsCurve';

const SLOT_DIST = { '00-05': 0.15, '06-11': 0.30, '12-17': 0.35, '18-23': 0.20 };
const TIME_SLOTS = ['00-05', '06-11', '12-17', '18-23'];
const WEEKDAY_MULT = {
  Monday: 1.0, Tuesday: 1.05, Wednesday: 1.0, Thursday: 1.05,
  Friday: 1.1, Saturday: 0.8, Sunday: 0.6,
};
const WEEKDAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const WEEKDAY_ABBR  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const C = {
  bg: '#0a0c12', panel: '#111827', border: '#1e293b',
  text: '#f1f5f9', muted: '#64748b', amber: '#f59e0b',
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
};
const tdStyle = {
  padding: '3px 8px', fontSize: '11px', color: C.text,
  borderBottom: `0.5px solid ${C.border}`, whiteSpace: 'nowrap',
};

export default function LiftingsInput({ terminalConfig, liftings, onLiftingsChange, planDays, startDate }) {
  const [baseReg,  setBaseReg]  = useState(String(DEFAULT_DAILY_BASE.regular));
  const [basePrem, setBasePrem] = useState(String(DEFAULT_DAILY_BASE.premium));

  const dates = getDates(startDate, planDays);
  const productKeys = Object.keys(terminalConfig.products);

  // Build lookup: productKey-date-timeSlot → volume (supports both formats)
  const lookup = {};
  for (const l of liftings) {
    const pk = l.productKey ?? Object.entries(terminalConfig.products)
      .find(([, p]) => p.tanks.some(t => t.id === l.tankId))?.[0];
    if (pk) lookup[`${pk}-${l.date}-${l.timeSlot}`] = (lookup[`${pk}-${l.date}-${l.timeSlot}`] ?? 0) + l.volume;
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
    const updated = liftings.filter(l =>
      !(l.productKey === productKey &&
        l.date === date &&
        l.timeSlot === timeSlot)
    );
    updated.push({ productKey, tankId: null, date, timeSlot, volume: totalNeg });
    onLiftingsChange(updated);
  }

  // Distribute a daily total edit across all 4 slots using SLOT_DIST weights
  function handleDayChange(productKey, date, rawValue) {
    const newTotal = Math.abs(parseFloat(rawValue) || 0);
    const updated = liftings.filter(l => !(l.productKey === productKey && l.date === date));
    for (const slot of TIME_SLOTS) {
      updated.push({ productKey, tankId: null, date, timeSlot: slot,
        volume: -(Math.round(newTotal * (SLOT_DIST[slot] ?? 0.25))) });
    }
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
    backgroundColor: C.bg, color: C.text, border: `1px solid ${C.border}`,
    borderRadius: '3px', padding: '2px 4px',
  };

  return (
    <div>
      <div style={{ fontSize: '10px', color: C.amber, fontWeight: 'bold', letterSpacing: '0.07em', marginBottom: '10px', textTransform: 'uppercase' }}>
        Rack Liftings
      </div>

      {/* TOP: Weekly base rate */}
      <div style={{
        backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: '6px',
        padding: '10px 12px', marginBottom: '14px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: C.muted }}>Regular</span>
            <input
              type="number"
              value={baseReg}
              onChange={e => setBaseReg(e.target.value)}
              className="font-mono"
              style={inputStyle}
            />
            <span style={{ fontSize: '11px', color: C.muted }}>bbl/day</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: C.muted }}>Premium</span>
            <input
              type="number"
              value={basePrem}
              onChange={e => setBasePrem(e.target.value)}
              className="font-mono"
              style={inputStyle}
            />
            <span style={{ fontSize: '11px', color: C.muted }}>bbl/day</span>
          </div>

          <button
            onClick={handleApply}
            style={{
              padding: '3px 14px', fontSize: '11px', fontWeight: 'bold',
              backgroundColor: C.amber, color: '#000',
              border: 'none', borderRadius: '3px', cursor: 'pointer',
            }}
          >
            Apply
          </button>
        </div>
        <div style={{ fontSize: '10px', color: C.muted, marginTop: '6px' }}>
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
              <th key={pk} style={{ ...thStyle, color: C.amber }}>
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
                        color:  isOverride ? C.amber : C.text,
                        border: `1px solid ${isOverride ? C.amber : C.border}`,
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
          backgroundColor: C.panel, color: C.muted,
          border: `1px solid ${C.border}`, borderRadius: '3px', cursor: 'pointer',
        }}
      >
        Reset to curve defaults
      </button>
    </div>
  );
}
