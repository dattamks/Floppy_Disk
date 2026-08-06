import React from 'react';
import { theme } from '../lib/theme';
import { hov } from '../lib/ui';
import AuthScreen from '../components/AuthScreen';
import AppShell from '../components/AppShell';
import UploadModal from '../components/UploadModal';
import NewFolderModal from '../components/NewFolderModal';
import NotificationsModal from '../components/NotificationsModal';
import RelatedModal from '../components/RelatedModal';
import GraphModal from '../components/GraphModal';
import VideoModal from '../components/VideoModal';
import ShareModal from '../components/ShareModal';
import PreviewModal from '../components/PreviewModal';
import RenameModal from '../components/RenameModal';
import MoveModal from '../components/MoveModal';
import DetailsModal from '../components/DetailsModal';
import ContextMenu from '../components/ContextMenu';
import Toast from '../components/Toast';
import SetupModal from '../components/SetupModal';
import StorageBanner from '../components/StorageBanner';
import QuotaBanner from '../components/QuotaBanner';

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

// Accessible modal wrapper: on open it moves focus into the dialog (respecting an
// autofocus field), keeps Tab cycling inside it, and restores focus to whatever
// opened it on close. One wrapper on the shared dialog shell covers every modal.
function FocusTrap({ children, ...rest }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const restoreTo = document.activeElement;
    const list = () => Array.from(node.querySelectorAll(FOCUSABLE)).filter((el) => el.offsetParent !== null);
    const t = setTimeout(() => {
      // If a field already grabbed focus (React autoFocus), leave it; otherwise
      // move focus to the first focusable so keyboard users start inside the dialog.
      if (node.contains(document.activeElement) && document.activeElement !== node) return;
      const target = list()[0] || node;
      try {
        target.focus();
      } catch (e) {}
    }, 0);
    const onKey = (e) => {
      if (e.key !== 'Tab') return;
      const f = list();
      if (!f.length) {
        e.preventDefault();
        return;
      }
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    node.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      node.removeEventListener('keydown', onKey);
      // Return focus to the trigger so keyboard users don't lose their place.
      if (restoreTo && typeof restoreTo.focus === 'function') {
        try {
          restoreTo.focus();
        } catch (e) {}
      }
    };
  }, []);
  return (
    <div ref={ref} {...rest}>
      {children}
    </div>
  );
}

// Presentational view for the whole app. Receives the computed view-model V
// (from App.renderVals) and renders it. Being extracted, screen by screen,
// into dedicated components under ./ - this is the container/view split.
export default function AppView({ V }) {
  return (
    <>
      <div
        style={{
          width: '100%',
          height: '100vh',
          overflow: 'hidden',
          background: theme.appBg,
          fontFamily: "'IBM Plex Sans',sans-serif",
          color: theme.text,
          position: 'relative',
        }}
      >
        {' '}
        <div
          style={{
            position: 'absolute',
            inset: '0',
            display: 'flex',
            flexDirection: 'column',
            background: theme.appBg,
          }}
        >
          {' '}
          {AuthScreen(V)} {StorageBanner(V)} {QuotaBanner(V)} {AppShell(V)} {SetupModal(V)}{' '}
          {V.drawerOpen ? (
            <React.Fragment>
              {' '}
              <div
                onClick={V.closeDrawer}
                style={{
                  position: 'absolute',
                  inset: '0',
                  background: 'rgba(20,23,28,0.42)',
                  zIndex: '25',
                  display: 'flex',
                }}
              >
                {' '}
                <div
                  onClick={V.stop}
                  style={{
                    width: '258px',
                    height: '100%',
                    background: theme.white,
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '18px 14px',
                    gap: '3px',
                    boxShadow: '6px 0 24px rgba(16,24,40,0.18)',
                  }}
                >
                  {' '}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '9px',
                      padding: '2px 4px 14px',
                    }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <rect x="3" y="3" width="18" height="18" rx="4" fill={theme.brand} />
                      <path
                        d="M8 3v5h6.5M8.5 20v-6h7v6"
                        stroke={theme.white}
                        strokeWidth="1.7"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span
                      style={{
                        fontFamily: "'Space Grotesk',sans-serif",
                        fontWeight: '700',
                        fontSize: '17px',
                      }}
                    >
                      Floppy Disk
                    </span>
                  </div>{' '}
                  <button
                    onClick={V.navToAll}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '11px',
                      padding: '11px 11px',
                      borderRadius: '9px',
                      border: 'none',
                      background: V.navAllBg,
                      color: V.navAllColor,
                      fontSize: '14px',
                      fontWeight: V.navAllWeight,
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: "'IBM Plex Sans',sans-serif",
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
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
                      padding: '11px 11px',
                      borderRadius: '9px',
                      border: 'none',
                      background: V.navTablesBg,
                      color: V.navTablesColor,
                      fontSize: '14px',
                      fontWeight: V.navTablesWeight,
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: "'IBM Plex Sans',sans-serif",
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
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
                      padding: '11px 11px',
                      borderRadius: '9px',
                      border: 'none',
                      background: V.navSharedBg,
                      color: V.navSharedColor,
                      fontSize: '14px',
                      fontWeight: V.navSharedWeight,
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: "'IBM Plex Sans',sans-serif",
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <circle cx="7" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.7" />
                      <circle cx="17" cy="6" r="2.6" stroke="currentColor" strokeWidth="1.7" />
                      <circle cx="17" cy="18" r="2.6" stroke="currentColor" strokeWidth="1.7" />
                      <path
                        d="M9.2 10.8 14.8 7.2M9.2 13.2l5.6 3.6"
                        stroke="currentColor"
                        strokeWidth="1.7"
                      />
                    </svg>
                    Shared
                    <span style={{ marginLeft: 'auto', fontSize: '12px', color: theme.textFaint }}>
                      {V.sharedCount}
                    </span>
                  </button>{' '}
                  <button
                    onClick={V.navToRecent}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '11px',
                      padding: '11px 11px',
                      borderRadius: '9px',
                      border: 'none',
                      background: V.navRecentBg,
                      color: V.navRecentColor,
                      fontSize: '14px',
                      fontWeight: V.navRecentWeight,
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: "'IBM Plex Sans',sans-serif",
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
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
                      padding: '11px 11px',
                      borderRadius: '9px',
                      border: 'none',
                      background: V.navStarredBg,
                      color: V.navStarredColor,
                      fontSize: '14px',
                      fontWeight: V.navStarredWeight,
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: "'IBM Plex Sans',sans-serif",
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 3l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.2-5.4 3.2 1.3-6-4.6-4.1 6.1-.6L12 3Z"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Starred
                    <span style={{ marginLeft: 'auto', fontSize: '12px', color: theme.textFaint }}>
                      {V.starredCount}
                    </span>
                  </button>{' '}
                  <button
                    onClick={V.navToTrash}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '11px',
                      padding: '11px 11px',
                      borderRadius: '9px',
                      border: 'none',
                      background: V.navTrashBg,
                      color: V.navTrashColor,
                      fontSize: '14px',
                      fontWeight: V.navTrashWeight,
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: "'IBM Plex Sans',sans-serif",
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                      />
                    </svg>
                    Trash
                    <span style={{ marginLeft: 'auto', fontSize: '12px', color: theme.textFaint }}>
                      {V.trashCount}
                    </span>
                  </button>{' '}
                  <button
                    onClick={V.openSettings}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '11px',
                      padding: '11px 11px',
                      borderRadius: '9px',
                      border: 'none',
                      background: 'none',
                      color: theme.textMuted,
                      fontSize: '14px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: "'IBM Plex Sans',sans-serif",
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
                      <path
                        d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.3 1a7 7 0 0 0-1.7-1l-.3-2.6h-4l-.3 2.6a7 7 0 0 0-1.7 1l-2.3-1-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 1.7 1l.3 2.6h4l.3-2.6a7 7 0 0 0 1.7-1l2.3 1 2-3.4-2-1.5c.1-.3.1-.7.1-1Z"
                        stroke="currentColor"
                        strokeWidth="1.3"
                      />
                    </svg>
                    Settings
                  </button>{' '}
                  <div style={{ flex: '1' }} />{' '}
                  <div
                    style={{
                      background: theme.surface2,
                      border: `1px solid ${theme.border}`,
                      borderRadius: '12px',
                      padding: '13px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
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
                    </div>
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
                    </div>
                  </div>{' '}
                  <button
                    onClick={V.logout}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '11px',
                      padding: '11px 11px',
                      borderRadius: '9px',
                      border: 'none',
                      background: 'none',
                      color: theme.danger,
                      fontSize: '14px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: "'IBM Plex Sans',sans-serif",
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
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
              </div>{' '}
            </React.Fragment>
          ) : null}{' '}
          {V.modalOpen ? (
            <React.Fragment>
              {' '}
              <div
                role="presentation"
                style={{
                  position: 'absolute',
                  inset: '0',
                  background: V.overlayBg,
                  backdropFilter: 'blur(2px)',
                  display: 'flex',
                  alignItems: V.overlayAlign,
                  justifyContent: 'center',
                  zIndex: '20',
                  padding: `${V.overlayPad}px`,
                }}
              >
                {' '}
                <FocusTrap
                  role="dialog"
                  aria-modal="true"
                  style={{
                    width: V.boxW,
                    maxWidth: '100%',
                    height: V.boxH || 'auto',
                    maxHeight: V.boxMaxH,
                    background: V.boxBg,
                    border: V.boxBorder,
                    borderRadius: V.boxRadius,
                    padding: `${V.boxPad}px`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '15px',
                    overflowY: 'auto',
                    boxShadow: '0 24px 60px rgba(16,24,40,0.28)',
                  }}
                >
                  {' '}
                  {UploadModal(V)} {NotificationsModal(V)} {RelatedModal(V)} {GraphModal(V)}{' '}
                  {NewFolderModal(V)}{' '}
                  {PreviewModal(V)} {VideoModal(V)} {ShareModal(V)} {RenameModal(V)} {MoveModal(V)}{' '}
                  {DetailsModal(V)}{' '}
                </FocusTrap>{' '}
              </div>{' '}
            </React.Fragment>
          ) : null}{' '}
          {Toast(V)} {ContextMenu(V)}{' '}
        </div>{' '}
      </div>
    </>
  );
}
