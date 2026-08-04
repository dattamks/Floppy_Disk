import React from 'react';
import { theme } from '../lib/theme';

// File/folder details panel. Renders when V.isDetailsModal is set; data comes
// from V.detailsView ({ name, starred, rows: [[label, value], ...] }).
export default function DetailsModal(V) {
  if (!V.isDetailsModal || !V.detailsView) return null;
  const d = V.detailsView;
  return (
    <React.Fragment>
      {' '}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
        <span
          style={{
            fontFamily: "'Space Grotesk',sans-serif",
            fontWeight: '600',
            fontSize: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '7px',
            overflow: 'hidden',
          }}
        >
          {d.starred ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill={theme.star} style={{ flex: '0 0 auto' }}>
              <path
                d="M12 3l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.2-5.4 3.2 1.3-6-4.6-4.1 6.1-.6L12 3Z"
                stroke={theme.star}
                strokeWidth="1.3"
              />
            </svg>
          ) : null}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
        </span>
        <button
          onClick={V.closeModal}
          aria-label="Close"
          title="Close"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted2, flex: '0 0 auto' }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <path d="M5 5l14 14M19 5L5 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>{' '}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: theme.border, borderRadius: theme.radiusCard, overflow: 'hidden', border: `1px solid ${theme.border}` }}>
        {d.rows.map(([label, value], i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: '12px',
              padding: '11px 14px',
              background: theme.white,
              fontSize: '13px',
            }}
          >
            <span style={{ width: '84px', flex: '0 0 auto', color: theme.textMuted, fontWeight: '500' }}>
              {label}
            </span>
            <span style={{ color: theme.text, wordBreak: 'break-word' }}>{value}</span>
          </div>
        ))}
      </div>{' '}
    </React.Fragment>
  );
}
