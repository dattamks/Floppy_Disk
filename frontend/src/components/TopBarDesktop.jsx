import React from 'react';
import { theme } from '../lib/theme';
import { hov } from '../lib/ui';

// Extracted from AppShell.
export default function TopBarDesktop(V) {
  return V.isDesktop ? (
    <React.Fragment>
      {' '}
      <div
        style={{
          flex: '1',
          display: 'flex',
          alignItems: 'center',
          gap: '9px',
          background: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: theme.radius,
          padding: '9px 13px',
          maxWidth: '380px',
        }}
      >
        {' '}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="7" stroke={theme.textMuted2} strokeWidth="1.8" />
          <path
            d="M20 20l-4.3-4.3"
            stroke={theme.textMuted2}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>{' '}
        <input
          value={V.searchQuery}
          onInput={V.setSearch}
          placeholder="Search files and folders"
          style={{
            background: 'none',
            border: 'none',
            outline: 'none',
            color: theme.text,
            fontSize: '13.5px',
            fontFamily: "'IBM Plex Sans',sans-serif",
            width: '100%',
          }}
        />{' '}
        {V.searchActive ? (
          <React.Fragment>
            <button
              onClick={V.clearSearch}
              aria-label="Clear search"
              title="Clear search"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: theme.textFaint,
                display: 'flex',
                padding: '0',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path
                  d="M5 5l14 14M19 5L5 19"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </React.Fragment>
        ) : null}{' '}
      </div>{' '}
      <div style={{ flex: '1' }} />{' '}
      <button
        onClick={V.onNewNote}
        disabled={V.creatingNote}
        title="Create a new note"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '7px',
          background: theme.white,
          color: theme.text,
          border: `1px solid ${theme.border}`,
          borderRadius: '10px',
          padding: '10px 14px',
          fontSize: '13.5px',
          fontWeight: '600',
          cursor: V.creatingNote ? 'default' : 'pointer',
          opacity: V.creatingNote ? 0.6 : 1,
          fontFamily: "'IBM Plex Sans',sans-serif",
        }}
        {...hov({ background: theme.surface })}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path
            d="M15.5 4.5l4 4L8 20H4v-4L15.5 4.5Z"
            stroke={theme.brand}
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path d="M13.5 6.5l4 4" stroke={theme.brand} strokeWidth="1.7" strokeLinecap="round" />
        </svg>
        New note
      </button>{' '}
      <button
        onClick={V.openNewFolder}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '7px',
          background: theme.white,
          color: theme.text,
          border: `1px solid ${theme.border}`,
          borderRadius: '10px',
          padding: '10px 14px',
          fontSize: '13.5px',
          fontWeight: '600',
          cursor: 'pointer',
          fontFamily: "'IBM Plex Sans',sans-serif",
        }}
        {...hov({ background: theme.surface })}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path
            d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
            stroke={theme.textMuted}
            strokeWidth="1.7"
          />
          <path
            d="M12 11v4M10 13h4"
            stroke={theme.textMuted}
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
        New folder
      </button>{' '}
      <button
        onClick={V.openUpload}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '7px',
          background: theme.brand,
          color: theme.onAccent,
          border: 'none',
          borderRadius: '10px',
          padding: '10px 16px',
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
            stroke={theme.onAccent}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Upload
      </button>{' '}
      <button
        onClick={V.toggleTheme}
        title={V.themeDark ? 'Switch to light theme' : 'Switch to dark theme'}
        aria-label="Toggle theme"
        data-round
        style={{
          width: '34px',
          height: '34px',
          borderRadius: '50%',
          background: theme.surface,
          border: `1px solid ${theme.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: theme.textMuted,
          cursor: 'pointer',
        }}
        {...hov({ background: theme.border })}
      >
        {V.themeDark ? (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.7" />
            <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          </svg>
        )}
      </button>{' '}
      <button
        onClick={V.openNotifications}
        title="Notifications"
        data-round
        style={{
          position: 'relative',
          width: '34px',
          height: '34px',
          borderRadius: '50%',
          background: theme.surface,
          border: `1px solid ${theme.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: theme.textMuted,
          cursor: 'pointer',
        }}
        {...hov({ background: theme.border })}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
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
              top: '-3px',
              right: '-3px',
              minWidth: '16px',
              height: '16px',
              padding: '0 4px',
              borderRadius: '8px',
              background: theme.danger,
              color: '#fff',
              fontSize: '10px',
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
          width: '34px',
          height: '34px',
          borderRadius: '50%',
          background: V.avatarUrl ? `center/cover no-repeat url(${V.avatarUrl})` : theme.brand,
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '13px',
          fontWeight: '600',
          color: theme.onAccent,
          fontFamily: "'Space Grotesk',sans-serif",
          cursor: 'pointer',
        }}
      >
        {V.avatarUrl ? '' : V.avatarInitial || 'A'}
      </button>{' '}
    </React.Fragment>
  ) : null;
}
