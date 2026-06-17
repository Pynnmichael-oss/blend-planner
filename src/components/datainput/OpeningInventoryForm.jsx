import { useEffect } from 'react';
import VerticalTankGauge from '../blendplanner/InventoryBar';

const C = {
  bg:     '#0a0c12',
  border: '#1e293b',
  text:   '#f1f5f9',
  muted:  '#64748b',
  amber:  '#f59e0b',
  blue:   '#60a5fa',
  red:    '#ef4444',
};

const inputBase = {
  backgroundColor: C.bg, color: C.text,
  border: `1px solid ${C.border}`, borderRadius: '3px',
  padding: '2px 5px', fontFamily: 'monospace', fontSize: '11px',
  textAlign: 'right',
};

export default function OpeningInventoryForm({ openingInventory, terminalConfig, setOpeningInventory, specCeiling, setSpecCeiling, blendTarget, setBlendTarget }) {
  useEffect(() => {
    setBlendTarget(+(specCeiling - 0.25).toFixed(2));
  }, [specCeiling]);

  function handleChange(tankId, field, raw) {
    const value = field === 'pumpable'
      ? Math.round(parseFloat(raw) || 0)
      : (parseFloat(raw) || 0);
    setOpeningInventory(openingInventory.map(t => t.tankId === tankId ? { ...t, [field]: value } : t));
  }

  const specInputBase = {
    ...inputBase,
    width: '56px',
    border: `1px solid ${C.border}`,
  };

  return (
    <>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
      <thead>
        <tr style={{ color: C.muted }}>
          <th style={{ textAlign: 'left',  padding: '2px 4px', fontWeight: 'normal', fontSize: '10px' }}>Tank</th>
          <th style={{ textAlign: 'right', padding: '2px 4px', fontWeight: 'normal', fontSize: '10px' }}>bbl</th>
          <th style={{ textAlign: 'right', padding: '2px 4px', fontWeight: 'normal', fontSize: '10px' }}>RVP</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(terminalConfig.products).map(([pk, product]) => (
          <>
            {/* Product sub-header */}
            <tr key={`${pk}-header`}>
              <td
                colSpan={3}
                style={{
                  paddingTop: '10px', paddingBottom: '3px', paddingLeft: '4px',
                  fontSize: '9px', color: C.amber, fontWeight: '600',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                }}
              >
                {product.label}
              </td>
            </tr>

            {/* Tank rows */}
            {product.tanks.map(tank => {
              const inv     = openingInventory.find(t => t.tankId === tank.id) ?? { pumpable: 0, rvp: 0 };
              const fillPct = tank.safeFill > 0 ? inv.pumpable / tank.safeFill : 0;
              return (
                <tr key={tank.id} style={{ borderTop: `0.5px solid ${C.border}` }}>
                  <td style={{ padding: '4px 4px', color: C.text }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <VerticalTankGauge fillPct={fillPct} status="RACK" height={20} width={6} />
                      <span>{tank.label}</span>
                    </div>
                  </td>
                  <td style={{ padding: '3px 4px', textAlign: 'right' }}>
                    <input
                      type="number"
                      step={100}
                      value={inv.pumpable}
                      placeholder="e.g. 38500"
                      onChange={e => handleChange(tank.id, 'pumpable', e.target.value)}
                      style={{ ...inputBase, width: '72px', color: C.text }}
                    />
                  </td>
                  <td style={{ padding: '3px 4px', textAlign: 'right' }}>
                    <input
                      type="number"
                      step="0.1"
                      value={inv.rvp}
                      onChange={e => handleChange(tank.id, 'rvp', e.target.value)}
                      style={{ ...inputBase, width: '48px', color: C.blue }}
                    />
                  </td>
                </tr>
              );
            })}
          </>
        ))}
      </tbody>
    </table>

    {/* Blend spec controls */}
    <div style={{ borderTop: `1px solid ${C.border}`, marginTop: '10px', paddingTop: '10px' }}>
      <div style={{ fontSize: '9px', color: C.amber, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
        Blend Spec
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: C.muted }}>Ceiling</span>
          <input
            type="number" step="0.05" min="8.0" max="15.0"
            value={specCeiling}
            onChange={e => setSpecCeiling(parseFloat(e.target.value) || 9.0)}
            className="font-mono"
            style={{ ...specInputBase, color: C.red }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: C.muted }}>Target</span>
          <input
            type="number" step="0.05" min="7.0"
            value={blendTarget}
            onChange={e => setBlendTarget(parseFloat(e.target.value) || 8.75)}
            className="font-mono"
            style={{ ...specInputBase, color: C.blue }}
          />
        </div>
      </div>
      <div style={{ fontSize: '10px', color: C.muted, marginTop: '6px' }}>
        Target auto-set 0.25 below ceiling
      </div>
    </div>
    </>
  );
}
