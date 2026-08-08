import React from 'react';
import { theme } from '../lib/theme';

// Dismissible warning shown to everyone (storage is shared) when the pool is
// nearly full (>=90%) or already over the R2 budget cap. Reads from V.quotaWarn.
export default function QuotaBanner(V) {
  const Q = V.quotaWarn || {};
  if (!Q.show) return null;
  const danger = Q.over || Q.pct >= 100;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: danger ? theme.dangerBgSoft : theme.warnBg,
        borderBottom: `1px solid ${danger ? theme.dangerBorder : theme.warnBorder}`,
        padding: '9px 16px',
        fontSize: '12.5px',
        color: danger ? theme.danger : theme.warnDark,
        zIndex: 20,
      }}
      data-testid="quota-banner"
    >
      <span style={{ flex: 1 }}>
        {Q.over ? (
          <React.Fragment>
            <strong>Over your storage budget</strong> - {Q.usedLabel} stored of a {Q.totalLabel}{' '}
            cap.{Q.overflow ? ' New uploads still work (overflow is on).' : ' New uploads are blocked.'}
          </React.Fragment>
        ) : (
          <React.Fragment>
            <strong>Storage {Q.pct}% full</strong> - {Q.usedLabel} of {Q.totalLabel} used.
            {Q.isR2 ? ' Raise your budget in Settings → Storage.' : ' Free up space or add storage.'}
          </React.Fragment>
        )}
      </span>
      {Q.canManage ? (
        <button
          onClick={Q.openStorageSettings}
          style={{
            background: danger ? theme.danger : theme.warnDark,
            color: theme.onAccent,
            border: 'none',
            borderRadius: '7px',
            padding: '6px 12px',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Manage storage
        </button>
      ) : null}
      <button
        onClick={Q.dismiss}
        aria-label="Dismiss"
        style={{
          background: 'none',
          border: 'none',
          color: danger ? theme.danger : theme.warnDark,
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
