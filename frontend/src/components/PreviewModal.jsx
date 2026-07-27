import React from 'react';
import { theme } from '../lib/theme';
import { highlightJson, highlightYaml } from '../lib/highlight';

// Inline viewers for a file's own content: image, PDF, audio, Markdown, JSON,
// YAML, and plain text/code. Real uploads fetch a same-origin URL (and text
// content) in App.openFile; demo files carry hardcoded URLs.
const codeBoxStyle = {
  width: '100%',
  maxHeight: '360px',
  overflow: 'auto',
  margin: '0',
  padding: '14px',
  border: `1px solid ${theme.border}`,
  borderRadius: '11px',
  background: theme.surface,
  fontFamily: "'IBM Plex Mono','SFMono-Regular',Menlo,monospace",
  fontSize: '12.5px',
  lineHeight: '1.55',
  color: theme.text,
  whiteSpace: 'pre',
};

function Body(V) {
  const f = V.activeFile;
  if (V.previewLoading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: theme.textMuted }}>Loading…</div>
    );
  }
  if (V.previewError) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: theme.danger }}>
        {V.previewError}
      </div>
    );
  }
  if (V.isEditing) {
    return (
      <textarea
        value={V.editText}
        onInput={V.setEditText}
        spellCheck={false}
        style={{
          width: '100%',
          minHeight: '340px',
          resize: 'vertical',
          padding: '14px',
          border: `1px solid ${theme.brand}`,
          borderRadius: '11px',
          background: theme.white,
          color: theme.text,
          fontFamily: "'IBM Plex Mono','SFMono-Regular',Menlo,monospace",
          fontSize: '12.5px',
          lineHeight: '1.55',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
    );
  }
  const k = V.previewKind;
  if (k === 'image') {
    const arrow = (onClick, side, glyph) => (
      <button
        onClick={onClick}
        aria-label={side === 'left' ? 'Previous image' : 'Next image'}
        style={{
          position: 'absolute',
          top: '50%',
          [side]: '10px',
          transform: 'translateY(-50%)',
          width: '34px',
          height: '34px',
          borderRadius: '50%',
          border: 'none',
          cursor: 'pointer',
          background: 'rgba(10,12,20,0.55)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path
            d={glyph}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    );
    return (
      <div style={{ position: 'relative' }}>
        <img
          src={V.previewUrl}
          alt={f.name}
          style={{
            width: '100%',
            maxHeight: '360px',
            objectFit: 'contain',
            borderRadius: '11px',
            background: theme.surface4,
          }}
        />
        {V.previewHasPrev ? arrow(V.previewPrev, 'left', 'M15 6l-6 6 6 6') : null}
        {V.previewHasNext ? arrow(V.previewNext, 'right', 'M9 6l6 6-6 6') : null}
        {V.previewCounter ? (
          <span
            style={{
              position: 'absolute',
              bottom: '10px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(10,12,20,0.66)',
              color: '#fff',
              fontSize: '11px',
              borderRadius: '999px',
              padding: '2px 9px',
            }}
          >
            {V.previewCounter}
          </span>
        ) : null}
      </div>
    );
  }
  if (k === 'pdf') {
    return (
      <iframe
        title={f.name}
        src={V.previewUrl}
        style={{
          width: '100%',
          height: '460px',
          border: `1px solid ${theme.border}`,
          borderRadius: '11px',
          background: theme.surface,
        }}
      />
    );
  }
  if (k === 'audio') {
    return (
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
        <audio controls src={V.previewUrl} style={{ width: '100%' }} />
      </div>
    );
  }
  if (k === 'markdown') {
    return (
      <div className="md-body">
        <style>{`
          .md-body{max-height:360px;overflow:auto;padding:16px;border:1px solid ${theme.border};border-radius:11px;background:${theme.white};color:${theme.text};font-size:13.5px;line-height:1.6;}
          .md-body h1,.md-body h2,.md-body h3{font-family:'Space Grotesk',sans-serif;margin:0.6em 0 0.35em;line-height:1.25;}
          .md-body h1{font-size:1.5em;} .md-body h2{font-size:1.28em;} .md-body h3{font-size:1.1em;}
          .md-body p{margin:0.5em 0;} .md-body ul,.md-body ol{margin:0.5em 0;padding-left:1.4em;}
          .md-body li{margin:0.2em 0;}
          .md-body code{background:${theme.surface};padding:1px 5px;border-radius:5px;font-family:'IBM Plex Mono',monospace;font-size:0.9em;}
          .md-body pre.md-pre{background:${theme.surface};padding:12px;border-radius:9px;overflow:auto;border:1px solid ${theme.border};}
          .md-body pre.md-pre code{background:none;padding:0;}
          .md-body blockquote{margin:0.5em 0;padding:2px 12px;border-left:3px solid ${theme.border};color:${theme.textMuted};}
          .md-body a{color:${theme.brand};} .md-body hr{border:none;border-top:1px solid ${theme.border};margin:0.8em 0;}
        `}</style>
        <div dangerouslySetInnerHTML={{ __html: V.previewHtml }} />
      </div>
    );
  }
  if (k === 'json' || k === 'yaml' || k === 'text') {
    const html =
      k === 'json'
        ? highlightJson(V.previewCode)
        : k === 'yaml'
          ? highlightYaml(V.previewCode)
          : null;
    if (html) {
      return (
        <React.Fragment>
          <style>{`
            .code-hl .tok-key{color:${theme.brand};}
            .code-hl .tok-str{color:${theme.teal};}
            .code-hl .tok-num{color:${theme.violet};}
            .code-hl .tok-kw{color:${theme.danger};}
            .code-hl .tok-comment{color:${theme.textFaint};font-style:italic;}
          `}</style>
          <pre
            className="code-hl"
            style={codeBoxStyle}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </React.Fragment>
      );
    }
    return <pre style={codeBoxStyle}>{V.previewCode}</pre>;
  }
  // Generic: no inline viewer for this type — offer download.
  return (
    <div
      style={{
        padding: '40px',
        textAlign: 'center',
        color: theme.textMuted,
        border: `1px dashed ${theme.border}`,
        borderRadius: '11px',
      }}
    >
      No inline preview for this file type. Use Download to open it.
    </div>
  );
}

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
          aria-label="Close"
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
      {Body(V)}{' '}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
        }}
      >
        <span style={{ fontSize: '11.5px', color: theme.textFaint }}>{V.activeFile.metaLine}</span>
        {V.isEditing ? (
          <div style={{ display: 'flex', gap: '8px', flex: '0 0 auto' }}>
            <button
              onClick={V.onCancelEdit}
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
              Cancel
            </button>
            <button
              onClick={V.onSaveEdit}
              disabled={V.editSaving}
              style={{
                background: theme.brand,
                color: theme.white,
                border: 'none',
                borderRadius: '9px',
                padding: '0 16px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: V.editSaving ? 'default' : 'pointer',
                opacity: V.editSaving ? 0.7 : 1,
              }}
            >
              {V.editSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '8px', flex: '0 0 auto' }}>
            <button
              onClick={V.activeFile.onToggleStar}
              aria-label={V.activeFile.starred ? 'Unstar' : 'Star'}
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
            {V.canEdit ? (
              <button
                onClick={V.onStartEdit}
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
                Edit
              </button>
            ) : null}
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
        )}
      </div>{' '}
    </React.Fragment>
  ) : null;
}
