import React from 'react';
import { theme } from '../lib/theme';
import { swipeX } from '../lib/ui';
import { highlightJson, highlightYaml, highlightCode } from '../lib/highlight';

// The WYSIWYG editor pulls in TipTap/ProseMirror (~160KB gzip); load it lazily
// so it only reaches users who actually open a note, keeping the app's initial
// bundle small.
const NoteEditor = React.lazy(() => import('./NoteEditor'));

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

// Shared rendered-Markdown styling, reused by the read view and the live editor.
const mdCss = () => `
  .md-body{max-height:360px;overflow:auto;padding:16px;border:1px solid ${theme.border};border-radius:11px;background:${theme.white};color:${theme.text};font-size:13.5px;line-height:1.6;}
  .md-body h1,.md-body h2,.md-body h3{font-family:'Space Grotesk',sans-serif;margin:0.6em 0 0.35em;line-height:1.25;}
  .md-body h1{font-size:1.5em;} .md-body h2{font-size:1.28em;} .md-body h3{font-size:1.1em;}
  .md-body p{margin:0.5em 0;} .md-body ul,.md-body ol{margin:0.5em 0;padding-left:1.4em;}
  .md-body li{margin:0.2em 0;}
  .md-body li.md-task{list-style:none;margin-left:-1.25em;display:flex;align-items:flex-start;gap:7px;}
  .md-body li.md-task input{margin:0.28em 0 0;flex:0 0 auto;accent-color:${theme.brand};}
  .md-body code{background:${theme.surface};padding:1px 5px;border-radius:5px;font-family:'IBM Plex Mono',monospace;font-size:0.9em;}
  .md-body pre.md-pre{background:${theme.surface};padding:12px;border-radius:9px;overflow:auto;border:1px solid ${theme.border};}
  .md-body pre.md-pre code{background:none;padding:0;}
  .md-body blockquote{margin:0.5em 0;padding:2px 12px;border-left:3px solid ${theme.border};color:${theme.textMuted};}
  .md-body a{color:${theme.brand};} .md-body hr{border:none;border-top:1px solid ${theme.border};margin:0.8em 0;}
`;

export function PreviewBody(V) {
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
    const onSaveKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        if (!V.editSaving) V.onSaveEdit();
      }
    };
    // Raw textarea - used for plain text files, and the "Markdown" tab of a note.
    const rawEditor = (
      <textarea
        value={V.editText}
        onInput={V.setEditText}
        onKeyDown={onSaveKey}
        autoFocus={!V.isNote}
        spellCheck={false}
        style={{
          flex: '1 1 auto',
          width: '100%',
          minHeight: V.isNote ? '240px' : '360px',
          resize: V.isNote ? 'none' : 'vertical',
          padding: '16px',
          border: `1px solid ${theme.brand}`,
          borderRadius: '11px',
          background: theme.white,
          color: theme.text,
          fontFamily: "'IBM Plex Mono','SFMono-Regular',Menlo,monospace",
          fontSize: '13px',
          lineHeight: '1.65',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
    );

    // Plain (non-note) text file: single raw editor, no tabs.
    if (!V.isNote) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: '1 1 auto', minHeight: 0 }}>
          {rawEditor}
        </div>
      );
    }

    // Note: title + Write | Markdown | Preview tabs (one pane at a time).
    const view = V.noteView || 'write';
    const tab = (id, label) => (
      <button
        key={id}
        type="button"
        onClick={() => V.setNoteView(id)}
        style={{
          padding: '6px 14px',
          borderRadius: '8px',
          border: 'none',
          background: view === id ? theme.white : 'transparent',
          color: view === id ? theme.brand : theme.textMuted,
          fontWeight: '600',
          fontSize: '13px',
          cursor: 'pointer',
          boxShadow: view === id ? '0 1px 3px rgba(16,24,40,0.12)' : 'none',
          fontFamily: "'IBM Plex Sans',sans-serif",
        }}
      >
        {label}
      </button>
    );
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: '1 1 auto', minHeight: 0 }}>
        <input
          value={V.editName}
          onInput={V.setEditName}
          onKeyDown={onSaveKey}
          aria-label="Note title"
          placeholder="Untitled note"
          style={{
            width: '100%',
            padding: '10px 12px',
            border: `1px solid ${theme.border}`,
            borderRadius: '9px',
            background: theme.surface,
            color: theme.text,
            fontFamily: "'Space Grotesk',sans-serif",
            fontWeight: '600',
            fontSize: '17px',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', gap: '3px', padding: '3px', background: theme.surface, borderRadius: '10px', alignSelf: 'flex-start' }}>
          {tab('write', 'Write')}
          {tab('markdown', 'Markdown')}
          {tab('preview', 'Preview')}
        </div>
        {view === 'write' ? (
          <React.Suspense
            fallback={
              <div style={{ flex: '1 1 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.textMuted, minHeight: '240px' }}>
                Loading editor…
              </div>
            }
          >
            <NoteEditor
              value={V.editText}
              onChange={V.setNoteMarkdown}
              placeholder="Start writing… use the toolbar, or type Markdown and it formats as you go."
            />
          </React.Suspense>
        ) : view === 'markdown' ? (
          rawEditor
        ) : (
          <div className="md-body md-live" style={{ flex: '1 1 auto', minHeight: '240px', maxHeight: 'none' }}>
            <style>{mdCss()}</style>
            {V.editText ? (
              <div dangerouslySetInnerHTML={{ __html: V.editPreviewHtml }} />
            ) : (
              <div style={{ color: theme.textFaint, fontStyle: 'italic' }}>Nothing to preview yet.</div>
            )}
          </div>
        )}
      </div>
    );
  }
  const k = V.previewKind;
  if (k === 'image') {
    // Swipe left/right pages the gallery on touch devices.
    const swipe = swipeX({
      onLeft: () => V.previewHasNext && V.previewNext(),
      onRight: () => V.previewHasPrev && V.previewPrev(),
    });
    const arrow = (onClick, side, glyph) => (
      <button
        onClick={onClick}
        aria-label={side === 'left' ? 'Previous image' : 'Next image'}
        data-round
        style={{
          position: 'absolute',
          top: '50%',
          [side]: '10px',
          transform: 'translateY(-50%)',
          width: '44px',
          height: '44px',
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
      <div style={{ position: 'relative' }} {...swipe}>
        <img
          src={V.previewUrl}
          alt={f.name}
          style={{
            width: '100%',
            maxHeight: V.imgMaxH || '360px',
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
              borderRadius: theme.radiusBadge,
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
          height: V.pdfH || '460px',
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
        <style>{mdCss()}</style>
        <div dangerouslySetInnerHTML={{ __html: V.previewHtml }} />
      </div>
    );
  }
  if (k === 'json' || k === 'yaml' || k === 'code' || k === 'text') {
    const html =
      k === 'json'
        ? highlightJson(V.previewCode)
        : k === 'yaml'
          ? highlightYaml(V.previewCode)
          : k === 'code'
            ? highlightCode(V.previewCode, V.previewLang)
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
  // Generic: no inline viewer for this type - offer download.
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

// Backlinks panel for a note — the Obsidian-style "Linked mentions" and
// "Unlinked mentions", each source note collapsible with in-context snippets,
// plus the note's own outgoing links as chips. Rendered as a plain function
// (no hooks), so collapsing uses native <details>.
const blCss = () => `
  .bl-wrap{border-top:1px solid ${theme.border};margin-top:26px;padding-top:20px;display:flex;flex-direction:column;gap:22px;}
  .bl-sec-head{display:flex;align-items:center;gap:8px;margin-bottom:10px;}
  .bl-sec-title{font-family:'Space Grotesk',sans-serif;font-size:14px;font-weight:700;color:${theme.textInk};}
  .bl-count{display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;padding:0 6px;border-radius:999px;background:${theme.surface};color:${theme.textMuted};font-size:11.5px;font-weight:600;}
  .bl-src{border:1px solid ${theme.border};border-radius:10px;background:${theme.surface2};overflow:hidden;margin-bottom:8px;}
  .bl-src > summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:8px;padding:9px 12px;font-weight:600;font-size:13px;color:${theme.text};user-select:none;}
  .bl-src > summary::-webkit-details-marker{display:none;}
  .bl-src > summary:hover{background:${theme.surface};}
  .bl-chev{transition:transform 0.15s;color:${theme.textFaint};flex:0 0 auto;}
  .bl-src[open] .bl-chev{transform:rotate(90deg);}
  .bl-src-count{margin-left:auto;font-weight:500;font-size:11.5px;color:${theme.textFaint};}
  .bl-snips{padding:2px 12px 10px 30px;display:flex;flex-direction:column;gap:8px;}
  .bl-snip{font-size:13px;line-height:1.55;color:${theme.textMuted};border-left:2px solid ${theme.border};padding-left:11px;}
  .bl-snip .bl-hit{color:${theme.brand};font-weight:600;background:${theme.brandBg};border-radius:3px;padding:0 2px;}
  .bl-snip .bl-hit-plain{color:${theme.text};font-weight:600;background:${theme.starBgSoft};border-radius:3px;padding:0 2px;}
  .bl-links{display:flex;flex-wrap:wrap;gap:6px;}
  .bl-empty{font-size:12.5px;color:${theme.textFaint};}
`;

function BacklinkSource(m, linked) {
  return (
    <details className="bl-src" key={(linked ? 'l' : 'u') + m.file_id} open>
      <summary onClick={(e) => { if (e.detail === 2) e.preventDefault(); }}>
        <svg className="bl-chev" width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <span
          role="link"
          tabIndex={0}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); m.onOpen(); }}
          style={{ color: theme.brand, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {m.name}
        </span>
        {m.count > 1 ? <span className="bl-src-count">{m.count} mentions</span> : null}
      </summary>
      <div className="bl-snips">
        {(m.snippets || []).map((s, i) => (
          <div className="bl-snip" key={i}>
            {s.before}
            <span className={linked ? 'bl-hit' : 'bl-hit-plain'}>{s.match}</span>
            {s.after}
          </div>
        ))}
      </div>
    </details>
  );
}

export function Backlinks(V) {
  const out = V.noteLinksOut || [];
  const m = V.noteMentions;
  const linked = (m && m.linked) || [];
  const unlinked = (m && m.unlinked) || [];
  if (!out.length && !linked.length && !unlinked.length) return null;

  const outChip = (item) => (
    <button
      key={'o' + item.id}
      onClick={item.onOpen}
      title={item.reason || 'Open'}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '5px',
        background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: '999px',
        padding: '4px 11px', fontSize: '12px', color: theme.text, cursor: 'pointer', maxWidth: '220px',
      }}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M9 15l6-6M10.5 6.5l1-1a4 4 0 0 1 6 6l-1 1M13.5 17.5l-1 1a4 4 0 0 1-6-6l1-1" stroke={theme.brand} strokeWidth="1.8" strokeLinecap="round" /></svg>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
    </button>
  );

  const secHead = (title, count) => (
    <div className="bl-sec-head">
      <span className="bl-sec-title">{title}</span>
      <span className="bl-count">{count}</span>
    </div>
  );

  return (
    <div className="bl-wrap">
      <style>{blCss()}</style>
      {out.length ? (
        <div>
          {secHead('Links in this note', out.length)}
          <div className="bl-links">{out.map(outChip)}</div>
        </div>
      ) : null}
      <div>
        {secHead('Linked mentions', (m && m.counts.linked) || linked.length)}
        {linked.length ? linked.map((s) => BacklinkSource(s, true)) : <div className="bl-empty">No other note links here yet.</div>}
      </div>
      {unlinked.length ? (
        <div>
          {secHead('Unlinked mentions', (m && m.counts.unlinked) || unlinked.length)}
          {unlinked.map((s) => BacklinkSource(s, false))}
        </div>
      ) : null}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: '0 0 auto' }}>
          {V.previewExpandable ? (
            <button
              onClick={V.togglePreviewFull}
              aria-label={V.previewFull ? 'Exit full screen' : 'Full screen'}
              title={V.previewFull ? 'Exit full screen' : 'Full screen'}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: theme.textMuted2,
                display: 'flex',
                alignItems: 'center',
                padding: '2px',
              }}
            >
              {V.previewFull ? (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          ) : null}
          <button
            onClick={V.closeModal}
            aria-label="Close"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: theme.textMuted2,
              display: 'flex',
              alignItems: 'center',
              padding: '2px',
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
        </div>
      </div>{' '}
      {PreviewBody(V)}{' '}
      {V.isNote && !V.isEditing ? Backlinks(V) : null}{' '}
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
                color: theme.onAccent,
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
                color: theme.onAccent,
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
