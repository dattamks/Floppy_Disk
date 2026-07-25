import React from 'react';
import { theme } from '../lib/theme';
import { hov } from '../lib/ui';
import FileCard from './FileCard';
import ContinueWatchingCard from './ContinueWatchingCard';
import TopBarDesktop from './TopBarDesktop';
import Sidebar from './Sidebar';
import Breadcrumb from './Breadcrumb';
import TopBarMobile from './TopBarMobile';
import MobileTabBar from './MobileTabBar';
import ChannelsScreen from './ChannelsScreen';
import TrashScreen from './TrashScreen';
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
                    placeholder="Search files, folders, channels"
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
            {Breadcrumb(V)} {ChannelsScreen(V)}{' '}
            {V.notChannelsView ? (
              <React.Fragment>
                {' '}
                {V.showSearchChannels ? (
                  <React.Fragment>
                    {' '}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
                      {' '}
                      <span
                        style={{
                          fontFamily: "'Space Grotesk',sans-serif",
                          fontWeight: '600',
                          fontSize: '15px',
                        }}
                      >
                        Channels
                      </span>{' '}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                        {' '}
                        {(V.searchChannelResults || []).map((ch, $index) => (
                          <React.Fragment key={$index}>
                            {' '}
                            <div
                              style={{
                                width: '168px',
                                background: theme.white,
                                border: `1px solid ${theme.border}`,
                                borderRadius: '14px',
                                padding: '14px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '8px',
                              }}
                            >
                              {' '}
                              <div
                                style={{
                                  width: '44px',
                                  height: '44px',
                                  borderRadius: '50%',
                                  background: ch.color,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: theme.white,
                                  fontFamily: "'Space Grotesk',sans-serif",
                                  fontWeight: '700',
                                  fontSize: '15px',
                                }}
                              >
                                {ch.initials}
                              </div>{' '}
                              <span
                                style={{
                                  fontSize: '13px',
                                  fontWeight: '600',
                                  textAlign: 'center',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  maxWidth: '100%',
                                }}
                              >
                                {ch.name}
                              </span>{' '}
                              <span style={{ fontSize: '10.5px', color: theme.textFaint }}>
                                {ch.subs} subscribers
                              </span>{' '}
                              <button
                                onClick={ch.onToggle}
                                style={{
                                  width: '100%',
                                  border: `1px solid ${ch.subBorder}`,
                                  background: ch.subBg,
                                  color: ch.subColor,
                                  borderRadius: '8px',
                                  padding: '6px',
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  cursor: 'pointer',
                                  fontFamily: "'IBM Plex Sans',sans-serif",
                                }}
                              >
                                {ch.subLabel}
                              </button>{' '}
                            </div>{' '}
                          </React.Fragment>
                        ))}{' '}
                      </div>{' '}
                    </div>{' '}
                  </React.Fragment>
                ) : null}{' '}
                {V.showCarousel ? (
                  <React.Fragment>
                    {' '}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
                      {' '}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            fontFamily: "'Space Grotesk',sans-serif",
                            fontWeight: '600',
                            fontSize: '15px',
                          }}
                        >
                          Continue watching
                        </span>
                        <span style={{ fontSize: '11px', color: theme.textFaint }}>
                          — swipe to browse
                        </span>
                      </div>{' '}
                      <div
                        className="fd-carousel"
                        style={{
                          display: 'flex',
                          gap: '13px',
                          overflowX: 'auto',
                          paddingBottom: '4px',
                          scrollSnapType: 'x mandatory',
                        }}
                      >
                        {' '}
                        {(V.carouselItems || []).map((c, $index) => (
                          <ContinueWatchingCard key={$index} V={V} c={c} />
                        ))}{' '}
                      </div>{' '}
                    </div>{' '}
                  </React.Fragment>
                ) : null}{' '}
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
