import React from 'react';
import { theme } from '../lib/theme';
import { PreviewBody, Backlinks } from './PreviewModal';

// Lazy — the editor pulls in TipTap/ProseMirror; only load it when a note opens.
const NoteEditor = React.lazy(() => import('./NoteEditor'));

// Word / character counts for the note status bar — strip code, wiki-brackets,
// and Markdown punctuation so the word count reflects prose, not syntax.
function noteStats(md) {
  const prose = (md || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/\[\[([^\]|#]+)[^\]]*\]\]/g, '$1')
    .replace(/[#>*_~`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return { words: prose ? prose.split(' ').filter(Boolean).length : 0, chars: (md || '').length };
}

// Headings (h1–h3) for the outline/TOC, in document order, skipping code fences.
function noteHeadings(md) {
  const out = [];
  let inFence = false;
  (md || '').split('\n').forEach((ln) => {
    if (/^\s*```/.test(ln)) { inFence = !inFence; return; }
    if (inFence) return;
    const m = /^(#{1,3})\s+(.+?)\s*#*$/.exec(ln);
    if (m) out.push({ level: m[1].length, text: m[2].replace(/\[\[([^\]|#]+)[^\]]*\]\]/g, '$1').trim() });
  });
  return out;
}

function scrollToHeading(i) {
  const root = document.querySelector('.note-wysiwyg .ProseMirror');
  if (!root) return;
  const el = root.querySelectorAll('h1,h2,h3')[i];
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Split leading YAML frontmatter (--- … ---) from the note body. Returns the
// parsed key/value pairs and the body with the block removed, so the editor
// never shows raw YAML — it becomes an editable Properties panel instead.
function splitFrontmatter(md) {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(md || '');
  if (!m) return { pairs: [], body: md || '', has: false };
  const pairs = m[1]
    .split('\n')
    .map((line) => {
      const i = line.indexOf(':');
      if (i < 0) return null;
      return { key: line.slice(0, i).trim(), value: line.slice(i + 1).trim() };
    })
    .filter((p) => p && p.key);
  return { pairs, body: (md || '').slice(m[0].length).replace(/^\n+/, ''), has: true };
}

function buildFrontmatter(pairs) {
  const clean = (pairs || []).filter((p) => p.key.trim());
  if (!clean.length) return '';
  return '---\n' + clean.map((p) => `${p.key.trim()}: ${p.value}`).join('\n') + '\n---\n\n';
}

// The editable Properties panel (Obsidian-style key/value rows). Holds its own
// row state so an in-progress row with an empty key persists in the UI (empty
// keys aren't serialized into the frontmatter, so they'd otherwise vanish on
// re-render). Mounted with key={noteId} so it reseeds when the note changes.
function NoteProperties({ pairs, onChange, brand }) {
  const [rows, setRows] = React.useState(pairs);
  const push = (next) => { setRows(next); onChange(next); };
  const setKey = (i, key) => push(rows.map((p, j) => (j === i ? { ...p, key } : p)));
  const setVal = (i, value) => push(rows.map((p, j) => (j === i ? { ...p, value } : p)));
  const remove = (i) => push(rows.filter((_, j) => j !== i));
  const add = () => setRows([...rows, { key: '', value: '' }]);
  const keyStyle = { border: 'none', outline: 'none', background: 'transparent', color: theme.textMuted, fontSize: '13px', fontWeight: 600, fontFamily: 'inherit', width: 130, flex: '0 0 auto' };
  const valStyle = { border: 'none', outline: 'none', background: 'transparent', color: theme.text, fontSize: '13px', fontFamily: 'inherit', flex: '1 1 auto', minWidth: 0 };
  return (
    <div data-testid="note-properties" style={{ margin: '2px 0 14px', display: 'flex', flexDirection: 'column' }}>
      {rows.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: `1px solid ${theme.border}` }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flex: '0 0 auto', color: theme.textFaint }}><path d="M4 7h16M4 12h16M4 17h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
          <input aria-label="Property name" value={p.key} placeholder="Property" onInput={(e) => setKey(i, e.target.value)} onChange={(e) => setKey(i, e.target.value)} style={keyStyle} />
          <input aria-label={`Value of ${p.key || 'property'}`} value={p.value} placeholder="Empty" onInput={(e) => setVal(i, e.target.value)} onChange={(e) => setVal(i, e.target.value)} style={valStyle} />
          <button aria-label="Remove property" onClick={() => remove(i)} style={{ flex: '0 0 auto', border: 'none', background: 'none', cursor: 'pointer', color: theme.textFaint, padding: 2, borderRadius: 5, lineHeight: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
          </button>
        </div>
      ))}
      <button data-testid="note-add-property" onClick={add}
        style={{ alignSelf: 'flex-start', marginTop: 6, border: 'none', background: 'none', cursor: 'pointer', color: theme.textFaint, fontFamily: 'inherit', fontSize: '12.5px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 0' }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke={brand} strokeWidth="1.9" strokeLinecap="round" /></svg>
        Add property
      </button>
    </div>
  );
}

// A document opened full-page in the content area (not a modal).
// - Notes (markdown) get a Notion/Obsidian-style single clean writing surface:
//   the text already looks like the finished document, with an editable
//   "Source" toggle for raw Markdown. No Write/Markdown/Preview tabs.
// - Other docs (pdf / code / json / text) reuse the shared PreviewBody: review
//   with a one-click Edit.
export default function FilePage({ V }) {
  const [exportOpen, setExportOpen] = React.useState(false);
  const f = V.activeFile;
  if (!f) return null;

  const actionBtn = { background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text, borderRadius: '9px', padding: '0 14px', height: 34, fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 };
  const iconBtn = { width: 34, height: 34, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 9, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.textMuted, cursor: 'pointer' };
  const backBtn = (
    <button onClick={V.closeFilePage} data-testid="file-page-back" aria-label="Back to files" style={iconBtn}>
      <svg width="18" height="18" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="1.9" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
  );

  // ---- Notes: single clean writing surface ----
  if (V.isNote) {
    const source = V.noteView === 'markdown';
    const fm = splitFrontmatter(V.editText);
    const setBodyMd = (md) => V.setNoteMarkdown(buildFrontmatter(fm.pairs) + md);
    const setPairs = (pairs) => V.setNoteMarkdown(buildFrontmatter(pairs) + fm.body);
    const stats = noteStats(fm.body);
    const headings = source ? [] : noteHeadings(fm.body);
    const backlinkCount = (V.noteMentions && V.noteMentions.counts && V.noteMentions.counts.linked) || 0;
    const crumbs = V.noteCrumbs || [];
    const showOutline = V.isDesktop && headings.length >= 2;
    return (
      <div data-testid="file-page" data-note="1" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, background: theme.white, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', borderBottom: `1px solid ${theme.border}`, flex: '0 0 auto', flexWrap: V.isDesktop ? 'nowrap' : 'wrap' }}>
          {backBtn}
          {/* Breadcrumb: folder trail · filename (hidden on phones to give the actions room) */}
          <div style={{ display: V.isDesktop ? 'block' : 'none', fontSize: '12.5px', color: theme.textFaint, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {crumbs.map((c) => (
              <React.Fragment key={c.id}>
                <span role="link" tabIndex={0} onClick={c.onOpen} style={{ cursor: 'pointer', color: theme.textMuted }}>{c.name}</span>
                <span style={{ margin: '0 6px' }}>/</span>
              </React.Fragment>
            ))}
            <span style={{ color: theme.textMuted }}>{f.name}</span>
          </div>
          <button onClick={() => V.setNoteView(source ? 'write' : 'markdown')} data-testid="file-page-source" aria-pressed={source} aria-label={source ? 'Editor' : 'Source'} title={source ? 'Editor' : 'Source'}
            style={V.isDesktop
              ? { ...actionBtn, background: source ? theme.brandBg : theme.surface, color: source ? theme.brand : theme.text, borderColor: source ? (theme.brandBorder || theme.border) : theme.border }
              : { ...iconBtn, background: source ? theme.brandBg : theme.surface, color: source ? theme.brand : theme.textMuted, borderColor: source ? (theme.brandBorder || theme.border) : theme.border }}>
            {V.isDesktop ? (source ? 'Editor' : 'Source') : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 8l-4 4 4 4M15 8l4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            )}
          </button>
          <button onClick={V.onActiveDetails} data-testid="file-page-info" aria-label="Info" title="Info" style={iconBtn}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" /><path d="M12 11v5M12 8h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </button>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setExportOpen((o) => !o)} data-testid="note-export" aria-label="Export" title="Export" aria-expanded={exportOpen} style={iconBtn}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 15V4m0 0L8 8m4-4l4 4M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            {exportOpen ? (
              <React.Fragment>
                <div onClick={() => setExportOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                <div data-testid="note-export-menu" style={{ position: 'absolute', top: 40, right: 0, zIndex: 41, minWidth: 168, background: theme.white, border: `1px solid ${theme.border}`, borderRadius: 10, boxShadow: '0 12px 30px rgba(0,0,0,0.18)', padding: 5 }}>
                  <div style={{ padding: '4px 9px 6px', fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.04em', color: theme.textFaint, textTransform: 'uppercase' }}>Export as</div>
                  {[['md', 'Markdown (.md)'], ['html', 'HTML (.html)'], ['pdf', 'PDF']].map(([fmt, label]) => (
                    <button key={fmt} data-testid={`note-export-${fmt}`} onClick={() => { setExportOpen(false); V.onExportNote(fmt); }}
                      style={{ display: 'flex', width: '100%', border: 'none', background: 'transparent', color: theme.text, borderRadius: 7, padding: '8px 9px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '13px', textAlign: 'left' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = theme.surface; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                      {label}
                    </button>
                  ))}
                </div>
              </React.Fragment>
            ) : null}
          </div>
          <button onClick={V.deleteActive} aria-label="Delete" title="Delete" style={{ ...iconBtn, color: theme.danger, borderColor: theme.dangerBorder2 || theme.border }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V5h6v2m-8 0 1 13h8l1-13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
          </button>
          <button onClick={V.openShareForActive} aria-label="Share" title="Share"
            style={V.isDesktop ? { ...actionBtn, background: theme.surface } : iconBtn}>
            {V.isDesktop ? 'Share' : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="18" cy="5" r="2.4" stroke="currentColor" strokeWidth="1.6" /><circle cx="6" cy="12" r="2.4" stroke="currentColor" strokeWidth="1.6" /><circle cx="18" cy="19" r="2.4" stroke="currentColor" strokeWidth="1.6" /><path d="M8.1 10.9l7.8-4.6M8.1 13.1l7.8 4.6" stroke="currentColor" strokeWidth="1.6" /></svg>
            )}
          </button>
          <button onClick={V.onSaveEdit} disabled={V.editSaving} data-testid="file-page-save"
            style={{ ...actionBtn, background: theme.brand, color: theme.onAccent, border: 'none', opacity: V.editSaving ? 0.7 : 1, cursor: V.editSaving ? 'default' : 'pointer' }}>
            {V.editSaving ? 'Saving…' : 'Save'}
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: showOutline ? '1fr minmax(0,700px) 232px' : '1fr minmax(0,760px) 1fr', minHeight: '100%' }}>
            <div />
            <div style={{ padding: '30px 28px 60px', display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
              <input value={V.editName} onInput={V.setEditName} onChange={V.setEditName} aria-label="Note title" placeholder="Untitled"
                style={{ border: 'none', outline: 'none', background: 'transparent', fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: '34px', color: theme.text, padding: '0 0 10px', width: '100%' }} />
              {source ? (
                <textarea value={V.editText} onInput={V.setEditText} spellCheck={false} aria-label="Note source"
                  style={{ flex: '1 1 auto', minHeight: 300, width: '100%', resize: 'none', border: 'none', outline: 'none', background: 'transparent', color: theme.text, fontFamily: "'IBM Plex Mono','SFMono-Regular',Menlo,monospace", fontSize: '14px', lineHeight: 1.7, boxSizing: 'border-box' }} />
              ) : (
                <React.Fragment>
                  <NoteProperties key={f.id} pairs={fm.pairs} onChange={setPairs} brand={theme.brand} />
                  <React.Suspense fallback={<div style={{ color: theme.textMuted, padding: '20px 0' }}>Loading editor…</div>}>
                    <NoteEditor value={fm.body} onChange={setBodyMd} variant="page" placeholder="Start writing… or press '/' for commands" noteNames={V.noteNames} onOpenWikiLink={V.onOpenWikiLink} onUploadFile={V.onUploadFile} />
                  </React.Suspense>
                </React.Fragment>
              )}
              {Backlinks(V)}
            </div>
            {showOutline ? (
              <div style={{ padding: '34px 16px 0 10px' }}>
                <div data-testid="note-outline" style={{ position: 'sticky', top: 8, width: 206 }}>
                  <div style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: theme.textFaint, marginBottom: 8 }}>On this page</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, borderLeft: `1px solid ${theme.border}` }}>
                    {headings.map((h, i) => (
                      <button key={i} onClick={() => scrollToHeading(i)}
                        style={{ textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', color: theme.textMuted, fontFamily: 'inherit',
                          fontSize: h.level === 1 ? '13px' : '12.5px', fontWeight: h.level === 1 ? 600 : 500,
                          padding: `3px 0 3px ${8 + (h.level - 1) * 12}px`, marginLeft: -1, borderLeft: '2px solid transparent',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = theme.brand; e.currentTarget.style.borderLeftColor = theme.brand; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = theme.textMuted; e.currentTarget.style.borderLeftColor = 'transparent'; }}>
                        {h.text}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div />
            )}
          </div>
        </div>

        {/* Status bar: live word / character counts + backlink count. */}
        <div data-testid="note-statusbar" style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 14, padding: '5px 18px', borderTop: `1px solid ${theme.border}`, background: theme.surface2, fontSize: '11.5px', color: theme.textFaint }}>
          <span>{stats.words} {stats.words === 1 ? 'word' : 'words'}</span>
          <span>{stats.chars} {stats.chars === 1 ? 'character' : 'characters'}</span>
          {backlinkCount ? <span>{backlinkCount} {backlinkCount === 1 ? 'backlink' : 'backlinks'}</span> : null}
        </div>
      </div>
    );
  }

  // ---- Other documents: review + one-click Edit ----
  const editing = V.isEditing;
  return (
    <div data-testid="file-page" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, background: theme.white, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: `1px solid ${theme.border}`, flex: '0 0 auto', flexWrap: V.isDesktop ? 'nowrap' : 'wrap' }}>
        {backBtn}
        <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: '18px', color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: V.isDesktop ? 0 : '55%' }} title={f.name}>{f.name}</span>
        {editing ? (
          <div style={{ display: 'flex', gap: 8, flex: '0 0 auto' }}>
            <button onClick={V.onCancelEdit} style={actionBtn}>Cancel</button>
            <button onClick={V.onSaveEdit} disabled={V.editSaving} data-testid="file-page-save"
              style={{ ...actionBtn, background: theme.brand, color: theme.onAccent, border: 'none', opacity: V.editSaving ? 0.7 : 1, cursor: V.editSaving ? 'default' : 'pointer' }}>
              {V.editSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, flex: '0 0 auto', alignItems: 'center' }}>
            <button onClick={V.onActiveDetails} data-testid="file-page-info" aria-label="Info" title="Info" style={iconBtn}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" /><path d="M12 11v5M12 8h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            </button>
            <button onClick={f.onToggleStar} aria-label={f.starred ? 'Unstar' : 'Star'} style={iconBtn}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill={f.starFill}><path d="M12 3l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.2-5.4 3.2 1.3-6-4.6-4.1 6.1-.6L12 3Z" stroke={f.starStroke} strokeWidth="1.3" /></svg>
            </button>
            {V.canEdit ? (
              <button onClick={V.onStartEdit} data-testid="file-page-edit" aria-label="Edit" title="Edit" style={V.isDesktop ? actionBtn : iconBtn}>
                {V.isDesktop ? 'Edit' : (<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 20h4L19 9l-4-4L4 16v4z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="M13.5 6.5l4 4" stroke="currentColor" strokeWidth="1.7" /></svg>)}
              </button>
            ) : null}
            <button onClick={V.downloadActive} aria-label="Download" title="Download" style={V.isDesktop ? actionBtn : iconBtn}>
              {V.isDesktop ? 'Download' : (<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 4v10m0 0l-4-4m4 4l4-4M5 19h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>)}
            </button>
            <button onClick={V.deleteActive} aria-label="Delete" title="Delete"
              style={V.isDesktop ? { ...actionBtn, background: theme.dangerBgSoft, border: `1px solid ${theme.dangerBorder2}`, color: theme.danger } : { ...iconBtn, background: theme.dangerBgSoft, borderColor: theme.dangerBorder2 || theme.border, color: theme.danger }}>
              {V.isDesktop ? 'Delete' : (<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V5h6v2m-8 0 1 13h8l1-13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>)}
            </button>
            <button onClick={V.openShareForActive} aria-label="Share" title="Share"
              style={V.isDesktop ? { ...actionBtn, background: theme.brand, color: theme.onAccent, border: 'none', fontWeight: 600 } : { ...iconBtn, background: theme.brand, color: theme.onAccent, borderColor: theme.brand }}>
              {V.isDesktop ? 'Share' : (<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="18" cy="5" r="2.4" stroke="currentColor" strokeWidth="1.6" /><circle cx="6" cy="12" r="2.4" stroke="currentColor" strokeWidth="1.6" /><circle cx="18" cy="19" r="2.4" stroke="currentColor" strokeWidth="1.6" /><path d="M8.1 10.9l7.8-4.6M8.1 13.1l7.8 4.6" stroke="currentColor" strokeWidth="1.6" /></svg>)}
            </button>
          </div>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 12 }} data-full-page="1">
        <style>{`[data-full-page="1"] .md-body{max-height:none !important;} [data-full-page="1"] pre.code-hl{max-height:none !important;}`}</style>
        {PreviewBody(V)}
        {!editing ? <div style={{ fontSize: '11.5px', color: theme.textFaint }}>{f.metaLine}</div> : null}
      </div>
    </div>
  );
}
