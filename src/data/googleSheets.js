// Credentials entered at runtime via paste — never bundled or
// committed. TODO: IT — replace with backend auth endpoint.
//
// Uses browser-native SubtleCrypto for JWT signing; no npm packages needed.

const SHEET_ID = '1siJmeWuFgVCOxK2acali-_wzY8QSJm20OLxJbP3-dfc';

let _creds = null;
export function setGoogleCredentials(creds) { _creds = creds; }
export function hasGoogleCredentials() { return _creds !== null; }

async function getAccessToken(clientEmail, privateKeyPem) {
  const now = Math.floor(Date.now() / 1000);
  const header  = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    iss:   clientEmail,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud:   'https://oauth2.googleapis.com/token',
    exp:   now + 3600,
    iat:   now,
  }));
  const signingInput = `${header}.${payload}`;

  const pemBody = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\n/g, '');
  const binaryKey = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', binaryKey.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', cryptoKey,
    new TextEncoder().encode(signingInput)
  );
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  const jwt = `${signingInput}.${sigB64}`;

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const data = await resp.json();
  return data.access_token;
}

async function appendRows(accessToken, tabName, rows) {
  const range = `${tabName}!A1`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: rows }),
  });
  if (!resp.ok) throw new Error(await resp.text());
  return resp.json();
}

export async function savePlanToSheet({
  terminalConfig, openingInventory, blends,
  liftings, startDate, notes,
}) {
  if (!_creds) return { success: false, error: 'No credentials loaded' };

  try {
    const token   = await getAccessToken(_creds.client_email, _creds.private_key);
    const savedAt = new Date().toISOString();
    const terminal = terminalConfig.name;

    // Tab 1: Blend History — one row per blend
    const blendRows = blends.map(b => [
      savedAt, terminal, startDate,
      b.blendNumber, b.tankLabel,
      b.startDate, b.startTime, b.endDate, b.endTime,
      b.periods,
      b.estPumpable  ?? '', b.estTOV    ?? '',
      b.rvpActual    ?? '', b.rvpTarget ?? '',
      b.butane_bbls  != null ? Math.round(b.butane_bbls) : '',
      b.trucks       ?? '',
      b.blendedRVP   != null ? b.blendedRVP.toFixed(2) : '',
      notes,
    ]);

    // Tab 2: Weekly Snapshots — one row
    const totalButane = blends.reduce((s, b) => s + (b.actualButane ?? 0), 0);
    const totalTrucks = blends.reduce((s, b) => s + (b.trucks       ?? 0), 0);
    const regOpening  = openingInventory
      .filter(t => terminalConfig.products.regular?.tanks.some(tk => tk.id === t.tankId))
      .reduce((s, t) => s + t.pumpable, 0);
    const premOpening = openingInventory
      .filter(t => terminalConfig.products.premium?.tanks.some(tk => tk.id === t.tankId))
      .reduce((s, t) => s + t.pumpable, 0);
    const regLifting  = liftings
      .filter(l => terminalConfig.products.regular?.tanks.some(t => t.id === l.tankId))
      .reduce((s, l) => s + Math.abs(l.volume), 0);
    const premLifting = liftings
      .filter(l => terminalConfig.products.premium?.tanks.some(t => t.id === l.tankId))
      .reduce((s, l) => s + Math.abs(l.volume), 0);

    const snapshotRow = [[
      savedAt, terminal, startDate,
      blends.length,
      Math.round(totalButane), totalTrucks,
      Math.round(regOpening), Math.round(premOpening),
      Math.round(regLifting), Math.round(premLifting),
      notes,
    ]];

    await appendRows(token, 'Blend History', blendRows);
    await appendRows(token, 'Weekly Snapshots', snapshotRow);

    return { success: true, rowsAdded: blendRows.length + 1 };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
