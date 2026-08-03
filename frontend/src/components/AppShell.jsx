import React from 'react';
import { theme } from '../lib/theme';
import { hov } from '../lib/ui';
import FileCard from './FileCard';
import FileRow from './FileRow';
import TopBarDesktop from './TopBarDesktop';
import Sidebar from './Sidebar';
import Breadcrumb from './Breadcrumb';
import TopBarMobile from './TopBarMobile';
import MobileTabBar from './MobileTabBar';
import TrashScreen from './TrashScreen';
import EmptyState from './EmptyState';
import SettingsPage from './SettingsPage';

// Bulk-selection action bar, shown when one or more items are selected.
function SelectionBar(V) {
  const action = (onClick, label, danger) => (
    <button
      onClick={onClick}
      style={{
        padding: '6px 13px',
        fontSize: '12.5px',
        fontWeight: '600',
        cursor: 'pointer',
        borderRadius: '8px',
        border: `1px solid ${danger ? theme.dangerBorder2 : theme.border}`,
        background: danger ? theme.dangerBgSoft : theme.white,
        color: danger ? theme.danger : theme.text,
        fontFamily: "'IBM Plex Sans',sans-serif",
      }}
    >
      {label}
    </button>
  );
  return (
    <div
      data-testid="selection-bar"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '9px 14px',
        borderRadius: '11px',
        background: theme.brandBg,
        border: `1px solid ${theme.brandBorder}`,
      }}
    >
      <span style={{ fontSize: '13px', fontWeight: '600', color: theme.brand }}>
        {V.selectionCount} selected
      </span>
      <div style={{ flex: '1' }} />
      {V.selectionInTrash ? (
        <React.Fragment>
          {action(V.onBulkRestore, 'Restore')}
          {action(V.onBulkPurge, 'Delete permanently', true)}
        </React.Fragment>
      ) : (
        <React.Fragment>
          {action(V.onBulkMove, 'Move')}
          {action(V.onBulkDownload, 'Download')}
          {action(V.onBulkTrash, 'Trash', true)}
        </React.Fragment>
      )}
      {action(V.onSelectAll, 'Select all')}
      {action(V.onClearSelection, 'Clear')}
    </div>
  );
}

// Type filter chips shown while searching.
function SearchFilters(V) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
      {(V.searchTypeChips || []).map((c, i) => (
        <button
          key={i}
          onClick={c.onClick}
          style={{
            padding: '5px 13px',
            fontSize: '12.5px',
            fontWeight: c.active ? '600' : '500',
            cursor: 'pointer',
            borderRadius: '999px',
            border: `1px solid ${c.active ? theme.brand : theme.border}`,
            background: c.active ? theme.brandBg : theme.white,
            color: c.active ? theme.brand : theme.textMuted,
            fontFamily: "'IBM Plex Sans',sans-serif",
          }}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

// Sort + grid/list controls shown above a file listing.
function ListToolbar(V) {
  const seg = (active) => ({
    padding: '5px 11px',
    fontSize: '12.5px',
    fontWeight: active ? '600' : '500',
    cursor: 'pointer',
    border: 'none',
    borderRadius: '7px',
    background: active ? theme.white : 'transparent',
    color: active ? theme.text : theme.textMuted,
    boxShadow: active ? '0 1px 2px rgba(16,24,40,0.10)' : 'none',
    fontFamily: "'IBM Plex Sans',sans-serif",
  });
  const iconBtn = (active) => ({
    width: '30px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    border: 'none',
    borderRadius: '7px',
    background: active ? theme.white : 'transparent',
    color: active ? theme.brand : theme.textMuted,
    boxShadow: active ? '0 1px 2px rgba(16,24,40,0.10)' : 'none',
  });
  const group = {
    display: 'flex',
    gap: '2px',
    padding: '3px',
    borderRadius: '9px',
    background: theme.surface2,
    border: `1px solid ${theme.border}`,
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <span style={{ fontSize: '12px', color: theme.textFaint }}>Sort</span>
      <div style={group}>
        <button onClick={V.setSortName} style={seg(V.sortByName)}>
          Name
        </button>
        <button onClick={V.setSortSize} style={seg(V.sortBySize)}>
          Size
        </button>
      </div>
      <div style={{ flex: '1' }} />
      <div style={group}>
        <button
          onClick={V.setGridView}
          aria-label="Grid view"
          title="Grid view"
          style={iconBtn(V.isGridView)}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <rect
              x="3"
              y="3"
              width="7"
              height="7"
              rx="1.5"
              stroke="currentColor"
              strokeWidth="1.8"
            />
            <rect
              x="14"
              y="3"
              width="7"
              height="7"
              rx="1.5"
              stroke="currentColor"
              strokeWidth="1.8"
            />
            <rect
              x="3"
              y="14"
              width="7"
              height="7"
              rx="1.5"
              stroke="currentColor"
              strokeWidth="1.8"
            />
            <rect
              x="14"
              y="14"
              width="7"
              height="7"
              rx="1.5"
              stroke="currentColor"
              strokeWidth="1.8"
            />
          </svg>
        </button>
        <button
          onClick={V.setListView}
          aria-label="List view"
          title="List view"
          style={iconBtn(V.isListView)}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 6h16M4 12h16M4 18h16"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

// Extracted from the design view; renders when V.isApp is set.
export default function AppShell(V) {
  return V.isApp ? (
    <React.Fragment>
      {' '}
      <div style={{ flex: '1', display: 'flex', flexDirection: 'column', minHeight: '0' }}>
        {' '}
        <div
          style={{
            height: '60px',
            flex: '0 0 auto',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '0 18px',
            borderBottom: `1px solid ${theme.border}`,
            background: theme.white,
          }}
        >
          {' '}
          {TopBarDesktop(V)} {TopBarMobile(V)}{' '}
        </div>{' '}
        <div style={{ flex: '1', display: 'flex', overflow: 'hidden', minHeight: '0' }}>
          {' '}
          {Sidebar(V)}{' '}
          {V.isSettingsPage ? (
            SettingsPage(V)
          ) : (
          <div
            style={{
              flex: '1',
              overflowY: 'auto',
              overflowX: 'hidden',
              padding: `${V.d.pad}px ${V.d.pad}px ${V.d.padBottom}px`,
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
              minWidth: '0',
            }}
          >
            {' '}
            {V.showMobileSearch ? (
              <React.Fragment>
                {' '}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '9px',
                    background: theme.white,
                    border: `1px solid ${theme.border}`,
                    borderRadius: theme.radius,
                    padding: '10px 13px',
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
              </React.Fragment>
            ) : null}{' '}
            {Breadcrumb(V)} {TrashScreen(V)} {V.selectionActive ? SelectionBar(V) : null}{' '}
            {V.showSearchFilters ? SearchFilters(V) : null}{' '}
            {V.showListToolbar ? ListToolbar(V) : null}{' '}
            {V.hasFiles ? (
              <React.Fragment>
                {' '}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
                  {' '}
                  {V.showGridLabel ? (
                    <React.Fragment>
                      <span
                        style={{
                          fontFamily: "'Space Grotesk',sans-serif",
                          fontWeight: '600',
                          fontSize: '15px',
                        }}
                      >
                        {V.gridLabel}
                      </span>
                    </React.Fragment>
                  ) : null}{' '}
                  {V.isListView ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {' '}
                      {(V.visibleFiles || []).map((file, $index) => (
                        <FileRow key={$index} V={V} file={file} />
                      ))}{' '}
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(auto-fill, minmax(${V.d.gridMin}px, 1fr))`,
                        gap: `${V.d.cardGap}px`,
                      }}
                    >
                      {' '}
                      {(V.visibleFiles || []).map((file, $index) => (
                        <FileCard key={$index} V={V} file={file} />
                      ))}{' '}
                    </div>
                  )}{' '}
                </div>{' '}
              </React.Fragment>
            ) : null}{' '}
            {EmptyState(V)}{' '}
          </div>
          )}{' '}
        </div>{' '}
        {MobileTabBar(V)}{' '}
      </div>{' '}
    </React.Fragment>
  ) : null;
}
