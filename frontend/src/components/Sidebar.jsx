import React from 'react';
import { theme } from '../lib/theme';
import { hov } from '../lib/ui';

// Extracted from AppShell.
export default function Sidebar(V) {
  return V.isDesktop ? (
    <React.Fragment>
      {' '}
      <div
        style={{
          width: '212px',
          flex: '0 0 auto',
          background: theme.white,
          borderRight: `1px solid ${theme.border}`,
          display: 'flex',
          flexDirection: 'column',
          padding: '16px 12px',
          gap: '2px',
        }}
      >
        {' '}
        <button
          onClick={V.navToAll}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '11px',
            padding: '10px 11px',
            borderRadius: '9px',
            border: 'none',
            background: V.navAllBg,
            color: V.navAllColor,
            fontSize: '13.5px',
            fontWeight: V.navAllWeight,
            cursor: 'pointer',
            textAlign: 'left',
            fontFamily: "'IBM Plex Sans',sans-serif",
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <path
              d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
              stroke="currentColor"
              strokeWidth="1.7"
            />
          </svg>
          My Files
        </button>{' '}
        <button
          onClick={V.navToTables}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '11px',
            padding: '10px 11px',
            borderRadius: '9px',
            border: 'none',
            background: V.navTablesBg,
            color: V.navTablesColor,
            fontSize: '13.5px',
            fontWeight: V.navTablesWeight,
            cursor: 'pointer',
            textAlign: 'left',
            fontFamily: "'IBM Plex Sans',sans-serif",
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <rect x="3.5" y="4.5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.7" />
            <path d="M3.5 9.5h17M3.5 14.5h17M9 9.5v10M15 9.5v10" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          Tables
        </button>{' '}
        <button
          onClick={V.navToShared}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '11px',
            padding: '10px 11px',
            borderRadius: '9px',
            border: 'none',
            background: V.navSharedBg,
            color: V.navSharedColor,
            fontSize: '13.5px',
            fontWeight: V.navSharedWeight,
            cursor: 'pointer',
            textAlign: 'left',
            fontFamily: "'IBM Plex Sans',sans-serif",
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <circle cx="7" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.7" />
            <circle cx="17" cy="6" r="2.6" stroke="currentColor" strokeWidth="1.7" />
            <circle cx="17" cy="18" r="2.6" stroke="currentColor" strokeWidth="1.7" />
            <path d="M9.2 10.8 14.8 7.2M9.2 13.2l5.6 3.6" stroke="currentColor" strokeWidth="1.7" />
          </svg>
          Shared
          <span style={{ marginLeft: 'auto', fontSize: '11.5px', color: theme.textFaint }}>
            {V.sharedCount}
          </span>
        </button>{' '}
        <button
          onClick={V.navToRecent}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '11px',
            padding: '10px 11px',
            borderRadius: '9px',
            border: 'none',
            background: V.navRecentBg,
            color: V.navRecentColor,
            fontSize: '13.5px',
            fontWeight: V.navRecentWeight,
            cursor: 'pointer',
            textAlign: 'left',
            fontFamily: "'IBM Plex Sans',sans-serif",
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7" />
            <path
              d="M12 7.5V12l3 2"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
          Recent
        </button>{' '}
        <button
          onClick={V.navToStarred}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '11px',
            padding: '10px 11px',
            borderRadius: '9px',
            border: 'none',
            background: V.navStarredBg,
            color: V.navStarredColor,
            fontSize: '13.5px',
            fontWeight: V.navStarredWeight,
            cursor: 'pointer',
            textAlign: 'left',
            fontFamily: "'IBM Plex Sans',sans-serif",
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 3l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.2-5.4 3.2 1.3-6-4.6-4.1 6.1-.6L12 3Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
          Starred
          <span style={{ marginLeft: 'auto', fontSize: '11.5px', color: theme.textFaint }}>
            {V.starredCount}
          </span>
        </button>{' '}
        <button
          onClick={V.navToTrash}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '11px',
            padding: '10px 11px',
            borderRadius: '9px',
            border: 'none',
            background: V.navTrashBg,
            color: V.navTrashColor,
            fontSize: '13.5px',
            fontWeight: V.navTrashWeight,
            cursor: 'pointer',
            textAlign: 'left',
            fontFamily: "'IBM Plex Sans',sans-serif",
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
          Trash
          <span style={{ marginLeft: 'auto', fontSize: '11.5px', color: theme.textFaint }}>
            {V.trashCount}
          </span>
        </button>{' '}
        <button
          onClick={V.openGraph}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '11px',
            padding: '10px 11px',
            borderRadius: '9px',
            border: 'none',
            background: 'none',
            color: theme.textMuted,
            fontSize: '13.5px',
            cursor: 'pointer',
            textAlign: 'left',
            fontFamily: "'IBM Plex Sans',sans-serif",
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <circle cx="6" cy="6" r="2.4" stroke="currentColor" strokeWidth="1.7" />
            <circle cx="18" cy="7" r="2.4" stroke="currentColor" strokeWidth="1.7" />
            <circle cx="12" cy="17" r="2.4" stroke="currentColor" strokeWidth="1.7" />
            <path d="M7.8 7.2 10.4 15M16.6 8.6 13.2 15.4M8 6.4h7.6" stroke="currentColor" strokeWidth="1.6" />
          </svg>
          Knowledge graph
        </button>{' '}
        <div style={{ flex: '1' }} />{' '}
        <div
          style={{
            background: theme.surface2,
            border: `1px solid ${theme.border}`,
            borderRadius: '12px',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '9px',
          }}
        >
          {' '}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '12px',
              color: theme.textMuted,
            }}
          >
            <span>
              {V.storageUsedLabel} of {V.storageTotalLabel}
            </span>
          </div>{' '}
          <div
            style={{
              height: '7px',
              borderRadius: '7px',
              background: theme.border,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                borderRadius: '7px',
                background: V.storageBarColor,
                width: `${V.storagePct}%`,
              }}
            />
          </div>{' '}
        </div>{' '}
        <button
          onClick={V.logout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '9px',
            padding: '9px 11px',
            borderRadius: '9px',
            border: 'none',
            background: 'none',
            color: theme.textMuted,
            fontSize: '13px',
            cursor: 'pointer',
            textAlign: 'left',
            fontFamily: "'IBM Plex Sans',sans-serif",
          }}
          {...hov({ background: theme.surface })}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3M10 8l-4 4 4 4M6 12h10"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Log out
        </button>{' '}
      </div>{' '}
    </React.Fragment>
  ) : null;
}
