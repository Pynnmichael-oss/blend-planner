// Replaces the old Google Sheets "Save Plan to History" flow. Inserts each
// computed BlendRow (from detectBlends()) as a row in the same blend_plans
// table that the Blend Case Manager's planner board reads from.
//
// Field mapping, BlendRow -> blend_plans:
//   tankLabel / tankId   -> tank / (tank_no is left null -- see migration
//                           00000000000010; Blend-Planner has no asset tag)
//   product (regular/premium) -> grade (REGULAR/PREMIUM)
//   estPumpable          -> est_pumpable_bbl
//   estTOV               -> est_tov_bbl
//   rvpActual            -> incoming_rvp
//   blendTarget (passed in) -> target_rvp
//   butane_bbls           -> butane_bbl
//   trucks                -> trucks
//   blendedRVP            -> blended_rvp
//   startDate/startTime, endDate/endTime -> window_start / window_end
//   truckStart / truckFinish -> truck_start / truck_finish
import { supabase } from './supabaseClient';

// The Blend Case Manager's valve-alignment checklist (and potentially
// other execution-side features) is keyed by the terminal's physical tank
// asset tag, not by Blend-Planner's short tank id. Blend-Planner's own
// config (fort-worth.json) has no concept of this number, so we maintain
// the mapping here at the point where a plan crosses into the shared
// blend_plans table. TK03 has no known asset tag / valve alignment
// configured on the Case Manager side yet -- left unmapped (null) rather
// than guessed, so it correctly shows "not configured" instead of a wrong
// number silently pointing at someone else's valves.
const TANK_ASSET_TAG = {
  TK55: '23155',
  TK56: '23156',
  TK04: '27404',
  TK05: '27405',
  // TK03: no asset tag known yet -- confirm with terminal ops before adding
};

function tankAssetTagFor(blend) {
  const tag = TANK_ASSET_TAG[blend.tankId];
  if (!tag) {
    console.warn(`[savePlanToSupabase] no physical asset tag mapped for tank id "${blend.tankId}" -- tank_no will be left blank, and execution-side features that key off it (e.g. the valve alignment checklist) will show as not configured.`);
  }
  return tag ?? null;
}

function isoWeek(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

function weekPrefix(year, week) {
  return `PLAN-${year}-W${String(week).padStart(2, '0')}-`;
}

/**
 * Finds the highest existing sequence number already saved for a given
 * ISO year/week (e.g. for prefix 'PLAN-2026-W31-', if 'PLAN-2026-W31-01'
 * and 'PLAN-2026-W31-02' already exist, returns 2). Returns 0 if none
 * exist yet, so the next code starts at -01.
 */
async function highestExistingSeq(prefix) {
  const { data, error } = await supabase
    .from('blend_plans')
    .select('plan_code')
    .like('plan_code', `${prefix}%`);
  if (error) {
    console.warn('[savePlanToSupabase] could not check existing plan codes, starting from 01:', error);
    return 0;
  }
  let max = 0;
  for (const row of data ?? []) {
    const tail = row.plan_code.slice(prefix.length);
    const n = parseInt(tail, 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}

/**
 * Assigns each blend a guaranteed-next plan_code within its ISO week,
 * based on what's already saved in Supabase (not just position within
 * this save batch) -- fixes codes colliding across separate saves in the
 * same week.
 */
async function assignPlanCodes(blends) {
  const nextSeqByPrefix = new Map();
  const codes = [];
  for (const b of blends) {
    const { year, week } = isoWeek(b.startDate);
    const prefix = weekPrefix(year, week);
    if (!nextSeqByPrefix.has(prefix)) {
      nextSeqByPrefix.set(prefix, (await highestExistingSeq(prefix)) + 1);
    }
    const seq = nextSeqByPrefix.get(prefix);
    nextSeqByPrefix.set(prefix, seq + 1);
    codes.push(`${prefix}${String(seq).padStart(2, '0')}`);
  }
  return codes;
}

/**
 * @param {object} params
 * @param {object} params.terminalConfig
 * @param {Array}  params.blends       - BlendRow[] from detectBlends()
 * @param {string} params.startDate
 * @param {number} [params.blendTarget] - target RVP spec (psi), if known
 * @param {string} [params.notes]
 * @returns {Promise<{success:boolean, rowsAdded?:number, error?:string}>}
 */
export async function savePlanToSupabase({ terminalConfig, blends, startDate, blendTarget, notes }) {
  if (!blends?.length) {
    return { success: false, error: 'No blends to save' };
  }

  const planCodes = await assignPlanCodes(blends);

  const rowFor = (b, planCode) => ({
    plan_code: planCode,
    label: `Blend ${b.blendNumber}`,
    grade: (b.product || '').toUpperCase() || 'REGULAR',
    tank: b.tankLabel || b.tankId,
    tank_no: tankAssetTagFor(b),
    window_start: `${b.startDate} ${b.startTime}`,
    window_end: `${b.endDate} ${b.endTime}`,
    est_pumpable_bbl: b.estPumpable ?? 0,
    est_tov_bbl: b.estTOV ?? 0,
    incoming_rvp: b.rvpActual ?? 0,
    target_rvp: blendTarget ?? b.blendedRVP ?? 8.85,
    butane_bbl: b.butane_bbls ?? 0,
    trucks: b.trucks ?? 0,
    blended_rvp: b.blendedRVP ?? 0,
    truck_start: b.truckStart ?? null,
    truck_finish: b.truckFinish ?? null,
    status: 'proposed',
    source_week: startDate,
    assumption: notes?.trim()
      ? notes.trim()
      : `Generated by Blend Planner from ${terminalConfig?.name ?? 'terminal'} inventory + T4 schedule as of ${startDate}.`,
  });

  // Insert one at a time (not a single batch insert) so that if one row
  // hits a plan_code collision -- a genuine race with another save
  // happening at the same moment -- we can bump just that row's sequence
  // and retry, instead of failing the whole batch.
  let rowsAdded = 0;
  for (let i = 0; i < blends.length; i++) {
    let code = planCodes[i];
    let attempt = 0;
    // Reuse the same prefix/seq bump logic on retry.
    const prefix = code.slice(0, code.lastIndexOf('-') + 1);
    let seq = parseInt(code.slice(prefix.length), 10);

    while (attempt < 5) {
      const { error } = await supabase.from('blend_plans').insert(rowFor(blends[i], code));
      if (!error) {
        rowsAdded += 1;
        break;
      }
      const isDuplicate = error.code === '23505' || /duplicate key value/i.test(error.message || '');
      if (!isDuplicate) {
        console.error('[savePlanToSupabase] insert failed:', error);
        return { success: false, error: error.message || 'Unknown Supabase error' };
      }
      // Collision -- bump the sequence and retry with a fresh code.
      seq += 1;
      code = `${prefix}${String(seq).padStart(2, '0')}`;
      attempt += 1;
    }
    if (attempt >= 5) {
      return { success: false, error: `Could not find a free plan code after 5 attempts near ${prefix}${String(seq).padStart(2, '0')}` };
    }
  }

  return { success: true, rowsAdded };
}
