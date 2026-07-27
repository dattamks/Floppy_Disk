import React from 'react';
import { theme } from '../lib/theme';

// Manage the share links you've created: copy or revoke. Renders when
// V.isLinksModal is set; data comes from V.linksView.
export default function LinksModal(V) {
  return V.isLinksModal ? (
    <React.Fragment>
      {' '}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
        }}
      >
        <span
          style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: '600', fontSize: '16px' }}
        >
          Share links
        </span>
        <button
          onClick={V.closeModal}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted2 }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 5l14 14M19 5L5 19"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>{' '}
      {V.linksLoading ? (
        <div style={{ padding: '30px', textAlign: 'center', color: theme.textMuted }}>Loading…</div>
      ) : V.linksEmpty ? (
        <div
          style={{
            padding: '34px 20px',
            textAlign: 'center',
            color: theme.textMuted,
            border: `1px dashed ${theme.border}`,
            borderRadius: '11px',
          }}
        >
          No active share links yet. Use “Share link” on a file to create one.
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            maxHeight: '380px',
            overflowY: 'auto',
          }}
        >
          {V.linksView.map((l) => (
            <div
              key={l.id}
              style={{
                border: `1px solid ${theme.border}`,
                borderRadius: '11px',
                padding: '11px 13px',
                display: 'flex',
                flexDirection: 'column',
                gap: '7px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontWeight: '600',
                    fontSize: '13.5px',
                    flex: '1',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {l.name}
                </span>
                {l.hasPassword ? (
                  <span
                    style={{
                      fontSize: '10.5px',
                      color: theme.brand,
                      background: theme.brandBg,
                      borderRadius: '5px',
                      padding: '1px 6px',
                    }}
                  >
                    Password
                  </span>
                ) : null}
                {l.expiresLabel ? (
                  <span style={{ fontSize: '11px', color: theme.textFaint }}>
                    Expires {l.expiresLabel}
                  </span>
                ) : null}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    flex: '1',
                    fontSize: '11.5px',
                    color: theme.textMuted,
                    fontFamily: "'IBM Plex Mono',monospace",
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {l.url}
                </span>
                <button
                  onClick={l.onCopy}
                  style={{
                    background: theme.surface,
                    border: `1px solid ${theme.border}`,
                    color: theme.text,
                    borderRadius: '8px',
                    padding: '5px 11px',
                    fontSize: '12px',
                    fontWeight: '500',
                    cursor: 'pointer',
                  }}
                >
                  Copy
                </button>
                <button
                  onClick={l.onRevoke}
                  style={{
                    background: theme.dangerBgSoft,
                    border: `1px solid ${theme.dangerBorder2}`,
                    color: theme.danger,
                    borderRadius: '8px',
                    padding: '5px 11px',
                    fontSize: '12px',
                    fontWeight: '500',
                    cursor: 'pointer',
                  }}
                >
                  Revoke
                </button>
              </div>
            </div>
          ))}
        </div>
      )}{' '}
    </React.Fragment>
  ) : null;
}
