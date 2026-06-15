// Credentials entered at runtime via paste — never bundled or
// committed. TODO: IT — replace with backend auth endpoint.

import { useState } from 'react';
import { savePlanToSheet, setGoogleCredentials, hasGoogleCredentials } from '../../data/googleSheets';

const C = {
  bg: '#0a0c12', panel: '#111827', border: '#1e293b',
  text: '#f1f5f9', muted: '#64748b', amber: '#f59e0b',
  green: '#22c55e', red: '#ef4444',
};

const SESSION_KEY = 'blend_planner_gcreds';

// Restore from sessionStorage on first render if available
function restoreCredsFromSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.client_email && parsed?.private_key) {
        setGoogleCredentials(parsed);
        return true;
      }
    }
  } catch { /* ignore */ }
  return false;
}
restoreCredsFromSession();

export default function SavePlanButton({
  blends, terminalConfig, openingInventory, liftings, startDate,
}) {
  const [showModal,   setShowModal]   = useState(false);
  const [step,        setStep]        = useState('notes'); // 'creds' | 'notes'
  const [credsInput,  setCredsInput]  = useState('');
  const [credsError,  setCredsError]  = useState('');
  const [notes,       setNotes]       = useState('');
  const [status,      setStatus]      = useState(null); // null | 'saving' | 'ok' | 'error'
  const [message,     setMessage]     = useState('');

  function openModal() {
    // If no credentials loaded (module-level _creds is null), show creds step first
    setStep(hasGoogleCredentials() ? 'notes' : 'creds');
    setCredsInput('');
    setCredsError('');
    setStatus(null);
    setMessage('');
    setShowModal(true);
  }

  function handleCredsSubmit() {
    setCredsError('');
    try {
      const parsed = JSON.parse(credsInput.trim());
      if (!parsed.client_email || !parsed.private_key) {
        setCredsError('JSON must contain client_email and private_key');
        return;
      }
      setGoogleCredentials(parsed);
      try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(parsed)); } catch { /* ignore */ }
      setStep('notes');
    } catch {
      setCredsError('Invalid JSON — paste the full service account key file');
    }
  }

  async function handleConfirm() {
    setStatus('saving');
    setMessage('');
    const result = await savePlanToSheet({
      terminalConfig, openingInventory, blends,
      liftings, startDate, notes,
    });

    if (result.success) {
      setStatus('ok');
      setMessage(`✓ Saved — ${result.rowsAdded} blend rows added`);
      setTimeout(() => {
        setStatus(null);
        setMessage('');
        setShowModal(false);
        setNotes('');
      }, 4000);
    } else {
      setStatus('error');
      setMessage(result.error ?? 'Unknown error');
      // If creds failed, drop them so next open re-prompts
      if (result.error === 'No credentials loaded') setStep('creds');
    }
  }

  function handleCancel() {
    if (status === 'saving') return;
    setShowModal(false);
    setStatus(null);
    setMessage('');
    setNotes('');
  }

  return (
    <>
      <button
        onClick={openModal}
        style={{
          padding: '6px 16px', fontSize: '12px', fontWeight: 'bold',
          backgroundColor: C.amber, color: '#000',
          border: 'none', borderRadius: '4px', cursor: 'pointer',
        }}
      >
        Save Plan to History
      </button>

      {showModal && (
        <div
          style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
          }}
          onClick={e => { if (e.target === e.currentTarget) handleCancel(); }}
        >
          <div style={{
            backgroundColor: C.panel, border: `1px solid ${C.border}`,
            borderRadius: '8px', padding: '20px', width: '460px',
            display: 'flex', flexDirection: 'column', gap: '14px',
          }}>

            {/* ── Step 1: credentials ── */}
            {step === 'creds' && (
              <>
                <div style={{ fontSize: '13px', fontWeight: 'bold', color: C.text }}>
                  Paste service account credentials JSON
                </div>
                <div style={{ fontSize: '11px', color: C.muted }}>
                  Paste service account credentials JSON to enable saving. Stored in
                  sessionStorage only — never bundled or committed.
                </div>
                <textarea
                  value={credsInput}
                  onChange={e => setCredsInput(e.target.value)}
                  placeholder='{ "type": "service_account", "client_email": "...", "private_key": "..." }'
                  rows={8}
                  spellCheck={false}
                  style={{
                    width: '100%', resize: 'vertical', fontSize: '11px',
                    backgroundColor: C.bg, color: C.text,
                    border: `1px solid ${credsError ? C.red : C.border}`,
                    borderRadius: '4px', padding: '6px 8px',
                    boxSizing: 'border-box', fontFamily: 'monospace',
                  }}
                />
                {credsError && (
                  <div style={{ fontSize: '11px', color: C.red }}>{credsError}</div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button onClick={handleCancel} style={{ padding: '5px 14px', fontSize: '12px', backgroundColor: C.bg, color: C.muted, border: `1px solid ${C.border}`, borderRadius: '4px', cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button
                    onClick={handleCredsSubmit}
                    disabled={!credsInput.trim()}
                    style={{ padding: '5px 14px', fontSize: '12px', fontWeight: 'bold', backgroundColor: C.amber, color: '#000', border: 'none', borderRadius: '4px', cursor: credsInput.trim() ? 'pointer' : 'not-allowed', opacity: credsInput.trim() ? 1 : 0.5 }}
                  >
                    Load Credentials
                  </button>
                </div>
              </>
            )}

            {/* ── Step 2: notes + confirm ── */}
            {step === 'notes' && (
              <>
                <div style={{ fontSize: '13px', fontWeight: 'bold', color: C.text }}>
                  Save Plan to History
                </div>

                <div>
                  <div style={{ fontSize: '10px', color: C.muted, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Notes (optional)
                  </div>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Notes for this week's plan..."
                    rows={3}
                    style={{
                      width: '100%', resize: 'vertical', fontSize: '12px',
                      backgroundColor: C.bg, color: C.text,
                      border: `1px solid ${C.border}`, borderRadius: '4px',
                      padding: '6px 8px', boxSizing: 'border-box', fontFamily: 'inherit',
                    }}
                  />
                </div>

                <div style={{ fontSize: '10px', color: C.muted }}>
                  <span
                    onClick={() => { setStep('creds'); setCredsInput(''); setCredsError(''); }}
                    style={{ cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Replace credentials
                  </span>
                </div>

                {status === 'saving' && (
                  <div style={{ fontSize: '12px', color: C.muted }}>Saving…</div>
                )}
                {status === 'ok' && (
                  <div style={{ fontSize: '12px', color: C.green, fontWeight: 'bold' }}>{message}</div>
                )}
                {status === 'error' && (
                  <div style={{ fontSize: '11px', color: C.red }}>{message}</div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button
                    onClick={handleCancel}
                    disabled={status === 'saving'}
                    style={{ padding: '5px 14px', fontSize: '12px', backgroundColor: C.bg, color: C.muted, border: `1px solid ${C.border}`, borderRadius: '4px', cursor: status === 'saving' ? 'not-allowed' : 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={status === 'saving' || status === 'ok'}
                    style={{ padding: '5px 14px', fontSize: '12px', fontWeight: 'bold', backgroundColor: C.green, color: '#000', border: 'none', borderRadius: '4px', cursor: (status === 'saving' || status === 'ok') ? 'not-allowed' : 'pointer', opacity: status === 'saving' ? 0.7 : 1 }}
                  >
                    {status === 'saving' ? 'Saving…' : 'Confirm Save'}
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </>
  );
}
