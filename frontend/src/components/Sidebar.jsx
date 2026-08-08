import React from 'react';
import { theme } from '../lib/theme';
import { hov } from '../lib/ui';

// Icons kept inline so each nav item is self-contained.
const ICONS = {
  all: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" stroke="currentColor" strokeWidth="1.7" />,
  tables: <><rect x="3.5" y="4.5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.7" /><path d="M3.5 9.5h17M3.5 14.5h17M9 9.5v10M15 9.5v10" stroke="currentColor" strokeWidth="1.5" /></>,
  gallery: <><rect x="3.5" y="4.5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.7" /><circle cx="8.5" cy="9.5" r="1.6" fill="currentColor" /><path d="M4 17l4.5-4.5 3 3L15 11l5 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></>,
  shared: <><circle cx="7" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.7" /><circle cx="17" cy="6" r="2.6" stroke="currentColor" strokeWidth="1.7" /><circle cx="17" cy="18" r="2.6" stroke="currentColor" strokeWidth="1.7" /><path d="M9.2 10.8 14.8 7.2M9.2 13.2l5.6 3.6" stroke="currentColor" strokeWidth="1.7" /></>,
  recent: <><circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7" /><path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></>,
  starred: <path d="M12 3l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.2-5.4 3.2 1.3-6-4.6-4.1 6.1-.6L12 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />,
  trash: <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />,
  graph: <><circle cx="6" cy="6" r="2.4" stroke="currentColor" strokeWidth="1.7" /><circle cx="18" cy="7" r="2.4" stroke="currentColor" strokeWidth="1.7" /><circle cx="12" cy="17" r="2.4" stroke="currentColor" strokeWidth="1.7" /><path d="M7.8 7.2 10.4 15M16.6 8.6 13.2 15.4M8 6.4h7.6" stroke="currentColor" strokeWidth="1.6" /></>,
};

// Extracted from AppShell. Data-driven so the three collapse modes
// (expanded / hover / icons) stay consistent across every nav row.
export default function Sidebar(V) {
  if (!V.isDesktop) return null;
  // When a secondary sidebar (folder tree / Tables / Settings) is on screen the
  // primary becomes an icon rail so the two panes don't both take full width.
  const forcedRail = !!V.secondarySidebar;
  const mode = forcedRail ? 'icons' : (V.sidebarMode || 'expanded');
  const collapsed = mode !== 'expanded';
  const slotW = collapsed ? 60 : 212;

  const items = [
    { key: 'all', label: 'My Files', onClick: V.navToAll, bg: V.navAllBg, color: V.navAllColor, weight: V.navAllWeight },
    { key: 'tables', label: 'Tables', onClick: V.navToTables, bg: V.navTablesBg, color: V.navTablesColor, weight: V.navTablesWeight },
    { key: 'gallery', label: 'Gallery', onClick: V.navToGallery, bg: V.navGalleryBg, color: V.navGalleryColor, weight: V.navGalleryWeight },
    { key: 'shared', label: 'Shared', onClick: V.navToShared, bg: V.navSharedBg, color: V.navSharedColor, weight: V.navSharedWeight, count: V.sharedCount },
    { key: 'recent', label: 'Recent', onClick: V.navToRecent, bg: V.navRecentBg, color: V.navRecentColor, weight: V.navRecentWeight },
    { key: 'starred', label: 'Starred', onClick: V.navToStarred, bg: V.navStarredBg, color: V.navStarredColor, weight: V.navStarredWeight, count: V.starredCount },
    { key: 'trash', label: 'Trash', onClick: V.navToTrash, bg: V.navTrashBg, color: V.navTrashColor, weight: V.navTrashWeight, count: V.trashCount },
    { key: 'graph', label: 'Knowledge graph', onClick: V.openGraph, bg: 'none', color: theme.textMuted, weight: 500 },
  ];

  const navBtn = (it) => (
    <button
      key={it.key}
      onClick={it.onClick}
      className="fd-navbtn"
      title={collapsed ? it.label : undefined}
      data-testid={`nav-${it.key}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '11px',
        padding: '10px 11px',
        borderRadius: '9px',
        border: 'none',
        background: it.bg,
        color: it.color,
        fontSize: '13.5px',
        fontWeight: it.weight,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: "'IBM Plex Sans',sans-serif",
      }}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" style={{ flex: '0 0 17px' }}>{ICONS[it.key]}</svg>
      <span className="fd-navlabel">{it.label}</span>
      {it.count != null ? (
        <span className="fd-navlabel" style={{ marginLeft: 'auto', fontSize: '11.5px', color: theme.textFaint }}>{it.count}</span>
      ) : null}
    </button>
  );

  const modeIcon = mode === 'expanded'
    ? 'M15 6l-6 6 6 6'   // «  (collapse)
    : mode === 'hover'
      ? 'M4 12h10M4 6h16M4 18h16' // rail
      : 'M9 6l6 6-6 6';  // »  (expand)
  const modeLabel = mode === 'expanded' ? 'Collapse to hover' : mode === 'hover' ? 'Collapse to icons' : 'Expand sidebar';

  return (
    <div className={`fd-sidebar-slot mode-${mode}`} style={{ width: slotW, flex: '0 0 auto', position: 'relative', minHeight: 0 }}>
      <style>{`
        .fd-sidebar{transition:width .14s ease;}
        .fd-sidebar-slot.mode-hover .fd-sidebar:hover{width:212px;box-shadow:4px 0 18px rgba(16,24,40,0.14);}
        .fd-sidebar-slot.mode-hover .fd-sidebar:not(:hover) .fd-navlabel{display:none;}
        .fd-sidebar-slot.mode-hover .fd-sidebar:not(:hover) .fd-navbtn{justify-content:center;}
        .fd-sidebar-slot.mode-icons .fd-navlabel{display:none;}
        .fd-sidebar-slot.mode-icons .fd-navbtn{justify-content:center;}
        .fd-storagecard{display:flex;}
      `}</style>
      <div
        className="fd-sidebar"
        style={{
          width: slotW,
          height: '100%',
          position: mode === 'hover' ? 'absolute' : 'relative',
          top: 0,
          left: 0,
          zIndex: mode === 'hover' ? 30 : 'auto',
          background: theme.white,
          borderRight: `1px solid ${theme.border}`,
          display: 'flex',
          flexDirection: 'column',
          padding: '10px 12px',
          gap: '2px',
          overflow: 'hidden',
        }}
      >
        {forcedRail ? null : (
          <button
            onClick={V.onCycleSidebar}
            className="fd-navbtn"
            data-testid="sidebar-collapse-toggle"
            title={modeLabel}
            aria-label={modeLabel}
            style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '8px 11px', marginBottom: 4, borderRadius: '9px', border: 'none', background: 'none', color: theme.textMuted, fontSize: '12.5px', cursor: 'pointer', textAlign: 'left', fontFamily: "'IBM Plex Sans',sans-serif" }}
            {...hov({ background: theme.surface })}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" style={{ flex: '0 0 17px' }}>
              <path d={modeIcon} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="fd-navlabel">{mode === 'expanded' ? 'Collapse' : mode === 'hover' ? 'Hover mode' : 'Expand'}</span>
          </button>
        )}
        {items.map(navBtn)}
        <div style={{ flex: '1' }} />
        <div className="fd-navlabel fd-storagecard" style={{ background: theme.surface2, border: `1px solid ${theme.border}`, borderRadius: '12px', padding: '14px', flexDirection: 'column', gap: '9px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: theme.textMuted }}>
            <span>{V.storageUsedLabel} of {V.storageTotalLabel}</span>
          </div>
          <div style={{ height: '7px', borderRadius: '7px', background: theme.border, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: '7px', background: V.storageBarColor, width: `${V.storagePct}%` }} />
          </div>
        </div>
        <button
          onClick={V.logout}
          className="fd-navbtn"
          title={collapsed ? 'Log out' : undefined}
          data-testid="nav-logout"
          style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '9px 11px', borderRadius: '9px', border: 'none', background: 'none', color: theme.textMuted, fontSize: '13px', cursor: 'pointer', textAlign: 'left', fontFamily: "'IBM Plex Sans',sans-serif" }}
          {...hov({ background: theme.surface })}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flex: '0 0 16px' }}>
            <path d="M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3M10 8l-4 4 4 4M6 12h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="fd-navlabel">Log out</span>
        </button>
      </div>
    </div>
  );
}
