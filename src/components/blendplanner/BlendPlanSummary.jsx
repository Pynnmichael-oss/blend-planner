import { useState, useEffect, useRef } from 'react';
// specCeiling and blendTarget are lifted to useBlendPlanner — received as props
import { detectBlends } from '../../data/blendPlanSummary';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
// generateBlendPDF (per-blend PDF export) is no longer called from the
// "Save Blend PDFs" button below — replaced with a single image-based PDF
// capture of the on-screen summary via html2canvas. generateBlendPDF.js is
// left in place, unused, in case we revert.
// import { generateBlendPDF } from '../../data/generateBlendPDF';
import { truckCountFor, TRUCK_BBLS } from '../../data/truckCalc';
import SavePlanButton from '../shared/SavePlanButton';

const C = {
  bg:     '#FFFFFF',
  panel:  '#EEF3F6',
  panel2: '#F5F8FA',
  border: 'rgba(0,79,113,.13)',
  text:   '#063A52',
  muted:  '#5E7A8A',
  amber:  '#00B398',
  blue:   '#004F71',
  red:    '#D9655B',
  green:  '#0a7e62',
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
      padding: '4px 8px', fontSize: '10px', color: '#004F71', fontWeight: 'bold',
      textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'left',
      borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap',
      fontFamily: "'Montserrat',sans-serif",
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

const BUTANE_RVP = 52;

// Per-blend butane calculator local state
function BlendCalculator({ blend, terminalConfig, specCeiling, blendTarget }) {
  const tank = Object.values(terminalConfig.products)
    .flatMap(p => p.tanks).find(t => t.id === blend.tankId);

  const [pumpable,  setPumpable]  = useState('');
  const [rvpTarget, setRvpTarget] = useState('');
  const [rvpActual, setRvpActual] = useState('');

  useEffect(() => {
    if (blend.estPumpable) setPumpable(String(Math.round(blend.estPumpable)));
    if (blend.rvpActual)   setRvpActual(String(blend.rvpActual.toFixed(3)));
    setRvpTarget(String(blendTarget));
  }, [blend.estPumpable, blend.rvpActual, blendTarget, specCeiling]);

  const pump = parseFloat(pumpable) || 0;
  const tgt  = parseFloat(rvpTarget);
  const act  = parseFloat(rvpActual);
  const heel = blend.heel;
  const tov  = pump > 0 ? pump + heel : null;
  const margin = (!isNaN(tgt) && !isNaN(act)) ? (tgt - act) : null;

  const marginLow  = margin !== null ? Math.max(margin - 0.1, 0) : null;
  const marginHigh = margin !== null ? margin + 0.1 : null;

  const denom = BUTANE_RVP - tgt;
  const butaneLow  = (tov && marginLow  !== null && marginLow  > 0 && denom > 0)
    ? (marginLow  * tov) / denom : null;
  const butaneHigh = (tov && marginHigh !== null && marginHigh > 0 && denom > 0)
    ? (marginHigh * tov) / denom : null;

  const trucksLow  = truckCountFor(butaneLow);
  const trucksHigh = truckCountFor(butaneHigh);

  const tankConfig = Object.values(terminalConfig.products)
    .flatMap(p => p.tanks).find(t => t.id === blend.tankId);
  const safeFill = tankConfig?.safeFill ?? 0;
  const space = pump > 0 ? safeFill - pump - heel : null;
  const warnHeadroom = space !== null && butaneHigh !== null && butaneHigh > space;
  const warnNoPumpable = butaneHigh !== null && pumpable === '';

  const warnCeilingActual = !isNaN(act) && act >= specCeiling;
  const warnCeilingTarget = !isNaN(tgt) && tgt > specCeiling;

  const marginColor = margin === null ? C.muted
    : Math.abs(margin) <= 0.1 ? C.amber
    : margin > 0 ? C.green
    : C.red;

  const row = (label, value, mono = true, color = C.text) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
      <span style={{ fontSize: '11px', color: C.muted, fontFamily: "'Montserrat',sans-serif" }}>{label}</span>
      <span className={mono ? 'font-mono' : ''} style={{ fontSize: '11px', color }}>{value}</span>
    </div>
  );

  const inputRow = (label, value, onChange, color = C.text) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
      <span style={{ fontSize: '11px', color: C.muted, fontFamily: "'Montserrat',sans-serif" }}>{label}</span>
      <input
        type="number" step="0.1" value={value}
        onChange={e => onChange(e.target.value)}
        className="font-mono"
        style={{
          width: '72px', textAlign: 'right', fontSize: '11px',
          backgroundColor: '#FFFFFF', color, border: `1px solid ${C.border}`,
          borderRadius: '6px', padding: '2px 4px',
          fontFamily: "'Montserrat',sans-serif",
        }}
      />
    </div>
  );

  const marginValue = margin !== null
    ? `${margin.toFixed(3)}  (${(margin - 0.1).toFixed(3)} – ${(margin + 0.1).toFixed(3)})`
    : '—';

  return (
    <div style={{
      backgroundColor: '#EEF3F6', border: '1px solid rgba(0,79,113,.13)',
      borderRadius: '12px', padding: '16px', width: '280px', flexShrink: 0,
      boxShadow: '0 10px 26px -22px rgba(0,79,113,.5)',
    }}>
      <div style={{ fontSize: '12px', fontWeight: 700, color: C.text, marginBottom: '2px', fontFamily: "'Montserrat',sans-serif" }}>
        Blend {blend.blendNumber} — {blend.tankLabel}
      </div>
      <div style={{ fontSize: '10px', color: C.muted, marginBottom: '10px' }}>
        {fmtDate(blend.startDate)} {blend.startTime} → {blend.endTime} ({blend.periods} period{blend.periods !== 1 ? 's' : ''})
      </div>

      {inputRow('Pumpable (bbl)', pumpable, setPumpable)}
      {row('Heel', heel.toLocaleString())}
      {row('TOV', tov ? tov.toLocaleString() : '—', true, tov ? C.text : C.muted)}
      <div style={{ borderTop: `1px solid ${C.border}`, margin: '8px 0' }} />

      {/* RVP Target row with ceiling breach warning */}
      <div style={{ marginBottom: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: C.muted, fontFamily: "'Montserrat',sans-serif" }}>RVP Target</span>
          <input
            type="number" step="0.1" value={rvpTarget}
            onChange={e => setRvpTarget(e.target.value)}
            className="font-mono"
            style={{
              width: '72px', textAlign: 'right', fontSize: '11px',
              backgroundColor: '#FFFFFF', color: '#004F71', border: `1px solid ${C.border}`,
              borderRadius: '6px', padding: '2px 4px',
              fontFamily: "'Montserrat',sans-serif",
            }}
          />
        </div>
        {warnCeilingTarget && (
          <div style={{ fontSize: '10px', color: '#D9655B', marginTop: '2px', textAlign: 'right' }}>
            ⚠ Target exceeds spec ceiling
          </div>
        )}
      </div>

      {inputRow('RVP Actual', rvpActual, setRvpActual, '#004F71')}
      {row('RVP Margin', marginValue, true, marginColor)}
      <div style={{ borderTop: `1px solid ${C.border}`, margin: '8px 0' }} />

      {warnCeilingActual && (
        <div style={{ fontSize: '10px', color: '#D9655B', marginBottom: '6px' }}>
          ⚠ RVP at or above spec ceiling — do not blend
        </div>
      )}

      {row('Butane needed',
        (butaneLow !== null && butaneHigh !== null)
          ? `${Math.round(butaneLow).toLocaleString()} – ${Math.round(butaneHigh).toLocaleString()} bbl`
          : '—',
        true, '#00B398'
      )}
      {row('Trucks',
        (trucksLow !== null && trucksHigh !== null)
          ? `${trucksLow} – ${trucksHigh}`
          : '—',
        true, C.text
      )}

      {warnHeadroom && (
        <div style={{ fontSize: '10px', color: '#00B398', marginTop: '4px' }}>
          ⚠ Butane volume exceeds available headroom — confirm safe fill before scheduling
        </div>
      )}
      {warnNoPumpable && (
        <div style={{ fontSize: '10px', color: '#00B398', marginTop: '4px' }}>
          ⚠ Enter pumpable volume to calculate trucks
        </div>
      )}

      <div style={{ borderTop: `1px solid ${C.border}`, marginTop: '10px', paddingTop: '8px' }}>
        <div style={{ fontSize: '10px', color: '#9DB0BC', textTransform: 'uppercase', letterSpacing: '1.4px', marginBottom: '4px', fontFamily: "'Montserrat',sans-serif" }}>
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

export default function BlendPlanSummary({ grid, terminalConfig, startDate, specCeiling, blendTarget }) {
  const blends = detectBlends(grid, terminalConfig);
  const [pdfStatus, setPdfStatus] = useState(null); // null | 'saving' | 'done'
  const summaryRef = useRef(null);

  async function handleSavePDFs() {
    if (!blends.length || pdfStatus === 'saving' || !summaryRef.current) return;
    setPdfStatus('saving');
    try {
      const canvas = await html2canvas(summaryRef.current, {
        scale: 2, // sharper output
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      });
      const imgData = canvas.toDataURL('image/png');

      const orientation = canvas.width >= canvas.height ? 'landscape' : 'portrait';
      const doc = new jsPDF({ orientation, unit: 'pt', format: 'letter' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();

      // Scale the captured image to fit the page width (or height, whichever
      // constrains first), preserving aspect ratio.
      const scale = Math.min(pageW / canvas.width, pageH / canvas.height);
      const imgW = canvas.width * scale;
      const imgH = canvas.height * scale;
      const x = (pageW - imgW) / 2;
      const y = (pageH - imgH) / 2;

      doc.addImage(imgData, 'PNG', x, y, imgW, imgH);
      doc.save(`FortWorth_BlendPlan_${startDate ?? new Date().toISOString().slice(0, 10)}.pdf`);
      setPdfStatus('done');
    } catch (err) {
      console.error('Save Blend PDFs failed:', err);
      setPdfStatus(null);
      return;
    }
    setTimeout(() => setPdfStatus(null), 3000);
  }

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
      <div style={{ padding: '16px', color: C.muted, fontSize: '12px', fontFamily: "'Montserrat',sans-serif" }}>
        No blend periods detected. Toggle tanks to BLEND in the grid above.
      </div>
    );
  }

  const thStyle = {
    padding: '4px 8px', fontSize: '10px', fontWeight: 'bold', color: '#004F71',
    textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'left',
    borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap',
    fontFamily: "'Montserrat',sans-serif",
  };
  const tdBase = {
    padding: '5px 8px', fontSize: '12px', color: C.text,
    borderBottom: `0.5px solid ${C.border}`, whiteSpace: 'nowrap',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Captured region for "Save Blend PDFs" — table + calculator cards only.
          Buttons (below) are intentionally rendered outside this ref. */}
      <div ref={summaryRef} style={{ display: 'flex', flexDirection: 'column', gap: '20px', backgroundColor: C.bg }}>

      {/* Section A — summary table */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
          <span style={{ fontSize: '11px', fontWeight: 'bold', color: C.text, letterSpacing: '0.05em', fontFamily: "'Montserrat',sans-serif" }}>
            {title}
          </span>
          <span style={{ fontSize: '11px', color: C.muted }}>{titleDateRange}</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: '12px', width: '100%' }}>
            <thead>
              <tr>
                {['#','Tank','Start','End','Est Pumpable','Est TOV','Butane','Trucks','Blended RVP','Truck Start','Truck Finish'].map(h => (
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
                    {b.butane_bbls ? Math.round(b.butane_bbls).toLocaleString() + ' bbl' : <span style={{ color: C.muted }}>—</span>}
                  </td>
                  <td style={{ ...tdBase, fontFamily: 'monospace' }}>
                    {b.trucks !== null
                      ? <span title={b.butane_bbls > 0 && b.butane_bbls < TRUCK_BBLS ? 'Less than full truck' : undefined}>
                          {b.trucks}{b.butane_bbls > 0 && b.butane_bbls < TRUCK_BBLS ? ' *' : ''}
                        </span>
                      : <span style={{ color: C.muted }}>—</span>}
                  </td>
                  <td style={{ ...tdBase, fontFamily: 'monospace', color: '#004F71' }}>
                    {b.blendedRVP ? b.blendedRVP.toFixed(3) : <span style={{ color: C.muted }}>—</span>}
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
        <div style={{ fontSize: '10px', color: '#004F71', fontWeight: 'bold', letterSpacing: '1.4px', textTransform: 'uppercase', marginBottom: '12px', fontFamily: "'Montserrat',sans-serif" }}>
          Butane Calculator
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          {blends.map(b => (
            <BlendCalculator
              key={b.blendNumber}
              blend={b}
              terminalConfig={terminalConfig}
              specCeiling={specCeiling}
              blendTarget={blendTarget}
            />
          ))}
        </div>
      </div>

      </div>
      {/* end captured region */}

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          onClick={handleSavePDFs}
          disabled={pdfStatus === 'saving'}
          style={{
            padding: '6px 16px', fontSize: '12px', fontWeight: 'bold',
            backgroundColor: C.amber, color: '#000',
            border: 'none', borderRadius: '4px',
            cursor: pdfStatus === 'saving' ? 'not-allowed' : 'pointer',
            opacity: pdfStatus === 'saving' ? 0.5 : 1,
          }}
        >
          {pdfStatus === 'saving' ? 'Saving PDF…' : 'Save Blend PDFs'}
        </button>
        {pdfStatus === 'done' && (
          <span style={{ fontSize: '11px', color: C.green, fontWeight: 'bold' }}>
            ✓ Saved PDF
          </span>
        )}
      </div>

      {/* Section C — save to history */}
      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: '14px' }}>
        <SavePlanButton
          blends={blends}
          terminalConfig={terminalConfig}
          startDate={startDate}
          blendTarget={blendTarget}
        />
      </div>
    </div>
  );
}
