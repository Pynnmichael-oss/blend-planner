import { useState } from 'react';
import OpeningInventoryForm from '../datainput/OpeningInventoryForm';
import LiftingsInput from '../datainput/LiftingsInput';
import T4PasteInput from '../datainput/T4PasteInput';
import BlendPlannerGrid from '../blendplanner/BlendPlannerGrid';
import BlendPlanSummary from '../blendplanner/BlendPlanSummary';
import GuideTab from './GuideTab';

const TERMINALS   = [{ id: 'fort-worth', name: 'Fort Worth' }, { id: 'tampa', name: 'Tampa' }];
const DAY_OPTIONS = [3, 5, 8];
const TABS        = ['PLAN', 'RECEIPTS', 'LIFTINGS', 'SUMMARY', 'GUIDE'];

const C = {
  pageBg:    '#FFFFFF',
  headerBg:  '#EEF3F6',
  sidebar:   '#EEF3F6',
  panel:     '#EEF3F6',
  border:    'rgba(0,79,113,.13)',
  borderEm:  'rgba(0,79,113,.25)',
  text:      '#063A52',
  secondary: '#5E7A8A',
  muted:     '#9DB0BC',
  amber:     '#00B398',
  blue:      '#004F71',
  red:       '#D9655B',
  green:     '#00B398',
  teal:      '#00B398',
  slate:     '#004F71',
};

const SIDEBAR_W = 300;

const labelStyle = {
  fontSize: '10px', color: '#5E7A8A', textTransform: 'uppercase',
  letterSpacing: '1.4px', fontWeight: 700, flexShrink: 0,
};

const selectStyle = {
  backgroundColor: '#FFFFFF', color: '#063A52', border: '1px solid rgba(0,79,113,.13)',
  borderRadius: '9px', padding: '5px 12px', fontSize: '12px',
  fontFamily: "'Montserrat',sans-serif", fontWeight: 600, outline: 'none', cursor: 'pointer',
};

function SidebarSection({ label, open, onToggle, children }) {
  return (
    <div style={{ borderBottom: `1px solid ${C.border}` }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer',
          color: '#004F71', fontSize: '11px', fontWeight: 700,
          letterSpacing: '1.4px', textTransform: 'uppercase',
          borderBottom: '1px solid rgba(0,79,113,.13)',
        }}
      >
        <span>{label}</span>
        <span style={{ fontSize: '11px', color: '#9DB0BC', fontWeight: 'normal' }}>
          {open ? '▲' : '▼'}
        </span>
      </button>
      <div style={{ maxHeight: open ? '1200px' : '0', overflow: 'hidden', transition: 'max-height 0.2s ease' }}>
        <div style={{ padding: '4px 12px 12px' }}>{children}</div>
      </div>
    </div>
  );
}

export default function AppShell({
  terminalId, terminalConfig, startDate, setTerminalId, setStartDate,
  openingInventory, setOpeningInventory,
  receipts, setReceipts,
  liftings, setLiftings,
  planDays, setPlanDays,
  grid, toggleBlend, toggleIdle, toggleRack,
  receiptAllocations, rackTankAssignments,
  setReceiptAllocation, setRackTank,
  parsedReceipts, setParsedReceipts,
  rvpValues, setRvpValues,
  rvpConfirmed, setRvpConfirmed,
  startSlot, setStartSlot,
  specCeiling, setSpecCeiling,
  blendTarget, setBlendTarget,
}) {
  const [activeTab,  setActiveTab]  = useState('PLAN');
  const [open,       setOpen]       = useState({ inventory: true });
  const [summaryOpen, setSummaryOpen] = useState(false);
  const toggle = key => setOpen(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      backgroundColor: C.pageBg, color: C.text, fontFamily: "'Montserrat', system-ui, sans-serif",
    }}>

      {/* ── Header ──────────────────────────────────────────────── */}
      <header style={{
        flexShrink: 0,
        backgroundColor: C.headerBg,
        position: 'sticky', top: 0, zIndex: 50,
      }}>

        {/* Row 1: wordmark + core controls */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '14px',
          padding: '10px 20px', borderBottom: '1px solid rgba(0,79,113,.08)',
        }}>
          {/* Wordmark */}
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '19px', letterSpacing: '.5px', color: '#004F71', lineHeight: '.96' }}>
            GLOBAL<span style={{ display: 'block', fontWeight: 700, fontSize: '10px', letterSpacing: '3.5px', color: '#00B398', marginTop: '2px' }}>PARTNERS</span>
          </div>

          {/* Divider */}
          <div style={{ width: '1px', height: '30px', background: 'rgba(0,79,113,.13)' }} />

          {/* Page name */}
          <div style={{ fontWeight: 700, fontSize: '14px', letterSpacing: '.4px', color: '#004F71' }}>
            Blend Planner <span style={{ color: '#5E7A8A', fontWeight: 500 }}>· Fort Worth</span>
          </div>

          {/* Terminal selector */}
          <select
            value={terminalId}
            onChange={e => setTerminalId(e.target.value)}
            style={selectStyle}
          >
            {TERMINALS.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>

          {/* Week of date picker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={labelStyle}>Week of</span>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              style={{
                backgroundColor: '#FFFFFF', color: '#063A52',
                border: '1px solid rgba(0,79,113,.13)', borderRadius: '9px',
                padding: '5px 10px', fontSize: '12px', fontFamily: "'Montserrat',sans-serif",
                colorScheme: 'light', outline: 'none', cursor: 'pointer',
              }}
            />
          </div>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Dashboard link */}
          <a href="/Terminal-Dashboard/" style={{ fontSize: '13px', fontWeight: 700, color: '#5E7A8A', textDecoration: 'none', letterSpacing: '.3px' }}>
            ← Dashboard
          </a>
        </div>

        {/* Row 2: tabs + slot/day controls */}
        <div style={{
          display: 'flex', alignItems: 'center',
          padding: '4px 20px 0', borderBottom: '1px solid rgba(0,79,113,.13)',
          backgroundColor: '#FFFFFF',
        }}>
          {/* Tab bar */}
          <div style={{ display: 'flex', gap: '0px' }}>
            {TABS.map(tab => {
              const active = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: '6px 14px', paddingBottom: '8px',
                    fontSize: '12px', fontFamily: "'Montserrat',sans-serif",
                    fontWeight: active ? 700 : 600, letterSpacing: '.5px',
                    border: 'none', borderBottom: active ? '2px solid #00B398' : '2px solid transparent',
                    cursor: 'pointer', borderRadius: 0,
                    backgroundColor: active ? '#EEF3F6' : 'transparent',
                    color: active ? '#004F71' : '#5E7A8A',
                    transition: 'all 0.12s',
                  }}
                >
                  {tab}
                </button>
              );
            })}
          </div>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Start slot selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: '10px' }}>
            <span style={labelStyle}>Start</span>
            <select
              value={startSlot ?? 'null'}
              onChange={e => setStartSlot(e.target.value === 'null' ? null : e.target.value)}
              style={selectStyle}
            >
              <option value="null">Full day</option>
              <option value="00-05">00:00</option>
              <option value="06-11">06:00</option>
              <option value="12-17">12:00</option>
              <option value="18-23">18:00</option>
            </select>
          </div>

          {/* Plan day pill toggles */}
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', paddingBottom: '4px' }}>
            {DAY_OPTIONS.map(n => (
              <button
                key={n}
                onClick={() => setPlanDays(n)}
                style={{
                  padding: '4px 12px', fontSize: '11px', borderRadius: '100px',
                  border: `1px solid ${planDays === n ? '#004F71' : 'rgba(0,79,113,.13)'}`,
                  cursor: 'pointer', fontFamily: "'Montserrat',sans-serif",
                  backgroundColor: planDays === n ? '#004F71' : 'transparent',
                  color:           planDays === n ? '#FFFFFF' : '#5E7A8A',
                  fontWeight:      planDays === n ? 700 : 600,
                  transition: 'all 0.15s',
                }}
              >
                {n}d
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── PLAN tab ── */}
        {activeTab === 'PLAN' && (
          <>
            {/* Left sidebar */}
            <div style={{
              width: SIDEBAR_W, flexShrink: 0,
              backgroundColor: C.sidebar, borderRight: `1px solid ${C.border}`,
              overflowY: 'auto',
            }}>
              <SidebarSection label="Opening Inventory" open={open.inventory} onToggle={() => toggle('inventory')}>
                <OpeningInventoryForm
                  openingInventory={openingInventory}
                  terminalConfig={terminalConfig}
                  setOpeningInventory={setOpeningInventory}
                  specCeiling={specCeiling}
                  setSpecCeiling={setSpecCeiling}
                  blendTarget={blendTarget}
                  setBlendTarget={setBlendTarget}
                />
              </SidebarSection>


            </div>

            {/* Main grid content */}
            <div style={{ flex: 1, overflowY: 'auto', backgroundColor: C.pageBg }}>
              <div style={{ padding: '14px 18px' }}>
                <BlendPlannerGrid
                  grid={grid}
                  terminalConfig={terminalConfig}
                  toggleBlend={toggleBlend}
                  toggleIdle={toggleIdle}
                  onToggleRack={toggleRack}
                  receipts={receipts}
                  liftings={liftings}
                  receiptAllocations={receiptAllocations}
                  rackTankAssignments={rackTankAssignments}
                  setReceiptAllocation={setReceiptAllocation}
                  setRackTank={setRackTank}
                />
              </div>

              {/* Blend Plan Summary — collapsible */}
              <div style={{ borderTop: `1px solid ${C.border}` }}>
                <button
                  onClick={() => setSummaryOpen(v => !v)}
                  style={{
                    width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 18px', background: 'none', border: 'none', cursor: 'pointer',
                    color: '#004F71', fontSize: '10px', fontWeight: 700,
                    letterSpacing: '1.4px', textTransform: 'uppercase',
                  }}
                >
                  <span>Blend Plan Summary</span>
                  <span style={{ fontSize: '12px', color: '#9DB0BC', fontWeight: 'normal' }}>
                    {summaryOpen ? '▲' : '▼'}
                  </span>
                </button>
                <div style={{ maxHeight: summaryOpen ? '4000px' : '0', overflow: 'hidden', transition: 'max-height 0.25s ease' }}>
                  <div style={{ padding: '0 18px 24px' }}>
                    <BlendPlanSummary
                      grid={grid} terminalConfig={terminalConfig}
                      startDate={startDate} openingInventory={openingInventory} liftings={liftings}
                      specCeiling={specCeiling} blendTarget={blendTarget}
                    />
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── RECEIPTS tab ── */}
        {activeTab === 'RECEIPTS' && (
          <T4PasteInput
            terminalConfig={terminalConfig}
            onReceiptsChange={setReceipts}
            parsedReceipts={parsedReceipts}
            setParsedReceipts={setParsedReceipts}
            rvpValues={rvpValues}
            setRvpValues={setRvpValues}
            rvpConfirmed={rvpConfirmed}
            setRvpConfirmed={setRvpConfirmed}
          />
        )}

        {/* ── LIFTINGS tab ── */}
        {activeTab === 'LIFTINGS' && (
          <div style={{ flex: 1, overflowY: 'auto', backgroundColor: C.pageBg, padding: '18px' }}>
            <LiftingsInput
              terminalConfig={terminalConfig}
              liftings={liftings}
              onLiftingsChange={setLiftings}
              planDays={planDays}
              startDate={startDate ?? new Date().toISOString().slice(0, 10)}
            />
          </div>
        )}

        {/* ── SUMMARY tab ── */}
        {activeTab === 'SUMMARY' && (
          <div style={{ flex: 1, overflowY: 'auto', backgroundColor: C.pageBg, padding: '18px' }}>
            <BlendPlanSummary
              grid={grid}
              terminalConfig={terminalConfig}
              startDate={startDate}
              openingInventory={openingInventory}
              liftings={liftings}
              specCeiling={specCeiling}
              blendTarget={blendTarget}
            />
          </div>
        )}

        {/* ── GUIDE tab ── */}
        {activeTab === 'GUIDE' && (
          <GuideTab />
        )}
      </div>
    </div>
  );
}
