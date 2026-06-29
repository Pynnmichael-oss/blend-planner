import { useState } from 'react';

const C = {
  bg:      '#FFFFFF',
  panel:   '#EEF3F6',
  panel2:  '#FFFFFF',
  border:  'rgba(0,79,113,.13)',
  borderEm:'rgba(0,79,113,.25)',
  text:    '#063A52',
  muted:   '#5E7A8A',
  faint:   '#9DB0BC',
  amber:   '#00B398',
  blue:    '#004F71',
  red:     '#D9655B',
  green:   '#0a7e62',
};

const sectionLabel = {
  fontSize: '10px', color: C.blue, fontWeight: 700,
  letterSpacing: '1.4px', textTransform: 'uppercase', marginBottom: '8px',
  fontFamily: "'Montserrat',sans-serif",
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
        backgroundColor: disabled ? C.panel : C.bg,
        color: disabled ? C.faint : color,
        border: `1px solid ${C.border}`, borderRadius: '6px', padding: '2px 6px',
        cursor: disabled ? 'not-allowed' : 'text',
      }}
    />
  );
}

function TankRadioRow({ tank, selected, disabled, onSelect, currentRVP, currentVol, badge }) {
  return (
    <div
      onClick={() => !disabled && onSelect(tank.id)}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '6px 8px', borderRadius: '6px', cursor: disabled ? 'not-allowed' : 'pointer',
        backgroundColor: selected ? 'rgba(0,179,152,.08)' : 'transparent',
        border: selected ? `1px solid rgba(0,179,152,.35)` : `1px solid transparent`,
        opacity: disabled ? 0.4 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
        marginBottom: '4px',
      }}
    >
      <div style={{
        width: '12px', height: '12px', borderRadius: '50%', flexShrink: 0,
        border: `2px solid ${selected ? C.amber : C.faint}`,
        backgroundColor: selected ? C.amber : 'transparent',
      }} />
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: '12px', color: C.text, fontFamily: "'Montserrat',sans-serif" }}>{tank.label}</span>
        {currentRVP != null && (
          <span className="font-mono" style={{ fontSize: '10px', color: C.blue, marginLeft: '8px' }}>
            RVP {currentRVP.toFixed(2)}
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
          fontSize: '8px', padding: '2px 5px', borderRadius: '3px',
          backgroundColor: badge === 'BLEND' ? 'rgba(217,101,91,.15)' : 'rgba(0,79,113,.10)',
          color: badge === 'BLEND' ? '#D9655B' : C.blue,
          fontFamily: "'Montserrat',sans-serif", fontWeight: 700,
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
  transfers = {}, setTransfer,
  blendTarget = 8.75,
  allTankPeriods = [],
  onClose,
}) {
  const product = terminalConfig?.products[period?.productKey];
  const tanks   = product?.tanks ?? [];

  const blendingTankIds = new Set(
    allTankPeriods.filter(e => e.blendActive).map(e => e.tankId)
  );

  const periodKey = `${period?.productKey}-${period?.date}-${period?.timeSlot}`;
  const existingAssignment = rackTankAssignments[periodKey] ?? null;

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

  const [primaryTank, setPrimaryTank] = useState(existingAssignment?.primary  ?? null);
  const [handoffTank, setHandoffTank] = useState(existingAssignment?.handoff  ?? null);
  const [handoffVol,  setHandoffVol]  = useState(existingAssignment?.handoffVolume ?? '');
  const [showHandoff, setShowHandoff] = useState(!!(existingAssignment?.handoff));

  const existingTransfer = transfers[`${period?.tankId}|${period?.date}|${period?.timeSlot}`] ?? null;
  const [transferTo,  setTransferTo]  = useState(existingTransfer?.toTankId ?? null);
  const [transferVol, setTransferVol] = useState(existingTransfer?.volume   ?? '');

  if (!period || !product) return null;

  const isConflict = period.status === 'CONFLICT';

  function handleApply() {
    for (const { receipt } of (receiptsForPeriod ?? [])) {
      for (const tank of tanks) {
        const vol = parseFloat(receiptLocal[receipt.batchCode]?.[tank.id]) || 0;
        setReceiptAllocation(receipt.batchCode, period.date, period.timeSlot, tank.id, vol);
      }
    }
    if (primaryTank) {
      const hv = showHandoff && handoffTank ? (parseFloat(handoffVol) || 0) : 0;
      setRackTank(
        period.productKey, period.date, period.timeSlot,
        primaryTank,
        showHandoff && handoffTank ? handoffTank : null,
        hv
      );
    }
    if (setTransfer) {
      if (transferTo && parseFloat(transferVol) > 0) {
        setTransfer(period.tankId, period.date, period.timeSlot, transferTo, parseFloat(transferVol));
      } else {
        setTransfer(period.tankId, period.date, period.timeSlot, null, 0);
      }
    }
    onClose();
  }

  function setReceiptTankVol(batchCode, tankId, val) {
    setReceiptLocal(prev => ({
      ...prev,
      [batchCode]: { ...prev[batchCode], [tankId]: val },
    }));
  }

  const tankEntries = Object.fromEntries(allTankPeriods.map(e => [e.tankId, e]));
  const totalDemand = Math.abs(liftingForPeriod);
  const hv          = showHandoff && handoffTank ? (parseFloat(handoffVol) || 0) : 0;
  const primaryVol  = Math.max(0, totalDemand - Math.abs(hv));

  const totalUnallocated = (receiptsForPeriod ?? []).reduce(
    (sum, { receipt, sliceVolume }) => {
      const allocated = tanks.reduce(
        (s, t) => s + (parseFloat(receiptLocal[receipt.batchCode]?.[t.id]) || 0), 0
      );
      return sum + Math.max(0, sliceVolume - allocated);
    }, 0
  );
  const receiptFullyAllocated = totalUnallocated < 0.5;
  const applyDisabled = receiptsForPeriod?.length > 0 && !receiptFullyAllocated;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,40,70,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        backgroundColor: C.panel, border: `1px solid ${C.borderEm}`,
        borderRadius: '12px', padding: '20px',
        width: '540px', maxHeight: '85vh', overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: '16px',
        boxShadow: '0 20px 48px -12px rgba(0,79,113,.25)',
      }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span className="font-mono" style={{ fontSize: '13px', color: C.text, fontWeight: 600 }}>
              {period.tankId} · {period.date} · {period.timeSlot}
            </span>
            <span style={{ fontSize: '11px', color: C.muted, marginLeft: '8px', fontFamily: "'Montserrat',sans-serif" }}>
              {product.label}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.faint, fontSize: '18px', cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}>×</button>
        </div>

        {/* Conflict warning */}
        {isConflict && (
          <div style={{
            backgroundColor: 'rgba(217,101,91,.08)', border: `1px solid rgba(217,101,91,.30)`,
            borderRadius: '8px', padding: '10px 14px',
          }}>
            <div style={{ fontSize: '12px', color: C.red, fontWeight: 700, marginBottom: '3px', fontFamily: "'Montserrat',sans-serif" }}>
              ⚠ Pipeline receipt conflict — this tank is blending.
            </div>
            <div style={{ fontSize: '11px', color: C.muted, fontFamily: "'Montserrat',sans-serif" }}>
              Assign this batch to another tank below.
            </div>
          </div>
        )}

        {/* Section A: Receipts */}
        {receiptsForPeriod?.length > 0 && (
          <div>
            <div style={sectionLabel}>Receipts</div>
            {receiptsForPeriod.map(({ receipt, sliceVolume }) => {
              const allocated   = tanks.reduce(
                (s, t) => s + (parseFloat(receiptLocal[receipt.batchCode]?.[t.id]) || 0), 0
              );
              const unallocated = sliceVolume - allocated;
              return (
                <div key={receipt.batchCode} style={{
                  backgroundColor: C.bg, borderRadius: '8px', padding: '10px 12px',
                  marginBottom: '8px', border: `1px solid ${C.border}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span className="font-mono" style={{ fontSize: '11px', color: C.text }}>{receipt.batchCode}</span>
                    <span className="font-mono" style={{ fontSize: '11px', color: C.muted }}>
                      {sliceVolume.toFixed(0)} bbl &nbsp;|&nbsp;
                      <span style={{ color: C.blue }}>RVP {receipt.rvp != null ? receipt.rvp.toFixed(2) : '—'}</span>
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                    {tanks.map(tank => {
                      const isThisBlending = blendingTankIds.has(tank.id);
                      return (
                        <div
                          key={tank.id}
                          style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
                            opacity: isThisBlending ? 0.4 : 1,
                            border: (!isThisBlending && isConflict) ? `1px solid rgba(0,179,152,.35)` : 'none',
                            borderRadius: '6px', padding: isConflict ? '3px 6px' : '0',
                          }}
                        >
                          <span style={{ fontSize: '10px', color: C.muted, marginBottom: '3px', fontFamily: "'Montserrat',sans-serif" }}>{tank.label}</span>
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
                    <div style={{ fontSize: '11px', color: C.red, marginTop: '6px', fontFamily: "'Montserrat',sans-serif" }}>
                      ⚠ {unallocated.toFixed(0)} bbl unallocated
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
          <div style={{ fontSize: '11px', color: C.muted, marginBottom: '8px', fontFamily: "'Montserrat',sans-serif" }}>
            Lifting this period:&nbsp;
            <span className="font-mono" style={{ color: C.text }}>{totalDemand.toLocaleString()} bbl</span>
          </div>

          <div style={{ fontSize: '10px', color: C.faint, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '1.2px', fontFamily: "'Montserrat',sans-serif" }}>
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
            <div style={{ fontSize: '11px', color: C.muted, marginTop: '4px', marginBottom: '8px', fontFamily: "'Montserrat',sans-serif" }}>
              Primary receives:&nbsp;
              <span className="font-mono" style={{ color: C.text }}>{primaryVol.toLocaleString()} bbl</span>
            </div>
          )}

          {!showHandoff ? (
            <button
              onClick={() => setShowHandoff(true)}
              style={{
                fontSize: '11px', color: C.amber, background: 'none', border: 'none',
                cursor: 'pointer', padding: '0', fontFamily: "'Montserrat',sans-serif",
                fontWeight: 600,
              }}
            >
              + Add handoff tank (optional)
            </button>
          ) : (
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: '10px', marginTop: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '10px', color: C.faint, textTransform: 'uppercase', letterSpacing: '1.2px', fontFamily: "'Montserrat',sans-serif" }}>
                  Handoff tank (mid-period)
                </span>
                <button
                  onClick={() => { setShowHandoff(false); setHandoffTank(null); setHandoffVol(''); }}
                  style={{ fontSize: '11px', color: C.muted, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Montserrat',sans-serif" }}
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
                <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11px', color: C.muted, fontFamily: "'Montserrat',sans-serif" }}>Handoff volume (bbl):</span>
                  <NumInput value={handoffVol} onChange={setHandoffVol} color={C.amber} />
                  <span style={{ fontSize: '11px', color: C.faint, fontFamily: "'Montserrat',sans-serif" }}>
                    (max {totalDemand.toLocaleString()})
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Section C: Transfer */}
        {(() => {
          const destTanks = tanks.filter(t =>
            t.id !== period.tankId && !blendingTankIds.has(t.id)
          );
          if (!destTanks.length) return null;
          const sourceRVP = period.closingRVP;
          const warnRVP   = transferTo != null && sourceRVP < blendTarget;
          return (
            <div>
              <div style={sectionLabel}>Transfer (this period only)</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', color: C.muted, fontFamily: "'Montserrat',sans-serif" }}>To</span>
                <select
                  value={transferTo ?? ''}
                  onChange={e => setTransferTo(e.target.value || null)}
                  style={{
                    backgroundColor: C.bg, color: C.text, fontSize: '11px',
                    border: `1px solid ${C.border}`, borderRadius: '6px',
                    padding: '3px 8px', fontFamily: "'Montserrat',sans-serif",
                    cursor: 'pointer', outline: 'none',
                  }}
                >
                  <option value="">— none —</option>
                  {destTanks.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
                <NumInput
                  value={transferVol}
                  onChange={setTransferVol}
                  color={C.blue}
                />
                <span style={{ fontSize: '11px', color: C.faint, fontFamily: "'Montserrat',sans-serif" }}>bbl</span>
                {(transferTo || transferVol) && (
                  <button
                    onClick={() => { setTransferTo(null); setTransferVol(''); }}
                    style={{ fontSize: '11px', color: C.faint, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Montserrat',sans-serif" }}
                  >
                    Clear
                  </button>
                )}
              </div>
              {warnRVP && (
                <div style={{ fontSize: '11px', color: C.amber, marginTop: '2px', fontFamily: "'Montserrat',sans-serif" }}>
                  ⚠ Source RVP {sourceRVP.toFixed(2)} is below blend target — transferring forfeits uncaptured margin
                </div>
              )}
            </div>
          );
        })()}

        {/* Footer */}
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: '12px' }}>
          {!receiptFullyAllocated && (
            <div style={{ fontSize: '11px', color: C.red, textAlign: 'right', marginBottom: '8px', fontFamily: "'Montserrat',sans-serif" }}>
              ⚠ {Math.round(totalUnallocated).toLocaleString()} bbl unallocated — assign all volume before applying
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '5px 16px', fontSize: '12px', fontFamily: "'Montserrat',sans-serif",
                backgroundColor: C.bg, color: C.muted,
                border: `1px solid ${C.border}`, borderRadius: '8px', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={applyDisabled ? undefined : handleApply}
              disabled={applyDisabled}
              style={{
                padding: '5px 16px', fontSize: '12px', fontWeight: 700, border: 'none',
                borderRadius: '8px', fontFamily: "'Montserrat',sans-serif",
                backgroundColor: applyDisabled ? C.border : C.amber,
                color: applyDisabled ? C.faint : '#FFFFFF',
                cursor: applyDisabled ? 'not-allowed' : 'pointer',
              }}
            >
              Apply
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
