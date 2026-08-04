import React from 'react';
import { theme } from '../lib/theme';
import { hov } from '../lib/ui';

// In-app notifications list; renders when V.isNotificationsModal is set.
export default function NotificationsModal(V) {
  if (!V.isNotificationsModal) return null;
  const items = V.notifications || [];
  return (
    <React.Fragment>
      {' '}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: '600', fontSize: '16px' }}
        >
          Notifications
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {V.hasUnread ? (
            <button
              onClick={V.markAllNotificationsRead}
              style={{
                background: 'none',
                border: 'none',
                color: theme.brand,
                cursor: 'pointer',
                fontSize: '12.5px',
                fontWeight: '600',
                padding: '0',
              }}
            >
              Mark all read
            </button>
          ) : null}
          <button
            onClick={V.closeModal}
            aria-label="Close"
            title="Close"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted2 }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path d="M5 5l14 14M19 5L5 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>{' '}
      {items.length === 0 ? (
        <div style={{ color: theme.textMuted, fontSize: '13.5px', padding: '18px 2px' }}>
          You’re all caught up.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {items.map((n) => (
            <button
              key={n.id}
              onClick={() => (n.is_read ? null : V.markNotificationRead(n.id))}
              style={{
                display: 'flex',
                gap: '10px',
                alignItems: 'flex-start',
                textAlign: 'left',
                background: n.is_read ? 'transparent' : theme.surface,
                border: 'none',
                borderRadius: '9px',
                padding: '11px 12px',
                cursor: n.is_read ? 'default' : 'pointer',
                fontFamily: "'IBM Plex Sans',sans-serif",
              }}
              {...(n.is_read ? {} : hov({ background: theme.border }))}
            >
              <span
                style={{
                  marginTop: '5px',
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  flexShrink: 0,
                  background: n.is_read ? 'transparent' : theme.brand,
                }}
              />
              <span style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '13.5px', fontWeight: '600', color: theme.text }}>
                  {n.title}
                </span>
                {n.body ? (
                  <span style={{ fontSize: '12.5px', color: theme.textMuted }}>{n.body}</span>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      )}{' '}
    </React.Fragment>
  );
}
