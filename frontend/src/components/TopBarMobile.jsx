import React from 'react';
import { theme } from '../lib/theme';
import { hov } from '../lib/ui';

// Extracted from AppShell.
export default function TopBarMobile(V) {
  return V.isMobile ? (
    <React.Fragment>
      {' '}
      <button
        onClick={V.openDrawer}
        aria-label="Menu"
        title="Menu"
        style={{
          background: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: '9px',
          width: '40px',
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flex: '0 0 auto',
        }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 6h16M4 12h16M4 18h16"
            stroke={theme.text}
            strokeWidth="1.9"
            strokeLinecap="round"
          />
        </svg>
      </button>{' '}
      <span
        style={{
          fontFamily: "'Space Grotesk',sans-serif",
          fontWeight: '700',
          fontSize: '16px',
          flex: '1',
          minWidth: '0',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {V.sectionTitle}
      </span>{' '}
      <button
        onClick={V.toggleMobileSearch}
        aria-label="Search"
        title="Search"
        style={{
          background: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: '9px',
          width: '40px',
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flex: '0 0 auto',
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="7" stroke={theme.textMuted} strokeWidth="1.8" />
          <path
            d="M20 20l-4.3-4.3"
            stroke={theme.textMuted}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>{' '}
      <button
        onClick={V.openNotifications}
        title="Notifications"
        style={{
          position: 'relative',
          background: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: '9px',
          width: '40px',
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flex: '0 0 auto',
          color: theme.textMuted,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path
            d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {V.hasUnread ? (
          <span
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              minWidth: '15px',
              height: '15px',
              padding: '0 3px',
              borderRadius: '8px',
              background: theme.danger,
              color: '#fff',
              fontSize: '9.5px',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {V.unreadCount > 9 ? '9+' : V.unreadCount}
          </span>
        ) : null}
      </button>{' '}
      <button
        onClick={V.openSettings}
        aria-label="Settings"
        title="Settings"
        data-round
        style={{
          width: '38px',
          height: '38px',
          borderRadius: '50%',
          background: V.avatarUrl ? `center/cover no-repeat url(${V.avatarUrl})` : theme.brand,
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12.5px',
          fontWeight: '600',
          color: theme.onAccent,
          fontFamily: "'Space Grotesk',sans-serif",
          flex: '0 0 auto',
          cursor: 'pointer',
        }}
      >
        {V.avatarUrl ? '' : V.avatarInitial || 'A'}
      </button>{' '}
    </React.Fragment>
  ) : null;
}
