import { useState } from 'react';
import { parseT4 } from '../../data/parseT4';

const GRADE_RVP_DEFAULTS = {
  '4C': 7.0, '4D': 7.0,
  '3C': 7.0, '3D': 7.0,
};
const GRADES = ['4C', '4D', '3C', '3D'];

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

const thSt = {
  padding: '3px 6px', fontSize: '9px', color: C.muted, fontWeight: 'normal',
  borderBottom: `1px solid ${C.border}`, textAlign: 'left', whiteSpace: 'nowrap',
  position: 'sticky', top: 0, zIndex: 2, backgroundColor: '#FFFFFF',
  fontFamily: "'Montserrat',sans-serif",
};

const tdSt = {
  padding: '0 4px', height: '24px',
  whiteSpace: 'nowrap', verticalAlign: 'middle',
  borderBottom: `1px solid ${C.border}`,
  overflow: 'hidden', fontSize: '10px',
  fontFamily: "'Montserrat',sans-serif",
};

export default function T4PasteInput({
  terminalConfig, onReceiptsChange, height = '100%',
  parsedReceipts, setParsedReceipts,
  rvpValues, setRvpValues,
  rvpConfirmed, setRvpConfirmed,
}) {
  const [rawText,       setRawText]       = useState('');
  const [parseError,    setParseError]    = useState(null);
  const [gradeDefaults, setGradeDefaults] = useState({ ...GRADE_RVP_DEFAULTS });

  function doParse(text) {
    try {
      const results = parseT4(text, terminalConfig);
      if (results.length === 0) {
        setParseError('No valid batches found — check format (tab-separated, min 14 cols).');
        setParsedReceipts(null);
        return;
      }
      setParsedReceipts(results);
      setParseError(null);
      const init = {};
      for (const r of results) init[r.batchCode] = gradeDefaults[r.grade] ?? null;
      setRvpValues(init);
      setRvpConfirmed({});
    } catch (e) {
      setParseError(`Parse error: ${e.message}`);
    }
  }

  function handlePaste(e) {
    const text = e.clipboardData.getData('text');
    setRawText(text);
    doParse(text);
    e.preventDefault();
  }

  function handleRvpChange(batchCode, val) {
    const numeric = parseFloat(val);
    setRvpValues(prev => ({ ...prev, [batchCode]: isNaN(numeric) ? null : numeric }));
    setRvpConfirmed(prev => ({ ...prev, [batchCode]: true }));
  }

  function applyGradeDefault(grade) {
    if (!parsedReceipts) return;
    const val = gradeDefaults[grade];
    if (val == null) return;
    const updates = {};
    for (const r of parsedReceipts) {
      if (r.grade === grade && !rvpConfirmed[r.batchCode]) updates[r.batchCode] = val;
    }
    setRvpValues(prev => ({ ...prev, ...updates }));
  }

  function handleApply() {
    if (!parsedReceipts) return;
    onReceiptsChange(parsedReceipts.map(r => ({ ...r, rvp: rvpValues[r.batchCode] })));
  }

  const confirmedCount = parsedReceipts ? parsedReceipts.filter(r => rvpConfirmed[r.batchCode]).length : 0;
  const estimatedCount = parsedReceipts ? parsedReceipts.length - confirmedCount : 0;

  const rvpTabIndex = parsedReceipts
    ? Object.fromEntries(parsedReceipts.map((r, i) => [r.batchCode, i + 1]))
    : {};

  return (
    <div style={{ height, display: 'flex', flexDirection: 'column', backgroundColor: C.bg, overflow: 'hidden' }}>

      {/* TOP BAR — 48px */}
      <div style={{
        height: '48px', flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: '8px', padding: '0 12px',
        backgroundColor: C.panel, borderBottom: `1px solid ${C.border}`,
      }}>
        <input
          type="text"
          value={rawText}
          onChange={e => setRawText(e.target.value)}
          onPaste={handlePaste}
          placeholder="Paste T4 data and press Parse"
          style={{
            flex: 1, height: '30px', boxSizing: 'border-box',
            backgroundColor: '#FFFFFF', color: C.text,
            border: `1px solid ${C.border}`, borderRadius: '9px',
            padding: '0 8px', fontSize: '11px',
            fontFamily: "'Montserrat',sans-serif", outline: 'none',
          }}
        />
        <button
          onClick={() => doParse(rawText)}
          style={{
            flexShrink: 0, height: '30px', padding: '0 16px', fontSize: '12px',
            backgroundColor: '#004F71', color: '#FFFFFF', border: 'none',
            borderRadius: '9px', cursor: 'pointer', fontWeight: 700,
            fontFamily: "'Montserrat',sans-serif",
          }}
        >
          Parse
        </button>
        {parseError && (
          <span style={{ fontSize: '10px', color: C.red, flexShrink: 0 }}>{parseError}</span>
        )}
        {parsedReceipts && !parseError && (
          <span style={{ fontSize: '10px', color: C.muted, flexShrink: 0 }}>
            <span style={{ color: C.text }}>{parsedReceipts.length}</span> batches
          </span>
        )}
      </div>

      {/* MAIN AREA */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* LEFT PANEL — 260px */}
        <div style={{
          width: '260px', flexShrink: 0,
          backgroundColor: C.panel, borderRight: `1px solid ${C.border}`,
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>

            {/* Summary */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '9px', color: C.blue, textTransform: 'uppercase', letterSpacing: '1.4px', fontWeight: 700, marginBottom: '8px' }}>
                RVP Status
              </div>
              {parsedReceipts ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', height: '22px', alignItems: 'center' }}>
                    <span style={{ color: C.muted }}>Confirmed</span>
                    <span style={{ color: C.blue, fontFamily: 'monospace' }}>{confirmedCount}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', height: '22px', alignItems: 'center' }}>
                    <span style={{ color: C.muted }}>Estimated</span>
                    <span style={{ color: estimatedCount > 0 ? C.amber : C.muted, fontFamily: 'monospace' }}>
                      {estimatedCount}
                    </span>
                  </div>
                </>
              ) : (
                <div style={{ fontSize: '11px', color: C.muted }}>No batches loaded</div>
              )}
            </div>

            {/* Grade defaults */}
            <div>
              <div style={{ fontSize: '9px', color: C.blue, textTransform: 'uppercase', letterSpacing: '1.4px', fontWeight: 700, marginBottom: '8px' }}>
                Grade Defaults
              </div>
              {GRADES.map(grade => {
                const val = gradeDefaults[grade] ?? '';
                const affectedCount = parsedReceipts
                  ? parsedReceipts.filter(r => r.grade === grade && !rvpConfirmed[r.batchCode]).length
                  : 0;
                const isReg = ['4C', '4D'].includes(grade);
                const active = parsedReceipts && affectedCount > 0;
                return (
                  <div key={grade} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <span style={{
                      fontSize: '10px', fontFamily: "'Montserrat',sans-serif", fontWeight: 600,
                      color: isReg ? C.amber : C.blue, width: '24px', flexShrink: 0,
                    }}>
                      {grade}
                    </span>
                    <input
                      type="number"
                      step="0.1"
                      value={val}
                      onChange={e => {
                        const n = parseFloat(e.target.value);
                        setGradeDefaults(prev => ({ ...prev, [grade]: isNaN(n) ? null : n }));
                      }}
                      style={{
                        width: '56px', flexShrink: 0, fontSize: '11px', textAlign: 'right',
                        backgroundColor: '#EEF3F6', color: C.text,
                        border: `1px solid ${C.border}`, borderRadius: '6px',
                        padding: '2px 5px', fontFamily: "'Montserrat',sans-serif",
                      }}
                    />
                    <button
                      onClick={() => applyGradeDefault(grade)}
                      disabled={!active}
                      style={{
                        flex: 1, padding: '2px 0', fontSize: '9px',
                        backgroundColor: 'transparent',
                        color: active ? C.muted : 'rgba(0,79,113,.2)',
                        border: `1px solid ${active ? C.borderEm : C.border}`,
                        borderRadius: '3px',
                        cursor: active ? 'pointer' : 'not-allowed',
                        fontFamily: "'Montserrat',sans-serif", whiteSpace: 'nowrap',
                      }}
                    >
                      → all EST
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Apply to Plan — pinned */}
          <div style={{ flexShrink: 0, padding: '10px 12px', borderTop: `1px solid ${C.border}` }}>
            <button
              onClick={handleApply}
              disabled={!parsedReceipts}
              style={{
                width: '100%', padding: '9px 0', fontSize: '13px', fontWeight: 700,
                backgroundColor: parsedReceipts ? '#004F71' : C.border,
                color: parsedReceipts ? '#FFFFFF' : C.muted,
                border: 'none', borderRadius: '9px',
                cursor: parsedReceipts ? 'pointer' : 'not-allowed',
                fontFamily: "'Montserrat',sans-serif",
              }}
            >
              Apply to Plan
            </button>
          </div>
        </div>

        {/* RIGHT PANEL — batch table */}
        <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#FFFFFF' }}>
          {parsedReceipts ? (
            <table style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '60px' }} />
                <col style={{ width: '140px' }} />
                <col style={{ width: '36px' }} />
                <col style={{ width: '36px' }} />
                <col style={{ width: '36px' }} />
                <col style={{ width: '44px' }} />
                <col style={{ width: '64px' }} />
                <col style={{ width: '66px' }} />
              </colgroup>
              <thead>
                <tr>
                  {['DATE', 'BATCH', 'SUP', 'LINE', 'GRADE', 'PROD', 'VOL', 'RVP'].map(h => (
                    <th key={h} style={thSt}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsedReceipts.map(r => {
                  const rvp         = rvpValues[r.batchCode];
                  const rvpSet      = rvp !== null && rvp !== undefined;
                  const isConfirmed = rvpConfirmed[r.batchCode] === true;
                  const accentColor = isConfirmed ? '#004F71' : '#00B398';
                  return (
                    <tr
                      key={r.batchCode}
                      style={{ backgroundColor: '#FFFFFF', borderLeft: `3px solid ${accentColor}` }}
                    >
                      <td style={{ ...tdSt, color: C.muted }}>
                        {r.startDatetime.slice(0, 16).replace('T', ' ')}
                      </td>
                      <td style={{ ...tdSt, color: C.text, textOverflow: 'ellipsis' }}>
                        {r.batchCode}
                      </td>
                      <td style={{ ...tdSt, color: C.muted }}>{r.supplier}</td>
                      <td style={{ ...tdSt, color: C.muted }}>{r.line}</td>
                      <td style={{ ...tdSt }}>{r.grade}</td>
                      <td style={tdSt}>
                        <span style={{
                          fontSize: '9px', padding: '1px 3px', borderRadius: '3px',
                          backgroundColor: r.product === 'regular' ? 'rgba(0,179,152,.12)' : 'rgba(0,79,113,.10)',
                          color: r.product === 'regular' ? '#0a7e62' : '#004F71',
                        }}>
                          {r.product === 'regular' ? 'REG' : 'PRM'}
                        </span>
                      </td>
                      <td style={{ ...tdSt, textAlign: 'right' }}>
                        {r.volume.toLocaleString()}
                      </td>
                      <td style={{ ...tdSt, padding: '0 3px' }}>
                        <input
                          type="number"
                          step="0.1"
                          value={rvpSet ? rvp : ''}
                          placeholder="—"
                          tabIndex={rvpTabIndex[r.batchCode]}
                          onChange={e => handleRvpChange(r.batchCode, e.target.value)}
                          style={{
                            width: '56px', fontSize: '11px', textAlign: 'right',
                            backgroundColor: '#EEF3F6', color: C.text,
                            border: `1px solid ${C.border}`,
                            borderLeft: `4px solid ${accentColor}`,
                            borderRadius: '6px', padding: '1px 3px',
                            fontFamily: "'Montserrat',sans-serif", outline: 'none',
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <div style={{ textAlign: 'center', color: C.muted, fontSize: '11px', lineHeight: 2 }}>
                <div style={{ fontSize: '24px', marginBottom: '6px', opacity: 0.2 }}>⇑</div>
                Paste T4 data above and press <span style={{ color: C.amber }}>Parse</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
