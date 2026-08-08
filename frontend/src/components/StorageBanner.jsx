import React from 'react';
import { theme } from '../lib/theme';

// Persistent, dismissible nudge shown to the Owner while files are on local
// (ephemeral) storage. Reads from V.storage.
export default function StorageBanner(V) {
  const S = V.storage || {};
  if (!S.showBanner) return null;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: theme.warnBg,
        borderBottom: `1px solid ${theme.warnBorder}`,
        padding: '9px 16px',
        fontSize: '12.5px',
        color: theme.warnDark,
        zIndex: 20,
      }}
      data-testid="storage-banner"
    >
      <span style={{ flex: 1 }}>
        <strong>Files are on this server’s disk</strong> - they’ll be lost if the server is
        replaced. Connect Cloudflare R2 to keep them safe.
      </span>
      <button
        onClick={S.openStorageSettings}
        style={{
          background: theme.warnDark,
          color: theme.onAccent,
          border: 'none',
          borderRadius: '7px',
          padding: '6px 12px',
          fontSize: '12px',
          fontWeight: '600',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
        data-testid="banner-connect"
      >
        Connect R2
      </button>
      <button
        onClick={S.dismissBanner}
        aria-label="Dismiss"
        style={{
          background: 'none',
          border: 'none',
          color: theme.warnDark,
          cursor: 'pointer',
          fontSize: '15px',
          lineHeight: 1,
        }}
      >
        ✕
      </button>
    </div>
  );
}
