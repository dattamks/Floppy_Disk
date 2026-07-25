import React from 'react';
import { theme } from '../lib/theme';
import { hov } from '../lib/ui';

// Extracted from AppShell; renders when V.isTrashView is set.
export default function TrashScreen(V) {
  return V.isTrashView ? (
    <React.Fragment>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: theme.warnBg,
          border: `1px solid ${theme.warnBorder}`,
          borderRadius: '11px',
          padding: '11px 15px',
        }}
      >
        <span style={{ fontSize: '12.5px', color: theme.warnDark, flex: '1' }}>
          Files are kept for <strong>7 days</strong> on Free — upgrade for 30‑day retention.
        </span>
        <button
          onClick={V.emptyTrash}
          style={{
            flex: '0 0 auto',
            background: theme.white,
            border: `1px solid ${theme.dangerBorder}`,
            color: theme.danger,
            borderRadius: '8px',
            padding: '6px 12px',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
            fontFamily: "'IBM Plex Sans',sans-serif",
          }}
        >
          Empty trash
        </button>
      </div>
    </React.Fragment>
  ) : null;
}
