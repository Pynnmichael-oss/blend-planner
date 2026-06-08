import { useState } from 'react';
import { parseT4 } from '../../data/parseT4';

const C = {
  bg: '#0f1117', panel: '#1a1d27', border: '#2a2d3a', text: '#e2e8f0',
  muted: '#64748b', amber: '#f59e0b', blue: '#60a5fa', red: '#ef4444', green: '#22c55e',
};

const thStyle = {
  padding: '3px 6px', fontSize: '10px', color: C.muted, fontWeight: 'normal',
  borderBottom: `1px solid ${C.border}`, textAlign: 'left', whiteSpace: 'nowrap',
};
const tdStyle = {
  padding: '3px 6px', fontSize: '11px', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap',
};

export default function T4PasteInput({ terminalConfig, onReceiptsChange }) {
  const [rawText,    setRawText]    = useState('');
  const [parsed,     setParsed]     = useState(null);
  const [rvpValues,  setRvpValues]  = useState({});
  const [parseError, setParseError] = useState(null);

  function handleParse() {
    try {
      const results = parseT4(rawText, terminalConfig);
      if (results.length === 0) {
        setParseError('No valid batches found — check column format (tab-separated, min 14 columns).');
        setParsed(null);
        return;
      }
      setParsed(results);
      setParseError(null);
      const init = {};
      for (const r of results) init[r.batchCode] = null;
      setRvpValues(init);
    } catch (e) {
      setParseError(`Parse error: ${e.message}`);
    }
  }

  function handleRvpChange(batchCode, val) {
    const parsed = parseFloat(val);
    setRvpValues(prev => ({ ...prev, [batchCode]: isNaN(parsed) ? null : parsed }));
  }

  const allRvpSet = parsed?.length > 0 &&
    parsed.every(r => rvpValues[r.batchCode] !== null && rvpValues[r.batchCode] !== undefined);

  function handleConfirm() {
    if (!parsed || !allRvpSet) return;
    onReceiptsChange(parsed.map(r => ({ ...r, rvp: rvpValues[r.batchCode] })));
  }

  const regularCount = parsed?.filter(r => r.product === 'regular').length ?? 0;
  const premiumCount = parsed?.filter(r => r.product === 'premium').length  ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <textarea
        value={rawText}
        onChange={e => setRawText(e.target.value)}
        placeholder="Paste T4 schedule data here..."
        rows={8}
        style={{
          width: '100%', boxSizing: 'border-box',
          backgroundColor: C.bg, color: C.text,
          border: `1px solid ${C.border}`, borderRadius: '4px',
          padding: '6px 8px', fontSize: '11px',
          fontFamily: 'monospace', resize: 'vertical',
        }}
      />

      <button
        onClick={handleParse}
        style={{
          alignSelf: 'flex-start', padding: '4px 14px', fontSize: '12px',
          backgroundColor: C.amber, color: '#000', border: 'none',
          borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold',
        }}
      >
        Parse
      </button>

      {parseError && (
        <div style={{ color: C.red, fontSize: '11px' }}>{parseError}</div>
      )}

      {parsed && (
        <>
          <div style={{ fontSize: '11px', color: C.muted }}>
            <span style={{ color: C.text }}>{parsed.length} batches parsed</span>
            {' — '}
            <span style={{ color: C.green }}>{regularCount} regular</span>
            {', '}
            <span style={{ color: C.blue }}>{premiumCount} premium</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr>
                  {['START','BATCH CODE','SUPPLIER','LINE','GRADE','PRODUCT','VOLUME','RATE','RVP'].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsed.map(r => {
                  const rvp = rvpValues[r.batchCode];
                  const rvpSet = rvp !== null && rvp !== undefined;
                  return (
                    <tr key={r.batchCode}>
                      <td className="font-mono" style={tdStyle}>{r.startDatetime.replace('T', ' ')}</td>
                      <td className="font-mono" style={tdStyle}>{r.batchCode}</td>
                      <td style={{ ...tdStyle, color: C.muted }}>{r.supplier}</td>
                      <td style={{ ...tdStyle, color: C.muted }}>{r.line}</td>
                      <td style={tdStyle}>{r.grade}</td>
                      <td style={tdStyle}>
                        <span style={{
                          fontSize: '10px', padding: '1px 5px', borderRadius: '3px',
                          backgroundColor: r.product === 'regular' ? '#1a2e22' : '#1a2035',
                          color: r.product === 'regular' ? C.green : C.blue,
                        }}>
                          {r.product === 'regular' ? 'Regular' : 'Premium'}
                        </span>
                      </td>
                      <td className="font-mono" style={{ ...tdStyle, textAlign: 'right' }}>
                        {r.volume.toLocaleString()}
                      </td>
                      <td className="font-mono" style={{ ...tdStyle, textAlign: 'right' }}>
                        {r.rate.toLocaleString()}
                      </td>
                      <td style={tdStyle}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                          {!rvpSet && <span style={{ color: C.amber }}>⚠</span>}
                          <input
                            type="number"
                            step="0.1"
                            value={rvpSet ? rvp : ''}
                            placeholder="RVP"
                            onChange={e => handleRvpChange(r.batchCode, e.target.value)}
                            className="font-mono"
                            style={{
                              width: '52px', fontSize: '11px', textAlign: 'right',
                              backgroundColor: C.bg,
                              color: rvpSet ? C.blue : C.amber,
                              border: `1px solid ${rvpSet ? C.border : C.amber}`,
                              borderRadius: '3px', padding: '1px 4px',
                            }}
                          />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!allRvpSet && (
            <div style={{ color: C.amber, fontSize: '11px' }}>
              Enter RVP for all batches before applying
            </div>
          )}

          <button
            onClick={handleConfirm}
            disabled={!allRvpSet}
            style={{
              alignSelf: 'flex-start', padding: '4px 14px', fontSize: '12px',
              backgroundColor: allRvpSet ? C.green : C.border,
              color: allRvpSet ? '#000' : C.muted, border: 'none',
              borderRadius: '4px', cursor: allRvpSet ? 'pointer' : 'not-allowed', fontWeight: 'bold',
            }}
          >
            Confirm &amp; Apply
          </button>
        </>
      )}
    </div>
  );
}
