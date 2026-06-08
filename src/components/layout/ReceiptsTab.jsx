import { useState } from 'react';
import { parseT4 } from '../../data/parseT4';
import LiftingsInput from '../datainput/LiftingsInput';

// TODO: O-5 — replace with season-aware spec values once confirmed by Kelly
const GRADE_RVP_DEFAULTS = {
  '4C': 7.0, '4D': 7.0, '75': 7.0,
  '3C': 7.0, '3D': 7.0,
};
const GRADES = ['4C', '4D', '75', '3C', '3D'];

const C = {
  bg: '#0a0c12', panel: '#0f1117', panel2: '#111827',
  border: '#1e293b', borderEm: '#2a2d3a',
  text: '#f1f5f9', muted: '#64748b', secondary: '#94a3b8',
  amber: '#f59e0b', blue: '#60a5fa', red: '#ef4444', green: '#22c55e',
};

function fmtDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

const thSt = {
  padding: '4px 8px', fontSize: '9px', color: C.muted, fontWeight: 'normal',
  borderBottom: `1px solid ${C.borderEm}`, textAlign: 'left', whiteSpace: 'nowrap',
  position: 'sticky', top: 0, zIndex: 2, backgroundColor: C.panel,
};

export default function ReceiptsTab({
  terminalConfig, onReceiptsChange,
  liftings, onLiftingsChange, planDays, startDate,
}) {
  const [rawText,       setRawText]       = useState('');
  const [parsed,        setParsed]        = useState(null);
  const [rvpValues,     setRvpValues]     = useState({});
  const [rvpConfirmed,  setRvpConfirmed]  = useState({});
  const [parseError,    setParseError]    = useState(null);
  const [gradeDefaults, setGradeDefaults] = useState({ ...GRADE_RVP_DEFAULTS });

  function handleParse() {
    try {
      const results = parseT4(rawText, terminalConfig);
      if (results.length === 0) {
        setParseError('No valid batches found — check format (tab-separated, min 14 cols).');
        setParsed(null);
        return;
      }
      setParsed(results);
      setParseError(null);
      const init = {};
      for (const r of results) init[r.batchCode] = gradeDefaults[r.grade] ?? null;
      setRvpValues(init);
      setRvpConfirmed({});
    } catch (e) {
      setParseError(`Parse error: ${e.message}`);
    }
  }

  function handleRvpChange(batchCode, val) {
    const numeric = parseFloat(val);
    setRvpValues(prev => ({ ...prev, [batchCode]: isNaN(numeric) ? null : numeric }));
    setRvpConfirmed(prev => ({ ...prev, [batchCode]: true }));
  }

  function applyGradeDefault(grade) {
    if (!parsed) return;
    const val = gradeDefaults[grade];
    if (val == null) return;
    const updates = {};
    for (const r of parsed) {
      if (r.grade === grade && !rvpConfirmed[r.batchCode]) {
        updates[r.batchCode] = val;
      }
    }
    setRvpValues(prev => ({ ...prev, ...updates }));
  }

  function handleApply() {
    if (!parsed) return;
    onReceiptsChange(parsed.map(r => ({ ...r, rvp: rvpValues[r.batchCode] })));
  }

  // Group by date preserving parse order
  const byDate = {};
  if (parsed) {
    for (const r of parsed) {
      const date = r.startDatetime.slice(0, 10);
      if (!byDate[date]) byDate[date] = [];
      byDate[date].push(r);
    }
  }

  // Precompute sequential tabIndex for RVP inputs
  const rvpTabIndex = parsed
    ? Object.fromEntries(parsed.map((r, i) => [r.batchCode, i + 1]))
    : {};

  const confirmedCount = parsed ? parsed.filter(r => rvpConfirmed[r.batchCode]).length : 0;
  const estimatedCount = parsed ? parsed.length - confirmedCount : 0;
  const allConfirmed   = parsed ? estimatedCount === 0 : false;

  const tdSt = {
    padding: '0 8px', fontSize: '11px', borderBottom: `1px solid ${C.border}`,
    height: '28px', whiteSpace: 'nowrap', verticalAlign: 'middle',
  };

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', backgroundColor: C.bg }}>

      {/* ── LEFT COLUMN: paste + liftings ── */}
      <div style={{
        width: '280px', flexShrink: 0,
        backgroundColor: C.panel, borderRight: `1px solid ${C.border}`,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Paste area — fixed height */}
        <div style={{ flexShrink: 0, padding: '10px 12px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: '9px', color: C.amber, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: '6px' }}>
            T4 Pipeline Schedule
          </div>
          <textarea
            value={rawText}
            onChange={e => setRawText(e.target.value)}
            placeholder="Paste T4 schedule data here..."
            rows={8}
            style={{
              width: '100%', boxSizing: 'border-box',
              backgroundColor: C.bg, color: C.text,
              border: `1px solid ${C.borderEm}`, borderRadius: '3px',
              padding: '5px 7px', fontSize: '10px',
              fontFamily: 'monospace', resize: 'none',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
            <button
              onClick={handleParse}
              style={{
                padding: '4px 14px', fontSize: '11px',
                backgroundColor: C.amber, color: '#000', border: 'none',
                borderRadius: '3px', cursor: 'pointer', fontWeight: 'bold',
              }}
            >
              Parse
            </button>
            {parsed && (
              <span style={{ fontSize: '10px', color: C.muted }}>
                <span style={{ color: C.text }}>{parsed.length}</span> batches
              </span>
            )}
          </div>
          {parseError && (
            <div style={{ color: C.red, fontSize: '10px', marginTop: '5px', lineHeight: 1.4 }}>
              {parseError}
            </div>
          )}
        </div>

        {/* Liftings — fills remaining height, internally scrollable */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ padding: '6px 4px 0' }}>
            <LiftingsInput
              terminalConfig={terminalConfig}
              liftings={liftings}
              onLiftingsChange={onLiftingsChange}
              planDays={planDays}
              startDate={startDate ?? new Date().toISOString().slice(0, 10)}
            />
          </div>
        </div>
      </div>

      {/* ── MIDDLE COLUMN: batch table ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: `1px solid ${C.border}` }}>
        {parsed ? (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  {['START', 'BATCH', 'SUP', 'LINE', 'GRADE', 'PROD', 'VOL', 'RVP'].map(h => (
                    <th key={h} style={thSt}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(byDate).map(([date, rows]) => (
                  <>
                    <tr key={`hdr-${date}`}>
                      <td
                        colSpan={8}
                        style={{
                          position: 'sticky', top: '25px', zIndex: 1,
                          padding: '3px 8px',
                          backgroundColor: '#14172a',
                          color: C.amber, fontSize: '9px', fontWeight: 600,
                          letterSpacing: '0.06em', textTransform: 'uppercase',
                          borderTop: `1px solid ${C.border}`,
                          borderBottom: `1px solid ${C.border}`,
                        }}
                      >
                        {fmtDate(date)}
                      </td>
                    </tr>

                    {rows.map(r => {
                      const rvp         = rvpValues[r.batchCode];
                      const rvpSet      = rvp !== null && rvp !== undefined;
                      const isConfirmed = rvpConfirmed[r.batchCode] === true;
                      const accentColor = isConfirmed ? C.blue : C.amber;

                      return (
                        <tr key={r.batchCode} style={{ backgroundColor: C.bg }}>
                          <td style={{ ...tdSt, fontFamily: 'monospace', color: C.muted }}>
                            {r.startDatetime.slice(11)}
                          </td>
                          <td style={{ ...tdSt, fontFamily: 'monospace', color: C.text }}>
                            {r.batchCode}
                          </td>
                          <td style={{ ...tdSt, color: C.muted }}>{r.supplier}</td>
                          <td style={{ ...tdSt, color: C.muted }}>{r.line}</td>
                          <td style={{ ...tdSt, fontFamily: 'monospace' }}>{r.grade}</td>
                          <td style={tdSt}>
                            <span style={{
                              fontSize: '9px', padding: '1px 5px', borderRadius: '3px',
                              backgroundColor: r.product === 'regular' ? '#1a2e22' : '#1a2035',
                              color: r.product === 'regular' ? C.green : C.blue,
                            }}>
                              {r.product === 'regular' ? 'REG' : 'PREM'}
                            </span>
                          </td>
                          <td style={{ ...tdSt, fontFamily: 'monospace', textAlign: 'right' }}>
                            {r.volume.toLocaleString()}
                          </td>
                          <td style={{ ...tdSt, padding: '0 6px' }}>
                            <input
                              type="number"
                              step="0.1"
                              value={rvpSet ? rvp : ''}
                              placeholder="—"
                              tabIndex={rvpTabIndex[r.batchCode]}
                              onChange={e => handleRvpChange(r.batchCode, e.target.value)}
                              style={{
                                width: '64px', fontSize: '12px', textAlign: 'right',
                                backgroundColor: C.bg, color: C.text,
                                border: `1px solid ${C.border}`,
                                borderLeft: `4px solid ${accentColor}`,
                                borderRadius: '3px', padding: '2px 5px',
                                fontFamily: 'monospace', outline: 'none',
                              }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', color: C.muted, fontSize: '11px', lineHeight: 2 }}>
              <div style={{ fontSize: '24px', marginBottom: '6px', opacity: 0.2 }}>⇐</div>
              Paste T4 data and click <span style={{ color: C.amber }}>Parse</span>
            </div>
          </div>
        )}
      </div>

      {/* ── RIGHT COLUMN: summary + grade defaults + apply ── */}
      <div style={{
        width: '220px', flexShrink: 0,
        backgroundColor: C.panel,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Scrollable top section */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>

          {/* Confirmed/estimated summary */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '9px', color: C.amber, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: '8px' }}>
              RVP Status
            </div>
            {parsed ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                  <span style={{ color: C.muted }}>Confirmed</span>
                  <span style={{ color: C.blue, fontFamily: 'monospace' }}>{confirmedCount}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span style={{ color: C.muted }}>Estimated</span>
                  <span style={{ color: estimatedCount > 0 ? C.amber : C.muted, fontFamily: 'monospace' }}>
                    {estimatedCount}
                  </span>
                </div>
                {!allConfirmed && (
                  <div style={{ fontSize: '10px', color: C.muted, marginTop: '6px', lineHeight: 1.4 }}>
                    Apply lab values before confirming
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: '11px', color: C.muted }}>No batches loaded</div>
            )}
          </div>

          {/* Grade defaults editor */}
          <div>
            <div style={{ fontSize: '9px', color: C.amber, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: '8px' }}>
              Grade Defaults
            </div>
            {GRADES.map(grade => {
              const val          = gradeDefaults[grade] ?? '';
              const affectedCount = parsed
                ? parsed.filter(r => r.grade === grade && !rvpConfirmed[r.batchCode]).length
                : 0;
              const isReg = ['4C','4D','75'].includes(grade);

              return (
                <div key={grade} style={{ marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                    <span style={{
                      fontSize: '10px', fontFamily: 'monospace', fontWeight: 600,
                      color: isReg ? C.green : C.blue,
                      width: '24px',
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
                        flex: 1, fontSize: '11px', textAlign: 'right',
                        backgroundColor: C.bg, color: C.text,
                        border: `1px solid ${C.borderEm}`, borderRadius: '3px',
                        padding: '2px 5px', fontFamily: 'monospace',
                      }}
                    />
                  </div>
                  <button
                    onClick={() => applyGradeDefault(grade)}
                    disabled={!parsed || affectedCount === 0}
                    style={{
                      width: '100%', padding: '2px 0', fontSize: '9px',
                      backgroundColor: 'transparent',
                      color: parsed && affectedCount > 0 ? C.muted : C.border,
                      border: `1px solid ${parsed && affectedCount > 0 ? C.borderEm : C.border}`,
                      borderRadius: '3px', cursor: parsed && affectedCount > 0 ? 'pointer' : 'not-allowed',
                      fontFamily: 'monospace',
                    }}
                  >
                    {affectedCount > 0 ? `apply to ${affectedCount} unconfirmed` : 'none unconfirmed'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Apply to Plan — pinned at bottom */}
        <div style={{ flexShrink: 0, padding: '10px 12px', borderTop: `1px solid ${C.border}` }}>
          <button
            onClick={handleApply}
            disabled={!parsed}
            style={{
              width: '100%', padding: '9px 0', fontSize: '13px', fontWeight: 'bold',
              backgroundColor: parsed ? C.green : C.border,
              color: parsed ? '#000' : C.muted,
              border: 'none', borderRadius: '4px',
              cursor: parsed ? 'pointer' : 'not-allowed',
              letterSpacing: '0.02em',
            }}
          >
            Apply to Plan
          </button>
        </div>
      </div>
    </div>
  );
}
