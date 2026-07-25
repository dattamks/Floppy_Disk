import React from 'react';
import { theme } from '../lib/theme';
import { hov } from '../lib/ui';

export default function PostCard({ V, p }) {
  return (
    <React.Fragment>
      {' '}
      <div
        style={{
          background: theme.white,
          border: `1px solid ${theme.border}`,
          borderRadius: '16px',
          padding: '14px 15px',
          display: 'flex',
          flexDirection: 'column',
          gap: '11px',
          boxShadow: '0 1px 2px rgba(16,24,40,0.03)',
        }}
      >
        {' '}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {' '}
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: p.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: theme.white,
              fontFamily: "'Space Grotesk',sans-serif",
              fontWeight: '700',
              fontSize: '13px',
              flex: '0 0 auto',
            }}
          >
            {p.initials}
          </div>{' '}
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: '0', flex: '1' }}>
            {' '}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ fontWeight: '600', fontSize: '13.5px' }}>{p.channelName}</span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill={theme.brand}>
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
            <span style={{ fontSize: '11px', color: theme.textFaint }}>
              {p.handle} · {p.time}
            </span>{' '}
          </div>{' '}
        </div>{' '}
        {p.hasText ? (
          <React.Fragment>
            <div style={{ fontSize: '13.5px', lineHeight: '1.5', color: theme.textSoft }}>
              {p.text}
            </div>
          </React.Fragment>
        ) : null}{' '}
        {p.isImage ? (
          <React.Fragment>
            <img
              ref={p.imgRef}
              onClick={p.onOpen}
              alt=""
              style={{
                width: '100%',
                maxHeight: '340px',
                objectFit: 'cover',
                borderRadius: '12px',
                cursor: 'pointer',
                background: theme.surface4,
              }}
            />
          </React.Fragment>
        ) : null}{' '}
        {p.isVideo ? (
          <React.Fragment>
            {' '}
            <div
              onClick={p.onOpen}
              style={{
                position: 'relative',
                borderRadius: '12px',
                overflow: 'hidden',
                cursor: 'pointer',
                background: theme.black,
              }}
            >
              {' '}
              <img
                ref={p.imgRef}
                alt=""
                style={{ width: '100%', maxHeight: '340px', objectFit: 'cover', display: 'block' }}
              />{' '}
              <div
                style={{
                  position: 'absolute',
                  inset: '0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(10,12,20,0.18)',
                }}
              >
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.92)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill={theme.text}>
                    <path d="M6 4l14 8-14 8V4Z" />
                  </svg>
                </div>
              </div>{' '}
              <div
                style={{
                  position: 'absolute',
                  bottom: '8px',
                  right: '8px',
                  background: 'rgba(10,12,20,0.72)',
                  borderRadius: '5px',
                  padding: '1px 7px',
                  fontSize: '10.5px',
                  color: theme.white,
                }}
              >
                {p.duration}
              </div>{' '}
            </div>{' '}
          </React.Fragment>
        ) : null}{' '}
        {p.isFile ? (
          <React.Fragment>
            {' '}
            <div
              onClick={p.onOpen}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '11px',
                background: theme.surface2,
                border: `1px solid ${theme.border}`,
                borderRadius: '11px',
                padding: '11px 13px',
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '9px',
                  background: theme.dangerBgSoft,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: '0 0 auto',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
                    fill={theme.white}
                    stroke={theme.danger}
                    strokeWidth="1.4"
                  />
                  <path d="M14 3v4h4" stroke={theme.danger} strokeWidth="1.4" />
                </svg>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: '0', flex: '1' }}>
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: '500',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {p.fileName}
                </span>
                <span style={{ fontSize: '11px', color: theme.textFaint }}>{p.fileSize}</span>
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14"
                  stroke={theme.textMuted}
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>{' '}
          </React.Fragment>
        ) : null}{' '}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            paddingTop: '3px',
            borderTop: `1px solid ${theme.surface}`,
            marginTop: '1px',
            paddingTop: '10px',
            flexWrap: 'wrap',
          }}
        >
          {' '}
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '11.5px',
              color: theme.textFaint,
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path
                d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
                stroke="currentColor"
                strokeWidth="1.6"
              />
              <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.6" />
            </svg>
            {p.views}
          </span>{' '}
          <button
            onClick={p.onLike}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '11.5px',
              color: p.likeColor,
              background: p.likeBg,
              border: 'none',
              borderRadius: '7px',
              cursor: 'pointer',
              padding: '5px 9px',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill={p.likeFill}>
              <path
                d="M12 20s-7-4.5-9.5-9C1 8 2.5 4.5 6 4.5c2 0 3.2 1.2 4 2.3.8-1.1 2-2.3 4-2.3 3.5 0 5 3.5 3.5 6.5C19 15.5 12 20 12 20Z"
                stroke={p.likeColor}
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
            {p.likes}
          </button>{' '}
          <button
            onClick={p.onShare}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '11.5px',
              color: theme.textMuted,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '5px 9px',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Share
          </button>{' '}
          <button
            onClick={p.onToggleComments}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '11.5px',
              color: theme.textMuted,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '5px 9px',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path
                d="M21 12a8 8 0 0 1-11.5 7.2L4 20l.8-5.5A8 8 0 1 1 21 12Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
            {p.commentCount}
          </button>{' '}
          <div style={{ flex: '1' }} />{' '}
          {p.isOwn ? (
            <React.Fragment>
              <button
                onClick={p.onDelete}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11.5px',
                  color: theme.danger,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '5px 8px',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
                Delete
              </button>
            </React.Fragment>
          ) : null}{' '}
          <button
            onClick={p.onFlag}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11.5px',
              color: theme.textFaint,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '5px 8px',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 21V4m0 0 8-1 6 2-2 5 2 5-6-2-8 1"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Flag
          </button>{' '}
          <button
            onClick={p.onReport}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11.5px',
              color: theme.danger,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '5px 8px',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
              <path
                d="M12 7.5v5M12 16h.01"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
            Report
          </button>{' '}
        </div>{' '}
        {p.commentsOpen ? (
          <React.Fragment>
            {' '}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '9px',
                borderTop: `1px solid ${theme.surface}`,
                paddingTop: '11px',
              }}
            >
              {' '}
              {(p.comments || []).map((c, $index) => (
                <React.Fragment key={$index}>
                  {' '}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <div
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '50%',
                        background: theme.border,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        fontWeight: '600',
                        color: theme.textMuted,
                        flex: '0 0 auto',
                      }}
                    >
                      {c.initial}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        background: theme.surface,
                        borderRadius: '10px',
                        padding: '7px 11px',
                        minWidth: '0',
                      }}
                    >
                      <span style={{ fontSize: '11.5px', fontWeight: '600' }}>{c.name}</span>
                      <span style={{ fontSize: '12.5px', color: theme.textSoft }}>{c.text}</span>
                    </div>
                  </div>{' '}
                </React.Fragment>
              ))}{' '}
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  value={V.commentInput}
                  onInput={V.setCommentInput}
                  placeholder="Add a comment…"
                  style={{
                    flex: '1',
                    background: theme.surface,
                    border: `1px solid ${theme.border}`,
                    borderRadius: '9px',
                    padding: '8px 11px',
                    fontSize: '12.5px',
                    outline: 'none',
                    fontFamily: "'IBM Plex Sans',sans-serif",
                  }}
                />
                <button
                  onClick={p.onAddComment}
                  style={{
                    background: theme.brand,
                    color: theme.white,
                    border: 'none',
                    borderRadius: '9px',
                    padding: '0 14px',
                    fontSize: '12.5px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Send
                </button>
              </div>{' '}
            </div>{' '}
          </React.Fragment>
        ) : null}{' '}
      </div>{' '}
    </React.Fragment>
  );
}
