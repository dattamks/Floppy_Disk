import React from 'react';
import { theme } from '../lib/theme';

// Bottom navigation for mobile: five thumb-reachable slots with the primary
// create action as a prominent center FAB — Files · Shared · [＋] · Starred ·
// Trash. Everything else lives in the drawer (hamburger, top-left).
const ICONS = {
  files: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" stroke="currentColor" strokeWidth="1.7" />,
  shared: <><circle cx="7" cy="12" r="2.3" stroke="currentColor" strokeWidth="1.7" /><circle cx="17" cy="6" r="2.3" stroke="currentColor" strokeWidth="1.7" /><circle cx="17" cy="18" r="2.3" stroke="currentColor" strokeWidth="1.7" /><path d="M9.2 10.8 14.8 7.2M9.2 13.2l5.6 3.6" stroke="currentColor" strokeWidth="1.7" /></>,
  starred: <path d="M12 3l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.2-5.4 3.2 1.3-6-4.6-4.1 6.1-.6L12 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />,
  trash: <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />,
};

export default function MobileTabBar(V) {
  if (!V.isMobile) return null;

  const tab = (key, label, onClick, color) => (
    <button
      key={key}
      data-testid={`tab-${key}`}
      onClick={onClick}
      aria-label={label}
      style={{
        background: 'none',
        border: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '3px',
        color,
        cursor: 'pointer',
        flex: '1 1 0',
        minWidth: 0,
        padding: '4px 0',
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">{ICONS[key]}</svg>
      <span style={{ fontSize: '9.5px', fontWeight: '500' }}>{label}</span>
    </button>
  );

  return (
    <React.Fragment>
      {V.mobileCreateOpen ? (
        <div onClick={V.closeMobileCreate} style={{ position: 'absolute', inset: '0', zIndex: '4' }} />
      ) : null}
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
          padding: '0 4px',
          paddingBottom: 'env(safe-area-inset-bottom)',
          zIndex: '5',
        }}
      >
        {tab('files', 'Files', V.navToAll, V.navAllColor)}
        {tab('shared', 'Shared', V.navToShared, V.navSharedColor)}

        {/* Center create FAB. */}
        <div style={{ flex: '0 0 auto', position: 'relative', display: 'flex', justifyContent: 'center', width: '58px' }}>
          {V.mobileCreateOpen ? (
            <div
              style={{
                position: 'absolute',
                bottom: '58px',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                background: theme.white,
                border: `1px solid ${theme.border}`,
                borderRadius: '14px',
                padding: '8px',
                boxShadow: '0 12px 30px rgba(0,0,0,0.28)',
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
            data-round
            data-testid="tab-create"
            style={{
              background: theme.brand,
              border: `3px solid ${theme.white}`,
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              marginTop: '-24px',
              boxShadow: '0 6px 16px rgba(0,0,0,0.3)',
            }}
          >
            <svg
              width="21"
              height="21"
              viewBox="0 0 24 24"
              fill="none"
              style={{ transition: 'transform 0.15s', transform: V.mobileCreateOpen ? 'rotate(45deg)' : 'none' }}
            >
              <path d="M12 5v14M5 12h14" stroke={theme.onAccent} strokeWidth="2.3" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {tab('starred', 'Starred', V.navToStarred, V.navStarredColor)}
        {tab('trash', 'Trash', V.navToTrash, V.navTrashColor)}
      </div>
    </React.Fragment>
  );
}
