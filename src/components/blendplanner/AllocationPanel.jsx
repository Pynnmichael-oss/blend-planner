import { useState } from 'react';

const C = {
  bg: '#0a0c12', panel: '#111827', border: '#1e293b', text: '#f1f5f9',
  muted: '#64748b', amber: '#f59e0b', blue: '#60a5fa', red: '#ef4444', green: '#22c55e',
};

const sectionLabel = {
  fontSize: '10px', color: C.amber, fontWeight: 'bold',
  letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '8px',
};

function NumInput({ value, onChange, color = C.text, disabled = false }) {
  return (
    <input
      type="number"
      value={value ?? ''}
      disabled={disabled}
      onChange={e => onChange(e.target.value)}
      className="font-mono"
      style={{
        width: '72px', textAlign: 'right', fontSize: '11px',
        backgroundColor: disabled ? '#1e293b' : C.bg, color: disabled ? C.muted : color,
        border: `1px solid ${C.border}`, borderRadius: '3px', padding: '2px 4px',
        cursor: disabled ? 'not-allowed' : 'text',
      }}
    />
  );
}

// Single-tank radio row for rack assignment
function TankRadioRow({ tank, selected, disabled, onSelect, currentRVP, currentVol, badge }) {
  return (
    <div
      onClick={() => !disabled && onSelect(tank.id)}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '6px 8px', borderRadius: '4px', cursor: disabled ? 'not-allowed' : 'pointer',
        backgroundColor: selected ? '#0f2820' : 'transparent',
        border: selected ? `1px solid ${C.green}` : `1px solid transparent`,
        opacity: disabled ? 0.4 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
        marginBottom: '4px',
      }}
    >
      <div style={{
        width: '12px', height: '12px', borderRadius: '50%',
        border: `2px solid ${selected ? C.green : C.muted}`,
        backgroundColor: selected ? C.green : 'transparent',
        flexShrink: 0,
      }} />
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: '12px', color: C.text }}>{tank.label}</span>
        {currentRVP != null && (
          <span className="font-mono" style={{ fontSize: '10px', color: C.blue, marginLeft: '8px' }}>
            RVP {currentRVP.toFixed(3)}
          </span>
        )}
        {currentVol != null && (
          <span className="font-mono" style={{ fontSize: '10px', color: C.muted, marginLeft: '8px' }}>
            {Math.round(currentVol).toLocaleString()} bbl
          </span>
        )}
      </div>
      {badge && (
        <span style={{
          fontSize: '8px', padding: '1px 4px', borderRadius: '2px',
          backgroundColor: '#ef4444', color: '#fff', fontFamily: 'monospace',
        }}>
          {badge}
        </span>
      )}
    </div>
  );
}

export default function AllocationPanel({
  period, terminalConfig,
  receiptsForPeriod, liftingForPeriod,
  receiptAllocations, rackTankAssignments,
  setReceiptAllocation, setRackTank,
  allTankPeriods = [],   // grid entries for all tanks of this product/period
  onClose,
}) {
  const product = terminalConfig?.products[period?.productKey];
  const tanks   = product?.tanks ?? [];

  // Which tanks are blending this period (from grid entries)?
  const blendingTankIds = new Set(
    allTankPeriods.filter(e => e.blendActive).map(e => e.tankId)
  );

  const periodKey = `${period?.productKey}-${period?.date}-${period?.timeSlot}`;
  const existingAssignment = rackTankAssignments[periodKey] ?? null;

  // ── Local receipt allocations ─────────────────────────────────────
  const [receiptLocal, setReceiptLocal] = useState(() => {
    const init = {};
    for (const { receipt } of (receiptsForPeriod ?? [])) {
      init[receipt.batchCode] = {};
      for (const tank of tanks) {
        const key = `${receipt.batchCode}-${period.date}-${period.timeSlot}-${tank.id}`;
        init[receipt.batchCode][tank.id] = receiptAllocations[key] ?? '';
      }
    }
    return init;
  });

  // ── Local rack assignment ─────────────────────────────────────────
  const [primaryTank,   setPrimaryTank]   = useState(existingAssignment?.primary  ?? null);
  const [handoffTank,   setHandoffTank]   = useState(existingAssignment?.handoff  ?? null);
  const [handoffVol,    setHandoffVol]    = useState(existingAssignment?.handoffVolume ?? '');
  const [showHandoff,   setShowHandoff]   = useState(!!(existingAssignment?.handoff));

  if (!period || !product) return null;

  const isConflict = period.status === 'CONFLICT';

  function handleApply() {
    // Receipt allocations
    for (const { receipt } of (receiptsForPeriod ?? [])) {
      for (const tank of tanks) {
        const vol = parseFloat(receiptLocal[receipt.batchCode]?.[tank.id]) || 0;
        setReceiptAllocation(receipt.batchCode, period.date, period.timeSlot, tank.id, vol);
      }
    }
    // Rack tank assignment
    if (primaryTank) {
      const hv = showHandoff && handoffTank ? (parseFloat(handoffVol) || 0) : 0;
      setRackTank(
        period.productKey, period.date, period.timeSlot,
        primaryTank,
        showHandoff && handoffTank ? handoffTank : null,
        hv
      );
    }
    onClose();
  }

  function setReceiptTankVol(batchCode, tankId, val) {
    setReceiptLocal(prev => ({
      ...prev,
      [batchCode]: { ...prev[batchCode], [tankId]: val },
    }));
  }

  // Tank entries for display (RVP, inventory)
  const tankEntries = Object.fromEntries(allTankPeriods.map(e => [e.tankId, e]));

  const totalDemand = Math.abs(liftingForPeriod);
  const hv          = showHandoff && handoffTank ? (parseFloat(handoffVol) || 0) : 0;
  const primaryVol  = Math.max(0, totalDemand - Math.abs(hv));

  return (
    <div
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: '8px',
        padding: '16px', width: '540px', maxHeight: '85vh', overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: '14px',
      }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'monospace', fontSize: '13px', color: C.text }}>
            {period.tankId} &nbsp;·&nbsp; {period.date} &nbsp;·&nbsp; {period.timeSlot}
            &nbsp;&nbsp;
            <span style={{ color: C.muted, fontSize: '11px' }}>{product.label}</span>
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, fontSize: '16px', cursor: 'pointer', padding: '0 4px' }}>×</button>
        </div>

        {/* Conflict warning */}
        {isConflict && (
          <div style={{
            backgroundColor: '#1a1200', border: `1px solid ${C.amber}`,
            borderRadius: '4px', padding: '10px 12px',
          }}>
            <div style={{ fontSize: '12px', color: C.amber, fontWeight: 'bold', marginBottom: '3px' }}>
              ⚠ Pipeline receipt conflict — this tank is blending.
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>
              Assign this batch to another tank below.
            </div>
          </div>
        )}

        {/* Section A: Receipts */}
        {receiptsForPeriod?.length > 0 && (
          <div>
            <div style={sectionLabel}>Receipts</div>
            {receiptsForPeriod.map(({ receipt, sliceVolume }) => {
              const allocated = tanks.reduce(
                (s, t) => s + (parseFloat(receiptLocal[receipt.batchCode]?.[t.id]) || 0), 0
              );
              const unallocated = sliceVolume - allocated;
              return (
                <div key={receipt.batchCode} style={{ backgroundColor: C.bg, borderRadius: '4px', padding: '8px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span className="font-mono" style={{ fontSize: '11px', color: C.text }}>{receipt.batchCode}</span>
                    <span className="font-mono" style={{ fontSize: '11px', color: C.muted }}>
                      {sliceVolume.toFixed(0)} bbl &nbsp;|&nbsp;
                      <span style={{ color: C.blue }}>RVP {receipt.rvp != null ? receipt.rvp.toFixed(3) : '—'}</span>
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {tanks.map(tank => {
                      const isThisBlending = blendingTankIds.has(tank.id);
                      return (
                        <div
                          key={tank.id}
                          style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
                            opacity: isThisBlending ? 0.4 : 1,
                            border: (!isThisBlending && isConflict) ? `1px solid ${C.green}` : 'none',
                            borderRadius: '3px', padding: isConflict ? '2px 4px' : '0',
                          }}
                        >
                          <span style={{ fontSize: '11px', color: C.muted, marginBottom: '2px' }}>{tank.label}</span>
                          <NumInput
                            value={receiptLocal[receipt.batchCode]?.[tank.id] ?? ''}
                            onChange={val => setReceiptTankVol(receipt.batchCode, tank.id, val)}
                            disabled={isThisBlending}
                          />
                        </div>
                      );
                    })}
                  </div>
                  {unallocated > 0.5 && (
                    <div style={{ fontSize: '11px', color: C.amber, marginTop: '4px' }}>
                      ⚠ Unallocated: {unallocated.toFixed(0)} bbl
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Section B: Rack Assignment */}
        <div>
          <div style={sectionLabel}>Rack Assignment</div>
          <div style={{ fontSize: '11px', color: C.muted, marginBottom: '8px' }}>
            Lifting this period:&nbsp;
            <span className="font-mono" style={{ color: C.text }}>{totalDemand.toLocaleString()} bbl</span>
          </div>

          {/* Primary tank selector */}
          <div style={{ fontSize: '10px', color: C.muted, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Primary rack tank
          </div>
          {tanks.map(tank => {
            const e = tankEntries[tank.id];
            return (
              <TankRadioRow
                key={tank.id}
                tank={tank}
                selected={primaryTank === tank.id}
                disabled={blendingTankIds.has(tank.id)}
                onSelect={id => { setPrimaryTank(id); if (handoffTank === id) setHandoffTank(null); }}
                currentRVP={e?.closingRVP}
                currentVol={e?.closingInventory}
                badge={blendingTankIds.has(tank.id) ? 'BLEND' : null}
              />
            );
          })}

          {primaryTank && (
            <div style={{ fontSize: '11px', color: C.muted, marginTop: '4px', marginBottom: '8px' }}>
              Primary receives:&nbsp;
              <span className="font-mono" style={{ color: C.text }}>{primaryVol.toLocaleString()} bbl</span>
            </div>
          )}

          {/* Handoff expansion */}
          {!showHandoff ? (
            <button
              onClick={() => setShowHandoff(true)}
              style={{
                fontSize: '11px', color: C.blue, background: 'none', border: 'none',
                cursor: 'pointer', padding: '0', textDecoration: 'underline',
              }}
            >
              + Add handoff tank (optional)
            </button>
          ) : (
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: '10px', marginTop: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '10px', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Handoff tank (mid-period)
                </span>
                <button
                  onClick={() => { setShowHandoff(false); setHandoffTank(null); setHandoffVol(''); }}
                  style={{ fontSize: '11px', color: C.muted, background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  ✕ Remove
                </button>
              </div>
              {tanks.map(tank => {
                const e = tankEntries[tank.id];
                const disabledHere = blendingTankIds.has(tank.id) || tank.id === primaryTank;
                return (
                  <TankRadioRow
                    key={tank.id}
                    tank={tank}
                    selected={handoffTank === tank.id}
                    disabled={disabledHere}
                    onSelect={id => setHandoffTank(id)}
                    currentRVP={e?.closingRVP}
                    currentVol={e?.closingInventory}
                    badge={blendingTankIds.has(tank.id) ? 'BLEND' : tank.id === primaryTank ? 'PRIMARY' : null}
                  />
                );
              })}
              {handoffTank && (
                <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11px', color: C.muted }}>Handoff volume (bbl):</span>
                  <NumInput
                    value={handoffVol}
                    onChange={setHandoffVol}
                    color={C.amber}
                  />
                  <span style={{ fontSize: '11px', color: C.muted }}>
                    (max {totalDemand.toLocaleString()})
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: `1px solid ${C.border}`, paddingTop: '10px' }}>
          <button onClick={onClose} style={{ padding: '4px 14px', fontSize: '12px', backgroundColor: C.bg, color: C.muted, border: `1px solid ${C.border}`, borderRadius: '4px', cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={handleApply} style={{ padding: '4px 14px', fontSize: '12px', backgroundColor: C.amber, color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
