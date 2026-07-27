import React from 'react';
import { theme } from '../lib/theme';
import { hov } from '../lib/ui';

// Compact list-view row (alternative to FileCard's grid tile).
export default function FileRow({ V, file }) {
  return (
    <div
      onClick={file.onOpen}
      onContextMenu={file.onCtxMenu}
      {...hov({ background: theme.surface })}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '9px 12px',
        borderRadius: '9px',
        cursor: 'pointer',
        background: theme.white,
        border: `1px solid ${theme.border}`,
      }}
    >
      <div
        style={{
          width: '30px',
          height: '30px',
          borderRadius: '7px',
          flex: '0 0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: file.isFolder
            ? theme.brandBg
            : file.isDoc
              ? theme.dangerBgSoft
              : theme.tealBg,
          color: file.isFolder ? theme.brand : file.isDoc ? theme.danger : theme.teal,
        }}
      >
        {file.isFolder ? (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <path
              d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
              stroke="currentColor"
              strokeWidth="1.7"
            />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M6 3h8l4 4v14H6V3Z"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinejoin="round"
            />
            <path d="M14 3v4h4" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <span
        style={{
          flex: '1',
          fontSize: '13.5px',
          fontWeight: '500',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {file.name}
      </span>
      <span
        style={{
          flex: '0 0 auto',
          fontSize: '11.5px',
          color: theme.textFaint,
          width: '140px',
          textAlign: 'right',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {file.metaLine}
      </span>
      <button
        onClick={file.onCtxMenu}
        aria-label="More actions"
        title="More actions"
        style={{
          flex: '0 0 auto',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: theme.textMuted2,
          padding: '4px',
          display: 'flex',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="19" cy="12" r="1.6" />
        </svg>
      </button>
    </div>
  );
}
