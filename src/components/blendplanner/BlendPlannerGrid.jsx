import { useState } from 'react';
import { distributeReceipts } from '../../data/distributeReceipts';
import AllocationPanel from './AllocationPanel';
import TankRow from './TankRow';

const C = {
  bg:     '#EEF3F6',
  border: 'rgba(0,79,113,.13)',
  text:   '#063A52',
  muted:  '#5E7A8A',
  faint:  '#9DB0BC',
  amber:  '#004F71',
  blue:   '#004F71',
};

const WEEKDAY_ABBR = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
const MONTH_ABBR   = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const SLOT_LABEL   = { "00-05": "00–06", "06-11": "06–12", "12-17": "12–18", "18-23": "18–24" };

function dateHeaderParts(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  return {
    weekday:  WEEKDAY_ABBR[d.getUTCDay()],
    monthDay: `${MONTH_ABBR[d.getUTCMonth()]} ${d.getUTCDate()}`,
  };
}

function spansByDate(periods) {
  const spans = [];
  for (const p of periods) {
    if (!spans.length || spans[spans.length - 1].date !== p.date)
      spans.push({ date: p.date, count: 1 });
    else
      spans[spans.length - 1].count++;
  }
  return spans;
}

function groupGrid(grid, terminalConfig) {
  const seenPeriods = new Set();
  const periods = [];
  for (const entry of grid) {
    const key = `${entry.date}|${entry.timeSlot}`;
    if (!seenPeriods.has(key)) {
      seenPeriods.add(key);
      periods.push({ date: entry.date, timeSlot: entry.timeSlot, key });
    }
  }
  const grouped = {};
  for (const [productKey, product] of Object.entries(terminalConfig.products)) {
    const cellsByTank = {};
    for (const tank of product.tanks) cellsByTank[tank.id] = {};
    for (const entry of grid) {
      if (entry.productKey === productKey && cellsByTank[entry.tankId])
        cellsByTank[entry.tankId][`${entry.date}|${entry.timeSlot}`] = entry;
    }
    grouped[productKey] = { product, periods, cellsByTank };
  }
  return grouped;
}

function getReceiptsForPeriod(allReceipts, productKey, date, timeSlot) {
  return allReceipts
    .filter(r => r.product === productKey)
    .flatMap(receipt => {
      const slices = distributeReceipts([receipt], date, timeSlot);
      return slices.length > 0 ? [{ receipt, sliceVolume: slices[0].volume }] : [];
    });
}

function getLiftingForPeriod(liftings, terminalConfig, productKey, date, timeSlot) {
  const tankIds = new Set(
    (terminalConfig.products[productKey]?.tanks ?? []).map(t => t.id)
  );
  return liftings
    .filter(l =>
      l.date === date &&
      l.timeSlot === timeSlot &&
      (l.productKey === productKey || tankIds.has(l.tankId))
    )
    .reduce((sum, l) => sum + l.volume, 0);
}

const thBase = {
  padding: '5px 6px',
  fontWeight: 'normal',
  borderBottom: `0.5px solid rgba(0,79,113,.13)`,
  textAlign: 'center',
  whiteSpace: 'nowrap',
};

export default function BlendPlannerGrid({
  grid, terminalConfig, toggleBlend, toggleIdle, onToggleRack,
  receipts = [], liftings = [],
  receiptAllocations = {}, rackTankAssignments = {},
  setReceiptAllocation, setRackTank,
  transfers = {}, setTransfer,
  blendTarget = 8.75,
}) {
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [collapsed, setCollapsed] = useState({});

  if (!grid?.length) {
    return <div style={{ color: C.muted, fontSize: '12px', padding: '8px 0' }}>No grid data.</div>;
  }

  const grouped = groupGrid(grid, terminalConfig);

  // First period's openingInventory / safeFill per tank for row-header gauge
  const openingPct = {};
  for (const entry of grid) {
    if (openingPct[entry.tankId] === undefined) {
      const tank = Object.values(terminalConfig.products)
        .flatMap(p => p.tanks).find(t => t.id === entry.tankId);
      openingPct[entry.tankId] = tank ? entry.openingInventory / tank.safeFill : 0;
    }
  }

  const productEntries = Object.entries(grouped);

  return (
    <>
      {productEntries.map(([productKey, { product, periods, cellsByTank }], sectionIdx) => {
        if (!product.tanks.length) return null;
        const dateSpans = spansByDate(periods);

        // Build date → 0-based index map for alternating column backgrounds
        const dateIndexMap = {};
        dateSpans.forEach(({ date }, i) => { dateIndexMap[date] = i; });

        return (
          <div key={productKey}>
            {/* 24px section divider between products */}
            {sectionIdx > 0 && (
              <div style={{ height: '24px', display: 'flex', alignItems: 'center', gap: '10px', margin: '4px 0' }}>
                <div style={{ flex: 1, height: '0.5px', backgroundColor: C.border }} />
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#9DB0BC', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  {product.label}
                </span>
                <div style={{ flex: 1, height: '0.5px', backgroundColor: C.border }} />
              </div>
            )}

            {/* Product section header — clickable to collapse */}
            <div
              onClick={() => setCollapsed(prev => ({ ...prev, [productKey]: !prev[productKey] }))}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '6px 0', cursor: 'pointer', userSelect: 'none',
              }}
            >
              <span style={{
                fontSize: '11px', fontWeight: 700, letterSpacing: '1.5px',
                textTransform: 'uppercase', color: C.text,
              }}>
                {product.label}
              </span>
              <span style={{ fontSize: '10px', color: C.muted }}>
                {collapsed[productKey] ? '▶ show' : '▼ hide'}
              </span>
            </div>

            {!collapsed[productKey] && (
              <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
                <table style={{ borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead>
                    {/* Row 1: weekday + date, colspan = 4 per day */}
                    <tr>
                      <th style={{
                        ...thBase, width: '88px', minWidth: '88px', textAlign: 'left',
                        backgroundColor: '#EEF3F6',
                        borderRight: `0.5px solid ${C.border}`,
                      }} />
                      {dateSpans.map(({ date, count }, idx) => {
                        const { weekday, monthDay } = dateHeaderParts(date);
                        const dayBg = idx % 2 === 0 ? '#FFFFFF' : '#F5F8FA';
                        return (
                          <th key={date} colSpan={count} style={{
                            ...thBase, fontWeight: 'bold',
                            backgroundColor: dayBg,
                            borderRight: `0.5px solid ${C.border}`,
                            borderLeft: `0.5px solid ${C.border}`,
                          }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px', padding: '2px 0' }}>
                              <span style={{ color: '#00B398', fontSize: '11px', fontWeight: 800, letterSpacing: '0.06em' }}>
                                {weekday}
                              </span>
                              <span style={{ color: '#063A52', fontSize: '12px', fontWeight: 700 }}>{monthDay}</span>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                    {/* Row 2: slot labels */}
                    <tr>
                      <th style={{ ...thBase, textAlign: 'left', color: '#5E7A8A', backgroundColor: '#EEF3F6', borderRight: `0.5px solid ${C.border}`, fontSize: '10px' }}>
                        Tank
                      </th>
                      {periods.map((p) => {
                        const dayIdx = dateIndexMap[p.date] ?? 0;
                        const dayBg  = dayIdx % 2 === 0 ? '#FFFFFF' : '#F5F8FA';
                        return (
                          <th key={p.key} style={{
                            ...thBase, fontSize: '10px', fontWeight: 600, color: '#5E7A8A',
                            backgroundColor: dayBg,
                            borderRight: `0.5px solid ${C.border}`,
                          }}>
                            {SLOT_LABEL[p.timeSlot] ?? p.timeSlot}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {product.tanks.map(tank => (
                      <TankRow
                        key={tank.id}
                        tank={tank}
                        periods={periods}
                        cells={cellsByTank[tank.id]}
                        openingFillPct={openingPct[tank.id] ?? 0}
                        toggleBlend={toggleBlend}
                        onToggleIdle={toggleIdle}
                        onToggleRack={onToggleRack}
                        onCellClick={setSelectedPeriod}
                        dateIndexMap={dateIndexMap}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {collapsed[productKey] && (
              <div style={{
                display: 'flex', gap: '16px', padding: '4px 0 8px',
                fontSize: '11px', color: C.muted, fontFamily: 'monospace',
              }}>
                {product.tanks.map(tank => {
                  const latestPeriod = grid.filter(e => e.tankId === tank.id).at(-1);
                  return (
                    <span key={tank.id}>
                      <span style={{ color: C.text }}>{tank.label}</span>
                      {' '}
                      {latestPeriod
                        ? Math.round(latestPeriod.closingInventory).toLocaleString()
                        : '—'} bbl
                      {' · '}
                      <span style={{ color: C.blue }}>
                        RVP {latestPeriod?.closingRVP?.toFixed(2) ?? '—'}
                      </span>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {selectedPeriod && (
        <AllocationPanel
          period={selectedPeriod}
          terminalConfig={terminalConfig}
          receiptsForPeriod={getReceiptsForPeriod(receipts, selectedPeriod.productKey, selectedPeriod.date, selectedPeriod.timeSlot)}
          liftingForPeriod={getLiftingForPeriod(liftings, terminalConfig, selectedPeriod.productKey, selectedPeriod.date, selectedPeriod.timeSlot)}
          allTankPeriods={grid.filter(e =>
            e.productKey === selectedPeriod.productKey &&
            e.date       === selectedPeriod.date &&
            e.timeSlot   === selectedPeriod.timeSlot
          )}
          receiptAllocations={receiptAllocations}
          rackTankAssignments={rackTankAssignments}
          setReceiptAllocation={setReceiptAllocation}
          setRackTank={setRackTank}
          transfers={transfers}
          setTransfer={setTransfer}
          blendTarget={blendTarget}
          onClose={() => setSelectedPeriod(null)}
        />
      )}
    </>
  );
}
