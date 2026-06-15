import { useState, useEffect } from 'react';
import { detectBlends } from '../../data/blendPlanSummary';
import SavePlanButton from '../shared/SavePlanButton';

const C = {
  bg: '#0a0c12', panel: '#111827', panel2: '#0f1117',
  border: '#1e293b', text: '#f1f5f9', muted: '#64748b', amber: '#f59e0b', blue: '#60a5fa',
  red: '#ef4444', green: '#22c55e',
};

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  const wd = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(dateStr + 'T00:00:00Z').getUTCDay()];
  return `${wd} ${MONTH_ABBR[parseInt(m,10)-1]} ${parseInt(d,10)}`;
}

function th(label) {
  return (
    <th style={{
      padding: '4px 8px', fontSize: '10px', color: C.amber, fontWeight: 'bold',
      textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'left',
      borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap',
    }}>
      {label}
    </th>
  );
}

function td(children, mono = false, style = {}) {
  return (
    <td style={{
      padding: '4px 8px', fontSize: '12px', color: C.text,
      borderBottom: `0.5px solid ${C.border}`, whiteSpace: 'nowrap',
      fontFamily: mono ? 'monospace' : 'inherit', ...style,
    }}>
      {children}
    </td>
  );
}

// Per-blend butane calculator local state
function BlendCalculator({ blend, terminalConfig }) {
  const tank = Object.values(terminalConfig.products)
    .flatMap(p => p.tanks).find(t => t.id === blend.tankId);

  const [pumpable,  setPumpable]  = useState('');
  const [rvpTarget, setRvpTarget] = useState('');
  const [rvpActual, setRvpActual] = useState('');

  useEffect(() => {
    if (blend.estPumpable) setPumpable(String(Math.round(blend.estPumpable)));
    if (blend.rvpActual)   setRvpActual(String(blend.rvpActual.toFixed(2)));
    setRvpTarget('8.75');
  }, [blend.estPumpable, blend.rvpActual]);

  const pump = parseFloat(pumpable) || 0;
  const tgt  = parseFloat(rvpTarget);
  const act  = parseFloat(rvpActual);
  const heel = blend.heel;
  const tov  = pump > 0 ? pump + heel : null;
  const margin = (!isNaN(tgt) && !isNaN(act)) ? (tgt - act) : null;

  // Spec formula: 0.02 × TOV × (rvpTarget - rvpActual)
  const butane = (tov && margin !== null && margin > 0) ? 0.02 * tov * margin : null;
  const maxTrucks = butane !== null ? Math.floor(butane / 190) : null;

  const tankConfig = Object.values(terminalConfig.products)
    .flatMap(p => p.tanks).find(t => t.id === blend.tankId);
  const safeFill = tankConfig?.safeFill ?? 0;
  const space = pump > 0 ? safeFill - pump - heel : null;
  const warnHeadroom = space !== null && butane !== null && butane > space;

  const warnLowMargin = margin !== null && margin < 1.8 && margin >= 0;
  const warnNoPumpable = butane !== null && pumpable === '';

  const row = (label, value, mono = true, color = C.text) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
      <span style={{ fontSize: '11px', color: C.muted }}>{label}</span>
      <span className={mono ? 'font-mono' : ''} style={{ fontSize: '11px', color }}>{value}</span>
    </div>
  );

  const inputRow = (label, value, onChange, color = C.text) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
      <span style={{ fontSize: '11px', color: C.muted }}>{label}</span>
      <input
        type="number" step="0.1" value={value}
        onChange={e => onChange(e.target.value)}
        className="font-mono"
        style={{
          width: '72px', textAlign: 'right', fontSize: '11px',
          backgroundColor: C.bg, color, border: `1px solid ${C.border}`,
          borderRadius: '3px', padding: '2px 4px',
        }}
      />
    </div>
  );

  return (
    <div style={{
      backgroundColor: C.bg, border: `1px solid ${C.border}`,
      borderRadius: '6px', padding: '12px', width: '280px', flexShrink: 0,
    }}>
      <div style={{ fontSize: '12px', fontWeight: 'bold', color: C.text, marginBottom: '2px' }}>
        Blend {blend.blendNumber} — {blend.tankLabel}
      </div>
      <div style={{ fontSize: '10px', color: C.muted, marginBottom: '10px' }}>
        {fmtDate(blend.startDate)} {blend.startTime} → {blend.endTime} ({blend.periods} period{blend.periods !== 1 ? 's' : ''})
      </div>

      {inputRow('Pumpable (bbl)', pumpable, setPumpable)}
      {row('Heel', heel.toLocaleString())}
      {row('TOV', tov ? tov.toLocaleString() : '—', true, tov ? C.text : C.muted)}
      <div style={{ borderTop: `1px solid ${C.border}`, margin: '8px 0' }} />
      {inputRow('RVP Target', rvpTarget, setRvpTarget, C.blue)}
      {inputRow('RVP Actual', rvpActual, setRvpActual, C.blue)}
      {row('Margin', margin !== null ? margin.toFixed(2) : '—', true, warnLowMargin ? C.amber : C.text)}
      <div style={{ borderTop: `1px solid ${C.border}`, margin: '8px 0' }} />
      {row('Butane needed', butane !== null ? `${Math.round(butane).toLocaleString()} bbl` : '—', true, butane ? C.amber : C.muted)}
      {row('Trucks', maxTrucks !== null ? `${maxTrucks}` : '—', true)}
      {maxTrucks !== null && (
        <div style={{ fontSize: '10px', color: C.muted, textAlign: 'right', marginBottom: '4px' }}>
          Partial trucks not dispatched — remainder stages to TK03
        </div>
      )}

      {warnHeadroom && (
        <div style={{ fontSize: '10px', color: C.amber, marginTop: '4px' }}>
          ⚠ Butane volume exceeds available headroom — confirm safe fill before scheduling
        </div>
      )}
      {warnLowMargin && (
        <div style={{ fontSize: '10px', color: C.amber, marginTop: '6px' }}>
          ⚠ Margin below minimum (1.8)
        </div>
      )}
      {warnNoPumpable && (
        <div style={{ fontSize: '10px', color: C.amber, marginTop: '4px' }}>
          ⚠ Enter pumpable volume to calculate trucks
        </div>
      )}

      <div style={{ borderTop: `1px solid ${C.border}`, marginTop: '10px', paddingTop: '8px' }}>
        <div style={{ fontSize: '10px', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
          Truck Window
        </div>
        <div style={{ fontSize: '11px', color: C.text }}>
          Start &nbsp;&nbsp; {fmtDate(blend.startDate)} {blend.startTime}
        </div>
        <div style={{ fontSize: '11px', color: blend.truckFinish ? C.text : C.muted }}>
          Finish &nbsp;{blend.truckFinish
            ? `${fmtDate(blend.truckFinish.split(' ')[0])} ${blend.truckFinish.split(' ')[1]}`
            : '— (O-3: single period)'}
        </div>
      </div>
    </div>
  );
}

export default function BlendPlanSummary({ grid, terminalConfig, openingInventory = [], liftings = [], startDate }) {
  const blends = detectBlends(grid, terminalConfig);

  const titleDateRange = blends.length
    ? (() => {
        const earliest = blends[0].startDate;
        const latest   = blends[blends.length - 1].endDate;
        return `${fmtDate(earliest)} – ${fmtDate(latest)}`;
      })()
    : '—';

  const title = `${(terminalConfig?.name ?? 'TERMINAL').toUpperCase()} TENTATIVE BLEND PLAN`;

  if (!blends.length) {
    return (
      <div style={{ padding: '16px', color: C.muted, fontSize: '12px' }}>
        No blend periods detected. Toggle tanks to BLEND in the grid above.
      </div>
    );
  }

  const thStyle = { padding: '4px 8px', fontSize: '10px', fontWeight: 'bold', color: C.amber, textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'left', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' };
  const tdBase  = { padding: '5px 8px', fontSize: '12px', color: C.text, borderBottom: `0.5px solid ${C.border}`, whiteSpace: 'nowrap' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Section A — summary table */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
          <span style={{ fontSize: '11px', fontWeight: 'bold', color: C.text, letterSpacing: '0.05em' }}>
            {title}
          </span>
          <span style={{ fontSize: '11px', color: C.muted }}>{titleDateRange}</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: '12px', width: '100%' }}>
            <thead>
              <tr>
                {['#','Tank','Start','End','Est Pumpable','Est TOV','Margin','Butane','Trucks','Blended RVP','Truck Start','Truck Finish'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {blends.map((b, idx) => (
                <tr key={b.blendNumber} style={{ backgroundColor: idx % 2 === 0 ? C.panel : C.panel2 }}>
                  <td style={{ ...tdBase, fontFamily: 'monospace' }}>{b.blendNumber}</td>
                  <td style={tdBase}>{b.tankLabel}</td>
                  <td style={{ ...tdBase, fontFamily: 'monospace' }}>{b.startDate} {b.startTime}</td>
                  <td style={{ ...tdBase, fontFamily: 'monospace' }}>{b.endDate} {b.endTime}</td>
                  <td style={{ ...tdBase, fontFamily: 'monospace' }}>
                    {b.estPumpable ? Math.round(b.estPumpable).toLocaleString() : <span style={{ color: C.muted }}>—</span>}
                  </td>
                  <td style={{ ...tdBase, fontFamily: 'monospace' }}>
                    {b.estTOV ? Math.round(b.estTOV).toLocaleString() : <span style={{ color: C.muted }}>—</span>}
                  </td>
                  <td style={{ ...tdBase, fontFamily: 'monospace' }}>
                    {b.minMargin} – {b.maxMargin}
                  </td>
                  <td style={{ ...tdBase, fontFamily: 'monospace' }}>
                    {b.butane_bbls ? Math.round(b.butane_bbls).toLocaleString() + ' bbl' : <span style={{ color: C.muted }}>—</span>}
                  </td>
                  <td style={{ ...tdBase, fontFamily: 'monospace' }}>
                    {b.trucks !== null ? b.trucks : <span style={{ color: C.muted }}>—</span>}
                  </td>
                  <td style={{ ...tdBase, fontFamily: 'monospace', color: C.blue }}>
                    {b.blendedRVP ? b.blendedRVP.toFixed(2) : <span style={{ color: C.muted }}>—</span>}
                  </td>
                  <td style={{ ...tdBase, fontFamily: 'monospace' }}>{b.truckStart}</td>
                  <td style={{ ...tdBase, fontFamily: 'monospace' }}>
                    {b.truckFinish ?? (
                      <span style={{ color: C.muted }} title="Single-period blend (O-3 unresolved)">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section B — butane calculators */}
      <div>
        <div style={{ fontSize: '10px', color: C.amber, fontWeight: 'bold', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>
          Butane Calculator
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          {blends.map(b => (
            <BlendCalculator key={b.blendNumber} blend={b} terminalConfig={terminalConfig} />
          ))}
        </div>
      </div>

      {/* Section C — save to history */}
      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: '14px' }}>
        <SavePlanButton
          blends={blends}
          terminalConfig={terminalConfig}
          openingInventory={openingInventory}
          liftings={liftings}
          startDate={startDate}
        />
      </div>
    </div>
  );
}
