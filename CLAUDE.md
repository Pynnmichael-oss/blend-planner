# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Blend Planner

Operational planning tool for petroleum terminal rack blending.
Built by Michael Pynn. Domain expert: Kelly (terminal operations).

---

## Stack

- React 19 + Vite 8
- Tailwind CSS v4 (`@import "tailwindcss"` in `index.css` — no config file needed)
- No backend, no router, no state library — single-page, all state in one hook
- Deployed to GitHub Pages at `/blend-planner/` (`vite.config.js` `base` is set)
- `npm run dev` · `npm run build` · `npm run preview` · `npm run lint` · `npm run deploy` (gh-pages)
- Tailwind v4 is wired via `@import "tailwindcss"` in `index.css` through PostCSS — **`@tailwindcss/vite` is in `package.json` but is NOT added to `vite.config.js`**; do not add it without testing

---

## What This Tool Does

Terminal operators enter:
1. Opening tank inventory (pumpable bbls + RVP per tank)
2. T4 pipeline schedule (paste from Explorer portal, tab-separated)
3. Rack liftings (customer withdrawals, defaults from a weekday curve)

The app projects closing inventory and RVP for every tank across every 6-hour period for 3, 5, or 8 days. It flags when a tank should be blending butane vs racking normally.

---

## Directory Structure

```
src/
  App.jsx                          — pure wiring: useBlendPlanner → AppShell
  main.jsx                         — React root, imports index.css
  index.css                        — @import "tailwindcss" only

  config/
    fort-worth.json                — LIVE tank data for Fort Worth terminal
    tampa.json                     — stub (tanks array empty)
    terminal-schema.js             — documentation stub, no runtime use yet

  data/                            — pure functions, no React
    inventoryCalc.js               — buildPlanGrid() — the core engine
    rvpCalc.js                     — calcClosingRVP()
    butaneCalc.js                  — calcButaneDemand()
    distributeReceipts.js          — distributeReceipts() — time-window overlap
    liftingsCurve.js               — buildLiftingsGrid(), getDefaultLifting()
    parseT4.js                     — parseT4() — tab-separated T4 paste parser
    blendPlanSummary.js            — detectBlends(grid, terminalConfig) → BlendRow[]
    blendLogic.js                  — evaluateBlendSignal() — STUB, pending Kelly spec
    googleSheets.js                — savePlanToSheet(), JWT signing via SubtleCrypto

  hooks/
    useBlendPlanner.js             — single source of truth for all app state
    useTerminalConfig.js           — stub (not wired)

  components/
    layout/
      AppShell.jsx                 — fixed header + 272px sidebar + scrollable main
    blendplanner/
      BlendPlannerGrid.jsx         — groups grid flat array → per-product tables
      TankRow.jsx                  — renders one <tr>: row header + all period cells
      InventoryBar.jsx             — VerticalTankGauge component (default export)
      AllocationPanel.jsx          — modal overlay for per-tank receipt/lifting allocation
      BlendPlanSummary.jsx         — summary table + BlendCalculator cards + SavePlanButton
      BlendToggle.jsx              — stub
      DayColumn.jsx                — stub
      ProductSection.jsx           — stub
      RVPDisplay.jsx               — stub
    datainput/
      OpeningInventoryForm.jsx     — compact tank inventory form, grouped by product
      T4PasteInput.jsx             — textarea paste → parseT4 → RVP entry → confirm
      LiftingsInput.jsx            — product × period editable liftings table
      TMSLiftingsInput.jsx         — stub
    shared/
      StatusBadge.jsx              — stub

  mock/
    fort-worth-inventory.js        — fortWorthOpeningInventory (as of 2026-04-16)
    fort-worth-t4.js               — fortWorthReceipts (8 batches, Apr 16–21)
```

---

## Terminal Config Shape

Each `src/config/*.json` follows this structure:

```json
{
  "id": "fort-worth",
  "name": "Fort Worth",
  "shortName": "FW",
  "pipeline": { "source": "Explorer", "connections": ["FM1","FM6"], "defaultDelay": 0 },
  "gradeMap": {
    "regular": ["4C", "4D", "75"],
    "premium": ["3C", "3D"]
  },
  "products": {
    "regular": {
      "label": "Regular",
      "tanks": [
        { "id": "TK55", "label": "Tank 55", "safeFill": 50393, "heel": 6458 }
      ]
    }
  }
}
```

**Fort Worth tank values (from Kelly's spec):**

| Tank | Product | safeFill | heel |
|------|---------|----------|------|
| TK55 | regular | 56851    | 6458 |
| TK56 | regular | 48382    | 4407 |
| TK03 | regular | 15742    | 1313 |
| TK04 | premium | 15838    | 1216 |
| TK05 | premium | 13670    | 1369 |

`bottoms` field was removed — `heel` is the only dead-stock figure used in calculations.

---

## Data Model

### PipelineReceipt
```js
{
  startDatetime: "2026-04-16T01:07:00",  // ISO, no timezone = local terminal time
  batchCode:     "EXP-MTV-4C-201-PTA",
  supplier:      "MTV",
  line:          "FM1",
  volume:        14250,   // bbls total batch
  rate:          4880,    // bbls/hr
  grade:         "4C",
  product:       "regular",
  rvp:           7.0      // null until manually entered after T4 parse
}
```

### TimePeriod (output of buildPlanGrid)
```js
{
  tankId:           "TK55",
  productKey:       "regular",
  date:             "2026-04-16",
  timeSlot:         "00-05",        // see TIME_SLOTS constant
  openingInventory: 38500,          // bbls pumpable at start of period
  openingRVP:       8.9,
  receipts:         [{ volume, rvp }],  // pipeline slices landing this period
  rackLoadings:     -660,           // negative = outbound (liftings)
  blendActive:      false,          // true = tank offline to rack, blending butane
  closingInventory: 37840,
  closingRVP:       8.88,
  fillPct:          0.751,          // closingInventory / safeFill
  space:            12553,          // safeFill - closingInventory
  status:           "RACK",         // see Status Values below
  isManualIdle:     false,          // set via toggleIdle
  manualIdle:       false,          // alias for isManualIdle
  spillVolume:      0,              // bbls that overflowed safeFill cap
  spillWarning:     false,          // spillVolume > 0
  belowHeel:        false,          // always false — LOW status not yet implemented
  heel:             6458,           // tank.heel passed through for downstream use
  safeFill:         56851,          // tank.safeFill passed through
  closingTOV:       44298,          // closingInventory + tank.heel
  conflictMessage:  undefined,      // set when blendActive conflicts with receipt/rack

  // Fields added ONLY on the first post-blend period (blendActive just turned false)
  // when butane demand is > 0 and trucksNeeded > 0:
  postBlendButane:  1710,           // actualButane bbls (trucks * TRUCK_BBLS)
  postBlendTrucks:  9,              // floor(butane_bbls / TRUCK_BBLS)
  postBlendRVP:     8.77,           // blended RVP after butane addition
  // Note: openingInventory and openingRVP on the post-blend period are also
  // overridden to reflect butane already added (inventory + actualButane, RVP = blendedRVP)
}
```

### Liftings entry
```js
{ tankId: "TK55", date: "2026-04-16", timeSlot: "00-05", volume: -660 }
```

---

## Key Constants

```js
// src/data/inventoryCalc.js
TIME_SLOTS = ["00-05", "06-11", "12-17", "18-23"]  // 6-hour windows

// src/data/butaneCalc.js
BUTANE_RVP = 52
TRUCK_BBLS = 190

// src/data/liftingsCurve.js
DAILY_BASE = { regular: -13200, premium: -3800 }  // bbls/day baseline
// Weekday multipliers: Mon 1.0, Tue 1.05, Wed 1.0, Thu 1.05, Fri 1.1, Sat 0.8, Sun 0.6
// Slot distribution: 00-05=15%, 06-11=30%, 12-17=35%, 18-23=20%
```

---

## Calculation Chain

```
openingInventory + receipts + liftings
         │
         ▼
   buildPlanGrid()   ←  distributeReceipts() for each batch × period
         │
         ├─ closingInventory = opening + Σreceipt volumes + rackLoadings
         │
         ├─ closingRVP = calcClosingRVP({ openingRVP, openingVolume, heel, receipts })
         │              numerator   = rvp×volume for opening + heel + each receipt
         │              denominator = openingVolume + heel + Σreceipt volumes
         │
         ├─ fillPct = closingInventory / safeFill
         │
         └─ status (derived, never set manually):
               isManualIdle → IDLE
               closingInventory >= (safeFill − heel) → OVERFILL
               blendActive + (receipt volume > 0 or isRackTank) → CONFLICT
               blendActive → BLEND
               onRack + onReceipt (same tank) → CONFLICT  ← was RACK+RCV, changed
               onRack → RACK
               onReceipt → RECEIPT
               otherwise → IDLE
               (LOW status: belowHeel is always false — not yet implemented)
```

### Blend-end butane injection
When `blendActive` flips false (tank just stopped blending), `buildPlanGrid` immediately calculates butane demand for that tank. If `trucks > 0` and `rvpActual < specCeiling`, it:
1. Attaches `blendSummary: { estPumpable, tov, rvpActual, rvpTarget, butane_bbls, trucks, actualButane, blendedRVP }` to the **last blending period's** result entry (mutates in-place via index).
2. Overrides the **first post-blend period's** `openingInventory`, `openingRVP`, `closingInventory`, `closingTOV`, `closingRVP`, and adds `postBlendButane`, `postBlendTrucks`, `postBlendRVP` fields.

`detectBlends(grid, terminalConfig)` reads `blendSummary` off the last period of each run to populate the `BlendPlanSummary` table.

### distributeReceipts logic
Converts a receipt's `startDatetime + volume + rate` into time-window slices.
`endDatetime = startDatetime + (volume / rate) hours`.
For each window: `overlapHours × rate = volume in that slot`.
Handles midnight carryover naturally via epoch ms arithmetic.

### RVP formula
Matches Excel template rows 61/110. `heel` is always included in denominator because it is always exposed to blend. Formula: `(rvpActual × (pumpable + heel) + 52 × B) / (pumpable + heel + B)` solved for B gives `calcButaneDemand`.

---

## State Architecture

All state lives in `useBlendPlanner` (src/hooks/useBlendPlanner.js).
`App.jsx` spreads everything to `AppShell` which routes to children.

### State slices

| State | Type | Default | Purpose |
|-------|------|---------|---------|
| `terminalId` | string | `"fort-worth"` | active terminal |
| `startDate` | string | `TODAY` (ISO date) | grid start anchor (independent, not derived from receipts) |
| `openingInventory` | `[{tankId, pumpable, rvp}]` | mock data | tank opening state |
| `receipts` | `PipelineReceipt[]` | mock T4 data | pipeline schedule |
| `manualInputs` | `{ [tankId-date-slot]: { blendActive, idle } }` | `{}` | blend/idle toggles |
| `planDays` | number | 8 | grid horizon |
| `liftings` | `[{tankId, date, timeSlot, volume}]` | from curve | rack demand per tank |
| `receiptAllocations` | `{ [batchCode-date-slot-tankId]: volume }` | `{}` | per-tank receipt overrides |
| `rackTankAssignments` | `{ [product-date-slot]: { primary, handoff, handoffVolume } }` | `{}` | which tanks rack per period |
| `parsedReceipts` | `PipelineReceipt[] \| null` | `null` | staging area for T4 parse before confirm |
| `rvpValues` | `{ [batchCode]: number }` | `{}` | RVP entered in T4PasteInput before confirm |
| `rvpConfirmed` | `{ [batchCode]: boolean }` | `{}` | which batches have RVP confirmed |
| `startSlot` | `string \| null` | `null` | when set, skips slots before this value on day 1 (e.g. `"06-11"`) |
| `specCeiling` | `number` | `9.0` | RVP spec ceiling — blend is suppressed if `rvpActual >= specCeiling` |
| `blendTarget` | `number` | `8.75` | target RVP for butane demand calculation |

### Derived (useMemo)
- `terminalConfig` — lookup from `TERMINAL_CONFIGS[terminalId]`
- `grid` — full `TimePeriod[]` from `buildPlanGrid`

### Actions exposed
- `setTerminalId`, `setStartDate`, `setOpeningInventory`, `setReceipts`, `setPlanDays`
- `setStartSlot` — filters first-day columns to start at the chosen time slot
- `setSpecCeiling`, `setBlendTarget` — update RVP thresholds; reflected live in the grid
- `setLiftings`, `resetLiftings` — reset rebuilds from curve + clears `rackTankAssignments`
- `toggleBlend(tankId, date, timeSlot)` — flips `blendActive` in manualInputs
- `toggleIdle(tankId, date, timeSlot)` — flips `idle` in manualInputs (also clears blendActive)
- `setReceiptAllocation(batchCode, date, timeSlot, tankId, volume)`
- `setRackTank(product, date, timeSlot, primary, handoff?, handoffVolume?)` — sets primary/handoff rack tanks for a period
- `setParsedReceipts`, `setRvpValues`, `setRvpConfirmed`

### Rack tank assignment model
`rackTankAssignments` stores `{ primary: tankId, handoff: tankId|null, handoffVolume: number }` per `product-date-slot`.

- **primary** gets `totalLifting − handoffVolume` (the majority of liftings)
- **handoff** gets `handoffVolume` (optional split at tank changeover)
- Manual assignment takes precedence; auto-selection carries forward the current rack tank until it goes below heel or starts blending, then rolls to the highest-volume available tank
- `resetLiftings()` clears both `liftings` (rebuilds from curve) and `rackTankAssignments`

### Receipt allocation override precedence
1. `receiptAllocations` — explicit per-tank batch volume → used if any tank in the product has a keyed value
2. Carry-forward: keep assigning to the same receipt tank as previous period, validating it's not blending/idle and has space
3. Fallback to `lastRackedTank`, then highest-space non-blending tank

---

## UI Architecture

### Layout

Header contains: BLEND PLANNER wordmark · terminal picker · "Week of" date input · tab bar (PLAN / RECEIPTS / LIFTINGS / SUMMARY / GUIDE) · start-slot selector · day-count pills (3d/5d/8d).

```
┌── 48px header ──────────────────────────────────────────────────────────────────┐
│ BLEND PLANNER  [Fort Worth ▾]  Week of [date]  [PLAN][RECEIPTS][LIFTINGS]...   │
└─────────────────────────────────────────────────────────────────────────────────┘

PLAN tab:
┌── 300px sidebar ──────────┐  ┌── flex-1 main (scrollable) ──────────────────────┐
│ ▲ OPENING INVENTORY       │  │  REGULAR                                         │
│   OpeningInventoryForm    │  │  [table: tanks × periods]                        │
│   (+ specCeiling,         │  │                                                  │
│    blendTarget inputs)    │  │  ─────── PREMIUM ────────                        │
└───────────────────────────┘  │  [table: tanks × periods]                        │
                               │                                                  │
                               │  ▼ Blend Plan Summary (collapsible)              │
                               └──────────────────────────────────────────────────┘

RECEIPTS tab  → T4PasteInput (full screen)
LIFTINGS tab  → LiftingsInput (full screen)
SUMMARY tab   → BlendPlanSummary (full screen)
GUIDE tab     → GuideTab (full screen)
```

### Grid cell layout (TankRow.jsx)
```
┌──────────────────────────┐
│ [STATUS BADGE]           │  ← 9px mono, clickable (toggles blendActive)
│ ┌──┐                     │
│ │██│ ← VerticalTankGauge │  ← 16×48px; cell click opens AllocationPanel
│ └──┘                     │
│ 38,200 bbl               │  ← closingInventory, 11px font-mono
│ RVP 8.90                 │  ← blue (#60a5fa), 10px font-mono
│ OFFLINE                  │  ← 8px red, only if blendActive
│ ↑4,250  ↓660             │  ← ↑ receipts, ↓ liftings, 9px, only if non-zero
└──────────────────────────┘
```

### VerticalTankGauge (InventoryBar.jsx)
Fill color priority:
1. `fillPct > 0.95` → `#f59e0b` amber (near full)
2. `fillPct < 0.15` → `#ef4444` red (near heel)
3. BLEND → `#ef4444` at 60% opacity
4. RACK → `#378ADD` blue
5. RECEIPT → `#f59e0b` amber
6. IDLE → `#475569` slate

Used in three places:
- `TankRow` row header: 8×36px, showing opening fill %
- `TankRow` cells: 16×48px, showing closing fill %
- `OpeningInventoryForm`: 6×20px, next to tank label

### Status badge colors
| Status | Background | Text |
|--------|-----------|------|
| BLEND | `#ef4444` | `#ffffff` |
| RACK | `#166534` | `#dcfce7` |
| RECEIPT | `#92400e` | `#fef3c7` |
| IDLE | `#1e293b` | `#64748b` |

BLEND cells additionally get: `backgroundColor: #1a0a0a`, `borderLeft: 3px solid #ef4444`, inventory text `#fca5a5`.

---

## Color Palette

```js
pageBg:    '#0a0c12'   // outer page background
headerBg:  '#0f1117'   // header + sidebar
panel:     '#111827'   // grid cells, cards
border:    '#1e293b'   // default border (0.5px)
borderDay: '#2a2d3a'   // day-separator border (1px)
text:      '#f1f5f9'   // primary text
secondary: '#64748b'   // labels, muted text
muted:     '#334155'   // very muted text
amber:     '#f59e0b'   // accent, RECEIPT badge, section headers
blue:      '#60a5fa'   // RVP values, RACK gauge fill
red:       '#ef4444'   // BLEND badge, warnings
green:     '#22c55e'   // ok status (not heavily used in new palette)
```

---

## Liftings Curve

`buildLiftingsGridWithBase(terminalConfig, startDate, planDays, dailyBase)` (used in `useBlendPlanner` with `DEFAULT_DAILY_BASE`) distributes daily demand evenly. `buildLiftingsGrid()` is a convenience wrapper that calls it with the hardcoded `DAILY_BASE`.
across all tanks of each product for the plan window. Initial distribution is a placeholder.
Fine-grained control is via `AllocationPanel` → `liftingAllocations`.

`LiftingsInput` shows **product-level totals** (sum across tanks for display). Editing a cell
redistributes the new total evenly across that product's tanks. AllocationPanel overrides
take precedence in `inventoryCalc`.

---

## T4 Parser

`parseT4(rawText, terminalConfig)` — tab-separated, minimum 14 columns per line.

| Col index | Field |
|-----------|-------|
| 0 | Start datetime |
| 3 | Pipeline line (FM1, FM6) |
| 5 | Batch code |
| 7 | Supplier |
| 11 | Volume (strip commas) |
| 13 | Rate bbls/hr (strip commas) |

Grade = `batchCode.split('-')[2]`. Product = lookup via `terminalConfig.gradeMap`.
Lines with unknown grades are silently dropped.

`rvp` is always `null` after parse — user must enter RVP in `T4PasteInput` before confirming.
The "Confirm & Apply" button is disabled until all RVPs are entered.

---

## OpeningInventoryForm

Displays pumpable in **thousands** (`38500` → shows `38.5`). Stores full bbls internally.
Conversion: `toK(v) = (v/1000).toFixed(1)` / `fromK(s) = round(parseFloat(s) * 1000)`.
Grouped under REGULAR / PREMIUM sub-headers (9px amber). No product badge column.

---

## Google Sheets Integration

`src/data/googleSheets.js` — browser-side Google Sheets append via service account JWT (no backend).

- `SHEET_ID` = `'1siJmeWuFgVCOxK2acali-_wzY8QSJm20OLxJbP3-dfc'`
- Credentials are pasted by the operator at runtime and stored in `sessionStorage` only (key: `blend_planner_gcreds`). Never bundled or committed.
- JWT signing uses `SubtleCrypto.sign` (RSASSA-PKCS1-v1_5 / SHA-256) — no npm packages.
- `savePlanToSheet()` appends to two tabs: **Blend History** (one row per blend) and **Weekly Snapshots** (one row for the week).
- `SavePlanButton` in `BlendPlanSummary` exposes a 2-step modal: paste creds → add notes → confirm save.

TODO (IT): replace runtime credential paste with a backend auth endpoint.

---

## Files That Are Stubs (do not use in logic yet)

- `src/data/blendLogic.js` — `evaluateBlendSignal()` always returns `{ signal: false, reason: null }`. Do not add rules not in Kelly's spec.
- `src/config/terminal-schema.js` — documentation only
- `src/hooks/useTerminalConfig.js` — not wired
- `src/components/blendplanner/BlendToggle.jsx` — stub
- `src/components/blendplanner/DayColumn.jsx` — stub
- `src/components/blendplanner/ProductSection.jsx` — stub
- `src/components/blendplanner/RVPDisplay.jsx` — stub
- `src/components/datainput/TMSLiftingsInput.jsx` — stub
- `src/components/shared/StatusBadge.jsx` — stub

---

## Open TODOs (need Kelly or IT input)

| Location | TODO |
|----------|------|
| `inventoryCalc.js:63` | Receipt carry-forward default allocation — Kelly to define tank priority rules for receipt assignment |
| `parseT4.js:52` | `rvp: null` — wire to pipeline RVP data source (Explorer API or EDI) |
| `blendLogic.js` | Entire blend signal rule set — Kelly spec not yet finalised |
| `liftingsCurve.js` | Daily base totals (−13,200 regular / −3,800 premium) are estimates — validate against TMS actuals |
| `butaneCalc.js` | Truck size (190 bbl) and butane RVP (52) are constants — confirm with Kelly if these vary by season/supplier |
| `AllocationPanel.jsx:234` | Unallocated receipt warning fires at >0.5 bbl — confirm rounding tolerance |
| `tampa.json` | All tank arrays are empty — terminal config needs to be populated when Tampa is onboarded |

---

## Rules for AI Assistance

- **Never** rewrite `buildPlanGrid`, `calcClosingRVP`, `calcButaneDemand`, or `distributeReceipts` without explicit instruction — these match verified Excel formulas.
- **Never** touch `blendLogic.js` rules until Kelly's spec is documented.
- **Never** change `fort-worth.json` tank `safeFill` or `heel` values without quoting a source — these came from Kelly's spec.
- The `bottoms` field was intentionally removed from tank config. Do not re-add it.
- `status` on TimePeriod is **derived only** — never add a way to manually set it.
- `openingInventory` stores full bbls internally. Only `OpeningInventoryForm` converts to/from thousands for display. Do not change this in any other component.
- All dates use UTC (`T00:00:00Z` suffix) to avoid timezone drift across the planning window.
- `rackLoadings` is negative for outbound volume. Liftings are always negative numbers.
- The `liftings` array (from `buildLiftingsGrid`) provides the baseline volume per tank/period. `rackTankAssignments` controls which tank(s) rack and handles the primary/handoff split. Do not merge them into one structure.
- `recharts` is listed in `package.json` but not yet used. Do not remove it without checking with Michael — it may be planned for a future chart view.
- `font-mono` Tailwind class is used for all numeric displays. Do not replace with inline `fontFamily: 'monospace'` except where Tailwind classes are unavailable (SVG, etc).
