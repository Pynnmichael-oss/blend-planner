const C = {
  bg:        '#FFFFFF',
  panel:     '#EEF3F6',
  border:    'rgba(0,79,113,.13)',
  text:      '#063A52',
  muted:     '#5E7A8A',
  secondary: '#5E7A8A',
  amber:     '#00B398',
  blue:      '#004F71',
  red:       '#D9655B',
  green:     '#0a7e62',
};

function Section({ title, children }) {
  return (
    <section style={{ marginBottom: '40px' }}>
      <h2 style={{
        fontFamily: "'Montserrat',sans-serif", fontSize: '11px', fontWeight: 700,
        color: '#004F71', textTransform: 'uppercase', letterSpacing: '1.4px',
        marginBottom: '14px', paddingBottom: '8px',
        borderBottom: `1px solid ${C.border}`,
      }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function P({ children, style }) {
  return (
    <p style={{
      fontSize: '13px', lineHeight: '1.75', color: C.secondary,
      marginBottom: '12px', maxWidth: '680px', ...style,
    }}>
      {children}
    </p>
  );
}

function Step({ n, label, children }) {
  return (
    <div style={{ display: 'flex', gap: '14px', marginBottom: '16px' }}>
      <div style={{
        flexShrink: 0, width: '22px', height: '22px',
        borderRadius: '50%', backgroundColor: '#EEF3F6',
        border: '1px solid #00B398', color: '#00B398',
        fontSize: '11px', fontWeight: 600, fontFamily: "'Montserrat',sans-serif",
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginTop: '2px',
      }}>
        {n}
      </div>
      <div>
        <div style={{ fontSize: '12px', fontWeight: 600, color: C.text, marginBottom: '4px', fontFamily: "'Montserrat',sans-serif" }}>{label}</div>
        <P style={{ marginBottom: 0 }}>{children}</P>
      </div>
    </div>
  );
}

function Badge({ label, bg, color }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: '5px',
      fontSize: '10px', fontFamily: "'Montserrat',sans-serif", fontWeight: 700,
      backgroundColor: bg, color: color, marginRight: '6px',
    }}>
      {label}
    </span>
  );
}

function StatusRow({ badge, bg, color, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '12px' }}>
      <Badge label={badge} bg={bg} color={color} />
      <P style={{ marginBottom: 0 }}>{children}</P>
    </div>
  );
}

export default function GuideTab() {
  return (
    <div style={{ flex: 1, overflowY: 'auto', backgroundColor: C.bg }}>
      <div style={{ maxWidth: '780px', margin: '0 auto', padding: '36px 28px 60px' }}>

        <div style={{ marginBottom: '36px' }}>
          <div style={{ fontSize: '10px', color: '#00B398', textTransform: 'uppercase', letterSpacing: '1.4px', marginBottom: '8px', fontFamily: "'Montserrat',sans-serif" }}>
            Blend Planner
          </div>
          <h1 style={{ fontFamily: "'Montserrat',sans-serif", fontSize: '20px', color: '#004F71', fontWeight: 800, margin: 0 }}>
            Operator Guide
          </h1>
        </div>

        {/* 1. Overview */}
        <Section title="1 — Overview">
          <P>
            Blend Planner is a terminal inventory tool for projecting tank levels and RVP across a multi-day horizon. Its purpose is to protect quality margin — not just volume. A tank that racks too early bleeds butane before the blend is complete; a tank that sits too long loses the RVP advantage entirely. This tool makes those tradeoffs visible before they become losses.
          </P>
          <P>
            The planning grid shows every tank for every 6-hour window across 3, 5, or 8 days. Each cell reflects what will happen if the pipeline schedule, opening inventory, and rack demand play out as entered. Nothing is automatic — the tool surfaces information; the operator decides.
          </P>
        </Section>

        {/* 2. Workflow */}
        <Section title="2 — Workflow">
          <Step n="1" label="Set opening inventory">
            Enter pumpable barrels and RVP for each tank in the sidebar. These are your starting conditions — get them right first. Values are entered in thousands of barrels. A small gauge next to each tank shows current fill as a percentage of safe fill.
          </Step>
          <Step n="2" label="Paste the T4 schedule">
            Go to the Receipts tab. Copy the pipeline schedule from the Explorer portal and paste it into the text area. Click Parse. The tool extracts batch codes, volumes, rates, grades, and start times. RVP values are pre-filled with grade defaults (EST) — replace them with actual lab values from the morning sheet before applying. After applying receipts, go to the Liftings tab to confirm rack demand for the week. The curve defaults are pre-loaded — adjust any cells where you expect demand to differ from the historical average.
          </Step>
          <Step n="3" label="Enter confirmed RVP values">
            Work down the right panel in the Receipts tab. Amber EST inputs indicate grade defaults. Tab through each row and replace with the lab-confirmed value. Confirmed entries turn blue. When all actuals are entered, click Apply to Plan. You can re-paste and re-apply at any time — the plan recalculates immediately.
          </Step>
          <Step n="4" label="Confirm before reading the grid">
            Liftings drive the RACK status badges and the inventory depletion you see in each cell. If Tank 56 looks like it will run out by Wednesday, check whether your liftings are realistic for that day — the curve defaults are averages and may overstate demand on slower weeks. Adjust the liftings first before changing blend decisions.
          </Step>
          <Step n="5" label="Toggle blend decisions">
            Click any cell to open the Allocation Panel for that tank and period. Toggle blend active to take a tank offline for butane blending. Blend cells are highlighted red and marked OFFLINE. The tank will not rack during a blend period — confirm your other tanks can cover demand before activating.
          </Step>
        </Section>

        {/* 3. Rack Liftings */}
        <Section title="3 — Rack Liftings">
          <Step n="1" label="Understand what liftings are">
            Rack liftings are the barrels leaving your terminal through the rack each 6-hour window. They reduce tank inventory just like pipeline receipts increase it. The tool needs a liftings forecast to project whether your tanks will run low during the plan week.
          </Step>
          <Step n="2" label="Start from the curve">
            Go to the Liftings tab. The table is pre-filled with historical average demand by product, day of week, and time slot. Regular runs roughly 13,200 bbl/day on a normal weekday, distributed across the four windows with the afternoon slot heaviest. Premium runs roughly 3,800 bbl/day. Friday is slightly higher, Saturday and Sunday lower. Click "Reset to curve defaults" any time to restore these averages.
          </Step>
          <Step n="3" label="Adjust for your week">
            If you know a specific day will be heavier or lighter — a holiday, a large customer pre-buy, a known outage — edit that cell directly. Type the total barrels for that product in that window. The tool splits the total evenly across the tanks for that product automatically. You are entering total product demand, not per-tank volumes.
          </Step>
          <Step n="4" label="Confirm before reading the grid">
            Liftings drive the RACK status badges and the inventory depletion you see in each cell. If Tank 56 looks like it will run out by Wednesday, check whether your liftings are realistic for that day — the curve defaults are averages and may overstate demand on slower weeks. Adjust the liftings first before changing blend decisions.
          </Step>
        </Section>

        {/* 4. Reading the grid */}
        <Section title="4 — Reading the grid">
          <P>
            Each grid cell represents one tank for one 6-hour window. The cell header shows a status badge and a vertical fill gauge. Below it: closing inventory in barrels, closing RVP in blue, and receipt or lifting volumes if non-zero.
          </P>

          <div style={{ marginBottom: '16px' }}>
            <StatusRow badge="IDLE" bg="rgba(0,79,113,.07)" color="#5E7A8A">
              No activity. Tank is neither receiving product nor actively racking. Inventory stays flat minus any minor evaporation (not modelled). Most cells outside peak lifting hours will be IDLE.
            </StatusRow>
            <StatusRow badge="RACK" bg="rgba(0,179,152,.14)" color="#0a7e62">
              Tank is supplying the rack during this window. Inventory decreases by the lifting volume. The fill gauge turns teal. Normal operating state for tanks in the active product pool.
            </StatusRow>
            <StatusRow badge="RECEIPT" bg="rgba(0,79,113,.10)" color="#004F71">
              Pipeline product is arriving and being received. Inventory increases. RVP changes depending on the incoming batch quality versus the current tank blend. The fill gauge turns navy.
            </StatusRow>
            <StatusRow badge="BLEND" bg="rgba(217,101,91,.15)" color="#D9655B">
              Tank is offline for butane blending. It will not supply the rack this period. Inventory increases by butane addition. Fill gauge turns coral. The cell background is tinted red with a left border accent. The word OFFLINE appears below inventory.
            </StatusRow>
          </div>

          <P>
            The vertical gauge in each cell header shows fill percentage at the start of the period (opening fill). The gauge in the cell body shows closing fill. Amber means the tank is approaching safe fill (&gt;95%). Red means the tank is approaching heel (&lt;15%).
          </P>
          <P>
            RVP is displayed in navy below the closing inventory figure. Values in the 7.0–8.5 range are typical for summer blends. A drop below 7.0 may indicate a quality issue with an incoming batch; a value above 9.0 may suggest insufficient blending before racking.
          </P>
        </Section>

        {/* 5. Blend decisions */}
        <Section title="5 — Blend decisions">
          <P>
            The core rule is simple: never rack raw pipeline product. Product arriving from the Explorer pipeline carries whatever RVP the batch was dispatched at — often too high for compliance once it hits the pump. The butane blend brings it to spec before it leaves the terminal.
          </P>
          <P>
            When deciding which tank to blend, rack from the tank with the highest current RVP first. That tank has the most to gain from additional butane. The tank being blended is completely offline to the rack for the duration of the blend period — it cannot supply demand. Make sure the remaining tanks have sufficient inventory to cover demand before toggling blend active.
          </P>
          <P>
            Blend duration depends on butane volume and truck size. The tool calculates the required butane addition automatically based on opening RVP, target RVP, and current tank inventory. Each butane truck is 190 barrels. Any positive butane requirement dispatches at least one truck: below 190 barrels, that single truck carries the exact amount needed (a partial load); at or above 190 barrels, the truck count truncates to whole trucks (never rounds up, to avoid overshooting the RVP spec ceiling).
          </P>
          <P>
            A tank that shows RECEIPT and then immediately BLEND in consecutive periods may indicate a scheduling conflict. The pipeline product arrives, but the tank cannot be blended and racked simultaneously. Plan the blend to begin after the receipt window closes, or split demand across other tanks during the receipt period.
          </P>
        </Section>

        {/* 6. Premium warning */}
        <Section title="6 — Premium warning">
          <P>
            Fort Worth has two premium tanks: TK04 and TK05. Premium demand is lower than regular but the quality tolerance is tighter — premium customers are more sensitive to RVP variance at the pump.
          </P>
          <P>
            Never blend both premium tanks simultaneously. With only two tanks in the premium pool, taking both offline leaves zero supply to the premium rack. Even if demand is low, an unexpected lift during a double-blend window will either pull from an out-of-spec tank or force a supply interruption. The planning horizon is long enough to stagger blends across consecutive days.
          </P>
          <P>
            If the grid shows both premium tanks in BLEND status for the same time window, revise the schedule. Shift one blend period earlier or later until at least one premium tank remains available to rack in every window. The tool does not currently enforce this automatically — it is an operator responsibility.
          </P>
        </Section>

      </div>
    </div>
  );
}
