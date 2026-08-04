import React from 'react';
import { theme } from '../lib/theme';
import { hov } from '../lib/ui';

// Extracted from AppShell; renders when V.isEmpty is set.
export default function EmptyState(V) {
  return V.isEmpty ? (
    <React.Fragment>
      <div
        style={{
          flex: '1',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '14px',
          color: theme.textFainter,
          padding: '48px 20px',
          textAlign: 'center',
        }}
      >
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
          <path
            d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
            stroke={theme.borderStrong2}
            strokeWidth="1.6"
          />
        </svg>
        <span style={{ fontSize: '14px', fontWeight: '600', color: theme.textMuted }}>
          {V.emptyMessage}
        </span>
        {V.emptyActionable ? (
          <React.Fragment>
            <div style={{ display: 'flex', gap: '10px', marginTop: '2px' }}>
              <button
                onClick={V.openUpload}
                data-round
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px',
                  background: theme.brand,
                  color: theme.white,
                  border: 'none',
                  borderRadius: '10px',
                  padding: '10px 18px',
                  fontSize: '13.5px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontFamily: "'IBM Plex Sans',sans-serif",
                }}
                {...hov({ background: theme.brandDark })}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 16V4M7 9l5-5 5 5M4 20h16"
                    stroke={theme.white}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Add files
              </button>
              <button
                onClick={V.openNewFolder}
                data-round
                style={{
                  background: theme.white,
                  color: theme.text,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '10px',
                  padding: '10px 18px',
                  fontSize: '13.5px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontFamily: "'IBM Plex Sans',sans-serif",
                }}
                {...hov({ background: theme.surface })}
              >
                Add folder
              </button>
            </div>
            <span style={{ fontSize: '12px', color: theme.textFainter }}>
              or drag files anywhere to upload
            </span>
          </React.Fragment>
        ) : null}
      </div>
    </React.Fragment>
  ) : null;
}
