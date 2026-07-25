import React from 'react';
import { theme } from '../lib/theme';
import { hov } from '../lib/ui';
import CategoryChip from './CategoryChip';
import ChannelGridCard from './ChannelGridCard';
import SubscribedChip from './SubscribedChip';
import ChannelDetailPost from './ChannelDetailPost';
import TrendingCard from './TrendingCard';
import ChannelRow from './ChannelRow';
import PostCard from './PostCard';

// Extracted from AppShell; renders when V.isChannelsView is set.
export default function ChannelsScreen(V) {
  return V.isChannelsView ? (
    <React.Fragment>
      {' '}
      {V.showChannelBrowse ? (
        <React.Fragment>
          {' '}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '660px' }}>
            {' '}
            <div
              style={{
                display: 'inline-flex',
                background: theme.surface3,
                borderRadius: '10px',
                padding: '3px',
                gap: '2px',
                alignSelf: 'flex-start',
              }}
            >
              {' '}
              <button
                onClick={V.setTabDiscover}
                style={{
                  border: 'none',
                  borderRadius: '8px',
                  padding: '7px 18px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontFamily: "'IBM Plex Sans',sans-serif",
                  background: V.discoverTabBg,
                  color: V.discoverTabColor,
                  boxShadow: V.discoverTabShadow,
                }}
              >
                Discover
              </button>{' '}
              <button
                onClick={V.setTabSubscribed}
                style={{
                  border: 'none',
                  borderRadius: '8px',
                  padding: '7px 18px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontFamily: "'IBM Plex Sans',sans-serif",
                  background: V.subscribedTabBg,
                  color: V.subscribedTabColor,
                  boxShadow: V.subscribedTabShadow,
                }}
              >
                Subscribed
              </button>{' '}
            </div>{' '}
            {V.isDiscoverTab ? (
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
                    padding: '9px 13px',
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
                    value={V.discoverQuery}
                    onInput={V.setDiscoverQuery}
                    placeholder="Search channels, handles, categories"
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
                  {V.discoverQueryActive ? (
                    <React.Fragment>
                      <button
                        onClick={V.clearDiscoverQuery}
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
                <div
                  className="fd-carousel"
                  style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '2px' }}
                >
                  {' '}
                  {(V.categoryChips || []).map((cat, $index) => (
                    <CategoryChip key={$index} V={V} cat={cat} />
                  ))}{' '}
                </div>{' '}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {' '}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {' '}
                    <span
                      style={{
                        fontFamily: "'Space Grotesk',sans-serif",
                        fontWeight: '600',
                        fontSize: '15px',
                        flex: '1',
                      }}
                    >
                      Trending
                    </span>{' '}
                    <div
                      style={{
                        display: 'inline-flex',
                        background: theme.surface3,
                        borderRadius: '9px',
                        padding: '2px',
                        gap: '2px',
                      }}
                    >
                      {' '}
                      <button
                        onClick={V.setSortLikes}
                        style={{
                          border: 'none',
                          borderRadius: '7px',
                          padding: '5px 11px',
                          fontSize: '11.5px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          background: V.likesSortActive ? theme.brand : 'transparent',
                          color: V.likesSortActive ? theme.white : theme.textMuted,
                          boxShadow: V.likesSortActive ? '0 1px 3px rgba(81,69,229,0.4)' : 'none',
                        }}
                      >
                        Liked
                      </button>{' '}
                      <button
                        onClick={V.setSortViews}
                        style={{
                          border: 'none',
                          borderRadius: '7px',
                          padding: '5px 11px',
                          fontSize: '11.5px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          background: V.viewsSortActive ? theme.brand : 'transparent',
                          color: V.viewsSortActive ? theme.white : theme.textMuted,
                          boxShadow: V.viewsSortActive ? '0 1px 3px rgba(81,69,229,0.4)' : 'none',
                        }}
                      >
                        Viewed
                      </button>{' '}
                      <button
                        onClick={V.setSortShares}
                        style={{
                          border: 'none',
                          borderRadius: '7px',
                          padding: '5px 11px',
                          fontSize: '11.5px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          background: V.sharesSortActive ? theme.brand : 'transparent',
                          color: V.sharesSortActive ? theme.white : theme.textMuted,
                          boxShadow: V.sharesSortActive ? '0 1px 3px rgba(81,69,229,0.4)' : 'none',
                        }}
                      >
                        Shared
                      </button>{' '}
                    </div>{' '}
                  </div>{' '}
                  <div
                    className="fd-carousel"
                    style={{
                      display: 'flex',
                      gap: '12px',
                      overflowX: 'auto',
                      paddingBottom: '4px',
                    }}
                  >
                    {' '}
                    {(V.trendingCards || []).map((t, $index) => (
                      <TrendingCard key={$index} V={V} t={t} />
                    ))}{' '}
                  </div>{' '}
                </div>{' '}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {' '}
                  <span
                    style={{
                      fontFamily: "'Space Grotesk',sans-serif",
                      fontWeight: '600',
                      fontSize: '15px',
                      flex: '1',
                    }}
                  >
                    Browse channels
                  </span>{' '}
                  <button
                    onClick={V.openNewChannel}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      border: `1px solid ${theme.brandBorder}`,
                      background: theme.brandBgSoft,
                      color: theme.brand,
                      borderRadius: '8px',
                      padding: '7px 11px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      fontFamily: "'IBM Plex Sans',sans-serif",
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 5v14M5 12h14"
                        stroke={theme.brand}
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                    New
                  </button>{' '}
                  <button
                    onClick={V.setDiscoverList}
                    title="List view"
                    style={{
                      width: '32px',
                      height: '32px',
                      border: `1px solid ${V.listViewBorder}`,
                      background: V.listViewBg,
                      color: V.listViewColor,
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"
                        stroke="currentColor"
                        strokeWidth="1.9"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>{' '}
                  <button
                    onClick={V.setDiscoverGrid}
                    title="Grid view"
                    style={{
                      width: '32px',
                      height: '32px',
                      border: `1px solid ${V.gridViewBorder}`,
                      background: V.gridViewBg,
                      color: V.gridViewColor,
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                      <rect
                        x="4"
                        y="4"
                        width="7"
                        height="7"
                        rx="1.5"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      />
                      <rect
                        x="13"
                        y="4"
                        width="7"
                        height="7"
                        rx="1.5"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      />
                      <rect
                        x="4"
                        y="13"
                        width="7"
                        height="7"
                        rx="1.5"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      />
                      <rect
                        x="13"
                        y="13"
                        width="7"
                        height="7"
                        rx="1.5"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      />
                    </svg>
                  </button>{' '}
                </div>{' '}
                {V.isDiscoverList ? (
                  <React.Fragment>
                    {' '}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {' '}
                      {(V.channelListRows || []).map((ch, $index) => (
                        <ChannelRow key={$index} V={V} ch={ch} />
                      ))}{' '}
                      {V.discoverEmpty ? (
                        <React.Fragment>
                          <div
                            style={{
                              textAlign: 'center',
                              color: theme.textFainter,
                              fontSize: '13px',
                              padding: '28px 0',
                            }}
                          >
                            No channels match your filters
                          </div>
                        </React.Fragment>
                      ) : null}{' '}
                    </div>{' '}
                  </React.Fragment>
                ) : null}{' '}
                {V.isDiscoverGrid ? (
                  <React.Fragment>
                    {' '}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                        gap: '12px',
                      }}
                    >
                      {' '}
                      {(V.channelListRows || []).map((ch, $index) => (
                        <ChannelGridCard key={$index} V={V} ch={ch} />
                      ))}{' '}
                      {V.discoverEmpty ? (
                        <React.Fragment>
                          <div
                            style={{
                              gridColumn: '1/-1',
                              textAlign: 'center',
                              color: theme.textFainter,
                              fontSize: '13px',
                              padding: '28px 0',
                            }}
                          >
                            No channels match your filters
                          </div>
                        </React.Fragment>
                      ) : null}{' '}
                    </div>{' '}
                  </React.Fragment>
                ) : null}{' '}
              </React.Fragment>
            ) : null}{' '}
            {V.isSubscribedTab ? (
              <React.Fragment>
                {' '}
                {V.hasSubscribed ? (
                  <React.Fragment>
                    {' '}
                    <div
                      className="fd-carousel"
                      style={{
                        display: 'flex',
                        gap: '16px',
                        overflowX: 'auto',
                        paddingBottom: '4px',
                      }}
                    >
                      {' '}
                      {(V.subscribedChips || []).map((ch, $index) => (
                        <SubscribedChip key={$index} V={V} ch={ch} />
                      ))}{' '}
                    </div>{' '}
                  </React.Fragment>
                ) : null}{' '}
                {V.showComposerBtn ? (
                  <React.Fragment>
                    {' '}
                    <button
                      onClick={V.openComposer}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        background: theme.white,
                        border: `1.5px dashed ${theme.brandBorder}`,
                        borderRadius: '12px',
                        padding: '13px',
                        fontSize: '13.5px',
                        fontWeight: '600',
                        color: theme.brand,
                        cursor: 'pointer',
                        fontFamily: "'IBM Plex Sans',sans-serif",
                      }}
                      {...hov({ background: theme.brandBgSoft })}
                    >
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M12 5v14M5 12h14"
                          stroke={theme.brand}
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                      Post to {V.adminChannelName}
                    </button>{' '}
                  </React.Fragment>
                ) : null}{' '}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {' '}
                  {(V.posts || []).map((p, $index) => (
                    <PostCard key={$index} V={V} p={p} />
                  ))}{' '}
                  {V.postsEmpty ? (
                    <React.Fragment>
                      <div
                        style={{
                          textAlign: 'center',
                          color: theme.textFainter,
                          fontSize: '13.5px',
                          padding: '40px 0',
                        }}
                      >
                        No posts yet — subscribe to channels to see their updates.
                      </div>
                    </React.Fragment>
                  ) : null}{' '}
                </div>{' '}
              </React.Fragment>
            ) : null}{' '}
          </div>{' '}
        </React.Fragment>
      ) : null}{' '}
      {V.showChannelDetail ? (
        <React.Fragment>
          {' '}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '660px' }}>
            {' '}
            <button
              onClick={V.closeChannelView}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'none',
                border: 'none',
                color: theme.textMuted,
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                padding: '0',
                alignSelf: 'flex-start',
                fontFamily: "'IBM Plex Sans',sans-serif",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M15 5l-7 7 7 7"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Back to channels
            </button>{' '}
            <div
              style={{
                background: theme.white,
                border: `1px solid ${theme.border}`,
                borderRadius: '16px',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                boxShadow: '0 1px 2px rgba(16,24,40,0.03)',
              }}
            >
              {' '}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                {' '}
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: V.cdColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: theme.white,
                    fontFamily: "'Space Grotesk',sans-serif",
                    fontWeight: '700',
                    fontSize: '22px',
                    flex: '0 0 auto',
                    position: 'relative',
                  }}
                >
                  {V.cdInitials}
                  {V.cdLive ? (
                    <React.Fragment>
                      <span
                        style={{
                          position: 'absolute',
                          bottom: '-3px',
                          background: theme.danger,
                          color: theme.white,
                          fontSize: '8px',
                          fontWeight: '700',
                          borderRadius: '5px',
                          padding: '1px 5px',
                          border: `2px solid ${theme.white}`,
                        }}
                      >
                        LIVE
                      </span>
                    </React.Fragment>
                  ) : null}
                </div>{' '}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '3px',
                    minWidth: '0',
                    flex: '1',
                  }}
                >
                  {' '}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        fontFamily: "'Space Grotesk',sans-serif",
                        fontWeight: '700',
                        fontSize: '18px',
                      }}
                    >
                      {V.cdName}
                    </span>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill={theme.brand}>
                      <path d="M12 2l2.4 1.8 3-.3 1 2.8 2.6 1.5-.9 2.9.9 2.9-2.6 1.5-1 2.8-3-.3L12 22l-2.4-1.8-3 .3-1-2.8L3 16.5l.9-2.9L3 10.6l2.6-1.5 1-2.8 3 .3L12 2Z" />
                      <path
                        d="M9 12l2 2 4-4"
                        stroke={theme.white}
                        strokeWidth="1.6"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>{' '}
                  <span style={{ fontSize: '12.5px', color: theme.textFaint }}>
                    {V.cdHandle} · {V.cdSubs} subscribers · {V.cdCategory}
                  </span>{' '}
                </div>{' '}
              </div>{' '}
              <div style={{ display: 'flex', gap: '8px' }}>
                {' '}
                <button
                  onClick={V.cdOnToggle}
                  style={{
                    flex: '1',
                    border: `1px solid ${V.cdSubBorder}`,
                    background: V.cdSubBg,
                    color: V.cdSubColor,
                    borderRadius: '9px',
                    padding: '9px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontFamily: "'IBM Plex Sans',sans-serif",
                  }}
                >
                  {V.cdSubLabel}
                </button>{' '}
                {V.cdIsAdmin ? (
                  <React.Fragment>
                    <button
                      onClick={V.cdOnCompose}
                      style={{
                        flex: '0 0 auto',
                        border: `1px solid ${theme.brandBorder}`,
                        background: theme.brandBgSoft,
                        color: theme.brand,
                        borderRadius: '9px',
                        padding: '9px 14px',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontFamily: "'IBM Plex Sans',sans-serif",
                      }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M12 5v14M5 12h14"
                          stroke={theme.brand}
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                      Post
                    </button>
                  </React.Fragment>
                ) : null}{' '}
                {V.cdIsAdmin ? (
                  <React.Fragment>
                    <button
                      onClick={V.cdOnSettings}
                      style={{
                        width: '38px',
                        flex: '0 0 auto',
                        border: `1px solid ${theme.border}`,
                        background: theme.surface2,
                        borderRadius: '9px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="3" stroke={theme.textMuted} strokeWidth="1.7" />
                        <path
                          d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.3 1a7 7 0 0 0-1.7-1l-.3-2.6h-4l-.3 2.6a7 7 0 0 0-1.7 1l-2.3-1-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 1.7 1l.3 2.6h4l.3-2.6a7 7 0 0 0 1.7-1l2.3 1 2-3.4-2-1.5c.1-.3.1-.7.1-1Z"
                          stroke={theme.textMuted}
                          strokeWidth="1.3"
                        />
                      </svg>
                    </button>
                  </React.Fragment>
                ) : null}{' '}
              </div>{' '}
            </div>{' '}
            <span
              style={{
                fontFamily: "'Space Grotesk',sans-serif",
                fontWeight: '600',
                fontSize: '15px',
              }}
            >
              Posts
            </span>{' '}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {' '}
              {(V.channelPosts || []).map((p, $index) => (
                <ChannelDetailPost key={$index} V={V} p={p} />
              ))}{' '}
              {V.channelPostsEmpty ? (
                <React.Fragment>
                  <div
                    style={{
                      textAlign: 'center',
                      color: theme.textFainter,
                      fontSize: '13px',
                      padding: '32px 0',
                    }}
                  >
                    No posts in this channel yet
                  </div>
                </React.Fragment>
              ) : null}{' '}
            </div>{' '}
          </div>{' '}
        </React.Fragment>
      ) : null}{' '}
    </React.Fragment>
  ) : null;
}
