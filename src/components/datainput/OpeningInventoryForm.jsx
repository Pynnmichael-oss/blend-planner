import VerticalTankGauge from '../blendplanner/InventoryBar';

const C = {
  bg:     '#0a0c12',
  border: '#1e293b',
  text:   '#f1f5f9',
  muted:  '#64748b',
  amber:  '#f59e0b',
  blue:   '#60a5fa',
};

// Display in thousands (38500 → "38.5"), store full value
function toK(v) { return (v / 1000).toFixed(1); }
function fromK(s) { return Math.round((parseFloat(s) || 0) * 1000); }

const inputBase = {
  backgroundColor: C.bg, color: C.text,
  border: `1px solid ${C.border}`, borderRadius: '3px',
  padding: '2px 5px', fontFamily: 'monospace', fontSize: '11px',
  textAlign: 'right',
};

export default function OpeningInventoryForm({ openingInventory, terminalConfig, setOpeningInventory }) {
  function handleChange(tankId, field, raw) {
    const value = field === 'pumpable' ? fromK(raw) : (parseFloat(raw) || 0);
    setOpeningInventory(openingInventory.map(t => t.tankId === tankId ? { ...t, [field]: value } : t));
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
      <thead>
        <tr style={{ color: C.muted }}>
          <th style={{ textAlign: 'left',  padding: '2px 4px', fontWeight: 'normal', fontSize: '10px' }}>Tank</th>
          <th style={{ textAlign: 'right', padding: '2px 4px', fontWeight: 'normal', fontSize: '10px' }}>k bbl</th>
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
                      step="0.1"
                      value={toK(inv.pumpable)}
                      onChange={e => handleChange(tank.id, 'pumpable', e.target.value)}
                      style={{ ...inputBase, width: '62px', color: C.text }}
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
  );
}
