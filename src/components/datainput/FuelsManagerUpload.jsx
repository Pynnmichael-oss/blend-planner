import { useState } from 'react';
import { parseFuelsManagerWorkbook, getLatestValidByTank } from '../../data/parseFuelsManager';

const C = {
  border:  'rgba(0,79,113,.13)',
  text:    '#063A52',
  muted:   '#5E7A8A',
  blue:    '#004F71',
  amber:   '#00B398',
  red:     '#D9655B',
  panel2:  '#F5F8FA',
};

const btnBase = {
  fontFamily: "'Montserrat',sans-serif",
  fontSize: '10px',
  fontWeight: 700,
  padding: '4px 10px',
  borderRadius: '5px',
  cursor: 'pointer',
  border: 'none',
};

export default function FuelsManagerUpload({ onConfirm }) {
  const [preview, setPreview] = useState(null); // { TK55: { available, pulledAt, workingCap, skippedBadRows }, ... }
  const [error, setError] = useState(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    setError(null);
    try {
      const buffer = await file.arrayBuffer();
      const rows = parseFuelsManagerWorkbook(buffer);
      if (rows.length === 0) {
        setError('No recognized tanks found in this file.');
        setPreview(null);
        return;
      }
      setPreview(getLatestValidByTank(rows));
    } catch {
      setError('Could not read file — is it a valid FuelsManager export?');
      setPreview(null);
    }
  }

  function handleApply() {
    if (!preview) return;
    const mapped = Object.fromEntries(
      Object.entries(preview).map(([tankId, v]) => [tankId, v.available])
    );
    onConfirm(mapped);
    setPreview(null);
  }

  function handleDiscard() {
    setPreview(null);
    setError(null);
  }

  return (
    <div style={{ marginBottom: '10px' }}>
      {!preview && (
        <label style={{
          display: 'block', fontSize: '11px', color: C.muted,
          border: `1px dashed ${C.border}`, borderRadius: '6px',
          padding: '8px', textAlign: 'center', cursor: 'pointer',
        }}>
          Choose FuelsManager .xlsx file…
          <input type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ display: 'none' }} />
        </label>
      )}

      {error && (
        <div style={{ fontSize: '10px', color: C.red, marginTop: '6px' }}>{error}</div>
      )}

      {preview && (
        <div style={{ marginTop: '6px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
            <thead>
              <tr style={{ color: C.muted }}>
                <th style={{ textAlign: 'left', padding: '2px 4px', fontWeight: 'normal' }}>Tank</th>
                <th style={{ textAlign: 'right', padding: '2px 4px', fontWeight: 'normal' }}>Avail (bbl)</th>
                <th style={{ textAlign: 'right', padding: '2px 4px', fontWeight: 'normal' }}>Pulled At</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(preview).map(([tankId, v]) => (
                <tr key={tankId} style={{ borderTop: `0.5px solid ${C.border}`, backgroundColor: C.panel2 }}>
                  <td style={{ padding: '3px 4px', color: C.text, fontWeight: 600 }}>
                    {tankId}
                    {v.skippedBadRows > 0 && (
                      <span style={{
                        marginLeft: '5px', fontSize: '8px', color: C.red,
                        border: `1px solid ${C.red}`, borderRadius: '3px', padding: '1px 3px',
                      }}>
                        {v.skippedBadRows} bad row{v.skippedBadRows > 1 ? 's' : ''} skipped
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '3px 4px', textAlign: 'right', color: C.blue, fontWeight: 700 }} className="font-mono">
                    {Math.round(v.available).toLocaleString()}
                  </td>
                  <td style={{ padding: '3px 4px', textAlign: 'right', color: C.muted }}>
                    {v.pulledAt ? new Date(v.pulledAt).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
            <button
              onClick={handleApply}
              style={{ ...btnBase, backgroundColor: C.amber, color: '#FFFFFF' }}
            >
              Apply to Opening Inventory
            </button>
            <button
              onClick={handleDiscard}
              style={{ ...btnBase, backgroundColor: 'transparent', color: C.muted, border: `1px solid ${C.border}` }}
            >
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
