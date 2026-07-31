import React from 'react';
import { theme } from '../lib/theme';
import { hov } from '../lib/ui';

// Extracted from AppShell.
export default function MobileTabBar(V) {
  return V.isMobile ? (
    <React.Fragment>
      {' '}
      {V.mobileCreateOpen ? (
        <div onClick={V.closeMobileCreate} style={{ position: 'absolute', inset: '0', zIndex: '4' }} />
      ) : null}{' '}
      <div
        style={{
          position: 'absolute',
          bottom: '0',
          left: '0',
          right: '0',
          height: '64px',
          background: theme.white,
          borderTop: `1px solid ${theme.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          padding: '0 6px',
          zIndex: '5',
        }}
      >
        {' '}
        <button
          onClick={V.navToAll}
          style={{
            background: 'none',
            border: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '3px',
            color: V.navAllColor,
            cursor: 'pointer',
          }}
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
            <path
              d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
              stroke="currentColor"
              strokeWidth="1.7"
            />
          </svg>
          <span style={{ fontSize: '9.5px', fontWeight: '500' }}>Files</span>
        </button>{' '}
        <button
          onClick={V.navToShared}
          style={{
            background: 'none',
            border: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '3px',
            color: V.navSharedColor,
            cursor: 'pointer',
          }}
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
            <circle cx="7" cy="12" r="2.3" stroke="currentColor" strokeWidth="1.7" />
            <circle cx="17" cy="6" r="2.3" stroke="currentColor" strokeWidth="1.7" />
            <circle cx="17" cy="18" r="2.3" stroke="currentColor" strokeWidth="1.7" />
            <path d="M9.2 10.8 14.8 7.2M9.2 13.2l5.6 3.6" stroke="currentColor" strokeWidth="1.7" />
          </svg>
          <span style={{ fontSize: '9.5px', fontWeight: '500' }}>Shared</span>
        </button>{' '}
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
          {V.mobileCreateOpen ? (
            <div
              style={{
                position: 'absolute',
                bottom: '54px',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                background: theme.white,
                border: `1px solid ${theme.border}`,
                borderRadius: '14px',
                padding: '8px',
                boxShadow: '0 12px 30px rgba(16,24,40,0.22)',
                zIndex: '6',
              }}
            >
              {[
                { label: 'New note', fn: V.onMobileCreateNote },
                { label: 'New folder', fn: V.onMobileNewFolder },
                { label: 'Upload', fn: V.onMobileUpload },
              ].map((a) => (
                <button
                  key={a.label}
                  onClick={a.fn}
                  style={{
                    whiteSpace: 'nowrap',
                    background: theme.surface,
                    border: `1px solid ${theme.border}`,
                    borderRadius: '9px',
                    padding: '10px 18px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: theme.text,
                    cursor: 'pointer',
                    fontFamily: "'IBM Plex Sans',sans-serif",
                  }}
                >
                  {a.label}
                </button>
              ))}
            </div>
          ) : null}
          <button
            onClick={V.onFabTap}
            aria-label="Create"
            aria-expanded={!!V.mobileCreateOpen}
            style={{
              background: theme.brand,
              border: 'none',
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              marginTop: '-20px',
              boxShadow: '0 6px 16px rgba(81,69,229,0.4)',
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              style={{ transition: 'transform 0.15s', transform: V.mobileCreateOpen ? 'rotate(45deg)' : 'none' }}
            >
              <path d="M12 5v14M5 12h14" stroke={theme.white} strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>{' '}
        <button
          onClick={V.navToTrash}
          style={{
            background: 'none',
            border: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '3px',
            color: V.navTrashColor,
            cursor: 'pointer',
          }}
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
          <span style={{ fontSize: '9.5px', fontWeight: '500' }}>Trash</span>
        </button>{' '}
      </div>{' '}
    </React.Fragment>
  ) : null;
}
