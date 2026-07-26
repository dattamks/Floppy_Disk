import React from 'react';
import { theme } from '../lib/theme';
import { hov } from '../lib/ui';
import FileCard from './FileCard';
import TopBarDesktop from './TopBarDesktop';
import Sidebar from './Sidebar';
import Breadcrumb from './Breadcrumb';
import TopBarMobile from './TopBarMobile';
import MobileTabBar from './MobileTabBar';
import TrashScreen from './TrashScreen';
// DEACTIVATED (Drive-focus pivot): ChannelsScreen + ContinueWatchingCard —
// see src/deactivated/ and docs/deactivated-features.md.
import EmptyState from './EmptyState';

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
                    borderRadius: '10px',
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
            {Breadcrumb(V)}{' '}
            {V.notChannelsView ? (
              <React.Fragment>
                {' '}
                {TrashScreen(V)}{' '}
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
                      </div>{' '}
                    </div>{' '}
                  </React.Fragment>
                ) : null}{' '}
                {EmptyState(V)}{' '}
              </React.Fragment>
            ) : null}{' '}
          </div>{' '}
        </div>{' '}
        {MobileTabBar(V)}{' '}
      </div>{' '}
    </React.Fragment>
  ) : null;
}
