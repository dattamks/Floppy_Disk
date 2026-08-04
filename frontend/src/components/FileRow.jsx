import React from 'react';
import { theme } from '../lib/theme';
import { hov, longPress } from '../lib/ui';
import FileGlyph from './FileGlyph';

// Compact list-view row (alternative to FileCard's grid tile).
export default function FileRow({ V, file }) {
  const lp = longPress(file.onCtxMenu); // touch long-press -> context menu
  return (
    <div
      onClick={file.onOpen}
      onContextMenu={file.onCtxMenu}
      role="button"
      tabIndex={0}
      aria-label={`Open ${file.name}`}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          if (file.onOpen) file.onOpen(e);
        }
      }}
      {...lp}
      draggable={file.draggable}
      onDragStart={file.onDragStart}
      onDragEnd={file.onDragEnd}
      onDragOver={file.isDropTarget ? file.onDragOver : undefined}
      onDragLeave={file.isDropTarget ? file.onDragLeave : undefined}
      onDrop={file.isDropTarget ? file.onDrop : undefined}
      {...hov({ background: theme.surface })}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '9px 12px',
        borderRadius: '9px',
        cursor: 'pointer',
        background: file.selected || file.isDragOver ? theme.brandBg : theme.white,
        border: `1px solid ${file.selected || file.isDragOver ? theme.brand : theme.border}`,
      }}
    >
      {file.selectable ? (
        <button
          onClick={file.onToggleSelect}
          aria-label={file.selected ? 'Deselect' : 'Select'}
          style={{
            width: '20px',
            height: '20px',
            flex: '0 0 auto',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: file.selected ? theme.brand : theme.white,
            border: `1px solid ${file.selected ? theme.brand : theme.border}`,
            color: '#fff',
          }}
        >
          {file.selected ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 12l4 4 10-10"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : null}
        </button>
      ) : null}
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
            : file.isDoc && file.docType
              ? file.docType.color + '14'
              : theme.tealBg,
          color: file.isFolder ? theme.brand : file.isDoc && file.docType ? file.docType.color : theme.teal,
          overflow: 'hidden',
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
        ) : file.showThumb && file.imgRef ? (
          <img
            ref={file.imgRef}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : file.isDoc && file.docType ? (
          <FileGlyph kind={file.docType.key} color={file.docType.color} ext="" size={18} />
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
          color: theme.textMuted,
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
