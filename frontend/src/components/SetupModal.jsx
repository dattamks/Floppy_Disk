import React from 'react';
import { theme } from '../lib/theme';

// First-run storage choice, shown once to the Owner right after their first
// sign-in. Skippable. Reads from V.storage.setup.
export default function SetupModal(V) {
  const S = V.storage || {};
  if (!S.setupOpen) return null;

  const card = (selected) => ({
    flex: 1,
    textAlign: 'left',
    border: `1px solid ${selected ? theme.brand : theme.border}`,
    boxShadow: selected ? `0 0 0 3px ${theme.brandBgSoft}` : 'none',
    borderRadius: '12px',
    padding: '15px',
    background: theme.white,
    cursor: 'pointer',
  });

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'rgba(20,23,28,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '18px',
      }}
      data-testid="setup-modal"
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          background: theme.appBg,
          borderRadius: '16px',
          padding: '22px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          fontFamily: "'IBM Plex Sans',sans-serif",
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span
              style={{
                fontFamily: "'Space Grotesk',sans-serif",
                fontWeight: 600,
                fontSize: '18px',
              }}
            >
              Where should your files live?
            </span>
            <span style={{ fontSize: '13px', color: theme.textMuted }}>
              You can change this any time in Settings → Storage. It’s the only setup question.
            </span>
          </div>
          <button
            onClick={S.skipSetup}
            aria-label="Close"
            title="Close (keep local storage for now)"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: theme.textMuted2,
              padding: '2px',
              lineHeight: 1,
              flex: '0 0 auto',
            }}
            data-testid="setup-close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M5 5l14 14M19 5L5 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div style={{ display: 'flex', gap: '11px' }}>
          <button
            onClick={S.chooseLocal}
            style={card(S.setupChoice === 'local')}
            data-round
            data-testid="setup-local"
          >
            <div style={{ fontSize: '20px', marginBottom: '8px' }}>🖥️</div>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>This server’s disk</div>
            <div style={{ fontSize: '12px', color: theme.textMuted, marginTop: '3px' }}>
              Simplest. Files last only as long as the server’s storage does.
            </div>
          </button>
          <button
            onClick={S.chooseR2}
            style={card(S.setupChoice === 'r2')}
            data-round
            data-testid="setup-r2"
          >
            <div style={{ fontSize: '20px', marginBottom: '8px' }}>☁️</div>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>Cloudflare R2</div>
            <div style={{ fontSize: '12px', color: theme.textMuted, marginTop: '3px' }}>
              Recommended. Durable cloud storage, independent of this server.
            </div>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={S.skipSetup}
            style={{
              background: 'none',
              border: 'none',
              color: theme.textMuted,
              fontSize: '12.5px',
              cursor: 'pointer',
            }}
            data-testid="setup-skip"
          >
            Decide later - use local for now
          </button>
        </div>
      </div>
    </div>
  );
}
