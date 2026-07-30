import { useState } from 'react';
import { savePlanToSupabase } from '../../data/savePlanToSupabase';

const C = {
  bg: '#0a0c12', panel: '#111827', border: '#1e293b',
  text: '#f1f5f9', muted: '#64748b', amber: '#f59e0b',
  green: '#22c55e', red: '#ef4444',
};

export default function SavePlanButton({
  blends, terminalConfig, startDate, blendTarget,
}) {
  const [showModal, setShowModal] = useState(false);
  const [notes,     setNotes]     = useState('');
  const [status,    setStatus]    = useState(null); // null | 'saving' | 'ok' | 'error'
  const [message,   setMessage]   = useState('');

  function openModal() {
    setStatus(null);
    setMessage('');
    setShowModal(true);
  }

  async function handleConfirm() {
    setStatus('saving');
    setMessage('');
    const result = await savePlanToSupabase({ terminalConfig, blends, startDate, blendTarget, notes });

    if (result.success) {
      setStatus('ok');
      setMessage(`✓ Saved — ${result.rowsAdded} blend row${result.rowsAdded === 1 ? '' : 's'} added to Blend Case Manager`);
      setTimeout(() => {
        setStatus(null);
        setMessage('');
        setShowModal(false);
        setNotes('');
      }, 4000);
    } else {
      setStatus('error');
      setMessage(result.error ?? 'Unknown error');
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
        Save Plan to Blend Case Manager
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
            <div style={{ fontSize: '13px', fontWeight: 'bold', color: C.text }}>
              Save Plan to Blend Case Manager
            </div>
            <div style={{ fontSize: '11px', color: C.muted }}>
              Sends {blends?.length ?? 0} blend row{blends?.length === 1 ? '' : 's'} to the shared
              planner queue. Each will appear on the Blend Case Manager's board as a proposed plan,
              ready to promote to an active case.
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
          </div>
        </div>
      )}
    </>
  );
}
