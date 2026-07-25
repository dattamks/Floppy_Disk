import React from 'react';
import { theme } from '../lib/theme';
import { hov } from '../lib/ui';

// Extracted from the design view; renders when V.isPreviewModal is set.
export default function PreviewModal(V) {
  return V.isPreviewModal ? (
    <React.Fragment>
      {' '}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
        }}
      >
        <span
          style={{
            fontFamily: "'Space Grotesk',sans-serif",
            fontWeight: '600',
            fontSize: '16px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {V.activeFile.name}
        </span>
        <button
          onClick={V.closeModal}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: theme.textMuted2,
            flex: '0 0 auto',
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 5l14 14M19 5L5 19"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>{' '}
      {V.activeFile.isImage ? (
        <React.Fragment>
          <img
            ref={V.posterRef}
            alt=""
            style={{
              width: '100%',
              height: '300px',
              objectFit: 'cover',
              borderRadius: '11px',
              background: theme.surface4,
            }}
          />
        </React.Fragment>
      ) : null}{' '}
      {V.activeFile.isDoc ? (
        <React.Fragment>
          <iframe
            src={V.activeFile.docUrl}
            style={{
              width: '100%',
              height: '300px',
              border: `1px solid ${theme.border}`,
              borderRadius: '11px',
              background: theme.surface,
            }}
          />
        </React.Fragment>
      ) : null}{' '}
      {V.activeFile.isAudio ? (
        <React.Fragment>
          <div
            style={{
              height: '150px',
              borderRadius: '11px',
              background: theme.surface,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px',
              padding: '0 20px',
            }}
          >
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 15V9m4 9V6m4 12V4m4 14v-7m4 5v-3"
                stroke={theme.teal}
                strokeWidth="1.9"
                strokeLinecap="round"
              />
            </svg>
            <audio controls ref={V.audioRef} style={{ width: '100%' }} />
          </div>
        </React.Fragment>
      ) : null}{' '}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
        }}
      >
        <span style={{ fontSize: '11.5px', color: theme.textFaint }}>{V.activeFile.metaLine}</span>
        <div style={{ display: 'flex', gap: '8px', flex: '0 0 auto' }}>
          <button
            onClick={V.activeFile.onToggleStar}
            style={{
              background: theme.surface,
              border: `1px solid ${theme.border}`,
              borderRadius: '9px',
              width: '34px',
              height: '34px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill={V.activeFile.starFill}>
              <path
                d="M12 3l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.2-5.4 3.2 1.3-6-4.6-4.1 6.1-.6L12 3Z"
                stroke={V.activeFile.starStroke}
                strokeWidth="1.3"
              />
            </svg>
          </button>
          <button
            onClick={V.downloadActive}
            style={{
              background: theme.surface,
              border: `1px solid ${theme.border}`,
              color: theme.text,
              borderRadius: '9px',
              padding: '0 14px',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            Download
          </button>{' '}
          <button
            onClick={V.deleteActive}
            style={{
              background: theme.dangerBgSoft,
              border: `1px solid ${theme.dangerBorder2}`,
              color: theme.danger,
              borderRadius: '9px',
              padding: '0 14px',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            Delete
          </button>
          <button
            onClick={V.openShareForActive}
            style={{
              background: theme.brand,
              color: theme.white,
              border: 'none',
              borderRadius: '9px',
              padding: '0 16px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Share
          </button>
        </div>
      </div>{' '}
    </React.Fragment>
  ) : null;
}
