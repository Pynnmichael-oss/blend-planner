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
  pageBg:    '#0a0c12',
  headerBg:  '#0f1117',
  sidebar:   '#0f1117',
  panel:     '#111827',
  border:    '#1e293b',
  borderEm:  '#2a2d3a',
  text:      '#f1f5f9',
  secondary: '#64748b',
  muted:     '#334155',
  amber:     '#f59e0b',
  blue:      '#60a5fa',
  red:       '#ef4444',
  green:     '#22c55e',
};

const SIDEBAR_W = 300;
const HEADER_H  = 48;

function SidebarSection({ label, open, onToggle, children }) {
  return (
    <div style={{ borderBottom: `1px solid ${C.border}` }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer',
          color: C.amber, fontSize: '10px', fontWeight: '600',
          letterSpacing: '0.08em', textTransform: 'uppercase',
        }}
      >
        <span>{label}</span>
        <span style={{ fontSize: '11px', color: C.secondary, fontWeight: 'normal' }}>
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
  grid, toggleBlend, toggleIdle,
  receiptAllocations, rackTankAssignments,
  setReceiptAllocation, setRackTank,
  parsedReceipts, setParsedReceipts,
  rvpValues, setRvpValues,
  rvpConfirmed, setRvpConfirmed,
}) {
  const [activeTab,  setActiveTab]  = useState('PLAN');
  const [open,       setOpen]       = useState({ inventory: true });
  const [summaryOpen, setSummaryOpen] = useState(false);
  const toggle = key => setOpen(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      backgroundColor: C.pageBg, color: C.text, fontFamily: 'system-ui, sans-serif',
    }}>

      {/* ── Header ──────────────────────────────────────────────── */}
      <header style={{
        height: HEADER_H, flexShrink: 0,
        backgroundColor: C.headerBg, borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', gap: '14px', padding: '0 18px',
      }}>
        <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '13px', color: C.amber, letterSpacing: '0.1em' }}>
          BLEND PLANNER
        </span>

        {/* Terminal pill selector */}
        <select
          value={terminalId}
          onChange={e => setTerminalId(e.target.value)}
          style={{
            backgroundColor: C.panel, color: C.text, border: `1px solid ${C.amber}`,
            borderRadius: '100px', padding: '3px 14px', fontSize: '12px', cursor: 'pointer', outline: 'none',
          }}
        >
          {TERMINALS.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>

        {/* WEEK OF date picker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '10px', color: C.amber, textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 }}>
            Week of
          </span>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            style={{
              backgroundColor: C.panel, color: C.text,
              border: `1px solid ${C.border}`, borderRadius: '4px',
              padding: '2px 6px', fontSize: '11px', fontFamily: 'monospace',
              colorScheme: 'dark', outline: 'none', cursor: 'pointer',
            }}
          />
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: '2px', marginLeft: '8px' }}>
          {TABS.map(tab => {
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '4px 13px', fontSize: '10px', fontFamily: 'monospace',
                  fontWeight: active ? 600 : 'normal', letterSpacing: '0.07em',
                  border: 'none', borderRadius: '3px', cursor: 'pointer',
                  backgroundColor: active ? C.amber : 'transparent',
                  color:           active ? '#000'   : C.secondary,
                  transition: 'all 0.12s',
                }}
              >
                {tab}
              </button>
            );
          })}
        </div>

        {/* Plan day pill toggles — always visible */}
        <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto', alignItems: 'center' }}>
          {DAY_OPTIONS.map(n => (
            <button
              key={n}
              onClick={() => setPlanDays(n)}
              style={{
                padding: '3px 11px', fontSize: '11px', borderRadius: '100px',
                border: `1px solid ${planDays === n ? C.amber : C.borderEm}`,
                cursor: 'pointer', fontFamily: 'monospace',
                backgroundColor: planDays === n ? C.amber : 'transparent',
                color:           planDays === n ? '#000'   : C.secondary,
                fontWeight:      planDays === n ? '600'    : 'normal',
                transition: 'all 0.15s',
              }}
            >
              {n}d
            </button>
          ))}
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
                    color: C.amber, fontSize: '11px', fontWeight: '600',
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                  }}
                >
                  <span>Blend Plan Summary</span>
                  <span style={{ fontSize: '12px', color: C.secondary, fontWeight: 'normal' }}>
                    {summaryOpen ? '▲' : '▼'}
                  </span>
                </button>
                <div style={{ maxHeight: summaryOpen ? '4000px' : '0', overflow: 'hidden', transition: 'max-height 0.25s ease' }}>
                  <div style={{ padding: '0 18px 24px' }}>
                    <BlendPlanSummary grid={grid} terminalConfig={terminalConfig} startDate={startDate} openingInventory={openingInventory} liftings={liftings} />
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
