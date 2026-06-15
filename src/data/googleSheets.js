// TODO: IT — move credentials to backend before production deployment
//
// Uses browser-native SubtleCrypto for JWT signing instead of the
// googleapis keyFile approach, which requires Node.js fs and won't
// bundle in Vite. Functionally identical: service account JWT → token
// exchange → Sheets REST API append.

import credentialsRaw from '../config/google-credentials.json';

const SHEET_ID = '1siJmeWuFgVCOxK2acali-_wzY8QSJm20OLxJbP3-dfc';
const SCOPES   = ['https://www.googleapis.com/auth/spreadsheets'];

function pemToArrayBuffer(pem) {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const binary = atob(b64);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf.buffer;
}

function base64url(input) {
  const str = typeof input === 'string'
    ? btoa(unescape(encodeURIComponent(input)))
    : btoa(String.fromCharCode(...new Uint8Array(input)));
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function getAccessToken() {
  const now     = Math.floor(Date.now() / 1000);
  const header  = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss:   credentialsRaw.client_email,
    scope: SCOPES.join(' '),
    aud:   'https://oauth2.googleapis.com/token',
    exp:   now + 3600,
    iat:   now,
  };

  const toSign = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(credentialsRaw.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', key,
    new TextEncoder().encode(toSign)
  );
  const jwt = `${toSign}.${base64url(sigBuf)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion:  jwt,
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(data.error_description ?? 'Token exchange failed');
  return data.access_token;
}

async function appendRows(token, range, values) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values }),
  });
  if (!res.ok) throw new Error(`Sheets API ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function savePlanToSheet({
  terminalConfig, openingInventory, blends,
  liftings, startDate, notes,
}) {
  try {
    const token    = await getAccessToken();
    const savedAt  = new Date().toISOString();
    const terminal = terminalConfig?.name ?? '';

    let rowsAdded = 0;

    // ── Tab 1: Blend History — one row per blend ─────────────────
    if (blends.length > 0) {
      const blendRows = blends.map(b => [
        savedAt, terminal, startDate,
        b.blendNumber, b.tankLabel,
        b.startDate, b.startTime, b.endDate, b.endTime,
        b.periods,
        b.estPumpable  != null ? Math.round(b.estPumpable)   : '',
        b.estTOV       != null ? Math.round(b.estTOV)        : '',
        b.rvpActual    != null ? b.rvpActual.toFixed(2)       : '',
        8.75,
        b.butane_bbls  != null ? Math.round(b.butane_bbls)   : '',
        b.trucks       ?? '',
        b.blendedRVP   != null ? b.blendedRVP.toFixed(2)     : '',
        notes ?? '',
      ]);
      await appendRows(token, 'Blend History!A:R', blendRows);
      rowsAdded += blendRows.length;
    }

    // ── Tab 2: Weekly Snapshots — one row for the week ───────────
    const regTanks  = new Set((terminalConfig?.products?.regular?.tanks  ?? []).map(t => t.id));
    const premTanks = new Set((terminalConfig?.products?.premium?.tanks  ?? []).map(t => t.id));

    const regOpeningInv  = openingInventory.filter(t => regTanks.has(t.tankId)).reduce((s, t) => s + (t.pumpable ?? 0), 0);
    const premOpeningInv = openingInventory.filter(t => premTanks.has(t.tankId)).reduce((s, t) => s + (t.pumpable ?? 0), 0);

    const liftTotals = { regular: 0, premium: 0 };
    for (const l of liftings) {
      if (regTanks.has(l.tankId))  liftTotals.regular  += Math.abs(l.volume);
      if (premTanks.has(l.tankId)) liftTotals.premium  += Math.abs(l.volume);
    }

    const totalButane = blends.reduce((s, b) => s + (b.actualButane ?? 0), 0);
    const totalTrucks = blends.reduce((s, b) => s + (b.trucks       ?? 0), 0);

    await appendRows(token, 'Weekly Snapshots!A:K', [[
      savedAt, terminal, startDate,
      blends.length, totalButane, totalTrucks,
      regOpeningInv, premOpeningInv,
      Math.round(liftTotals.regular),
      Math.round(liftTotals.premium),
      notes ?? '',
    ]]);
    rowsAdded += 1;

    return { success: true, rowsAdded };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
