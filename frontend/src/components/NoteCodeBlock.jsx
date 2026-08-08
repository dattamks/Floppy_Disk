import React, { useState } from 'react';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { theme } from '../lib/theme';

// A code block that reads like Obsidian's: a rounded panel with a corner
// language label and a copy button. The `<code>` inside is the editable
// content area (NodeViewContent); lowlight paints the syntax highlighting on
// top of it via ProseMirror decorations, so highlighting stays live as you
// type without us re-tokenising by hand.
export default function NoteCodeBlock({ node, updateAttributes, extension }) {
  const [copied, setCopied] = useState(false);
  const langs = extension?.options?.lowlight?.listLanguages?.() || [];
  const current = node.attrs.language || '';

  const copy = () => {
    const text = node.textContent || '';
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 1200); };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(done);
    } else {
      done();
    }
  };

  return (
    <NodeViewWrapper
      className="note-codeblock"
      style={{ position: 'relative', margin: '1.1em 0' }}
    >
      <div
        contentEditable={false}
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 34,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 10px 0 14px', pointerEvents: 'none',
        }}
      >
        <select
          value={langs.includes(current) ? current : ''}
          onChange={(e) => updateAttributes({ language: e.target.value || null })}
          contentEditable={false}
          aria-label="Code language"
          style={{
            pointerEvents: 'auto', border: 'none', background: 'transparent',
            color: theme.textMuted, fontFamily: "'IBM Plex Mono',monospace",
            fontSize: '11.5px', fontWeight: 600, letterSpacing: '0.03em',
            textTransform: 'uppercase', cursor: 'pointer', outline: 'none',
            appearance: 'none', WebkitAppearance: 'none', padding: '2px 2px',
            maxWidth: 130, textOverflow: 'ellipsis',
          }}
        >
          <option value="">plain text</option>
          {langs.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={copy}
          contentEditable={false}
          aria-label="Copy code"
          style={{
            pointerEvents: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5,
            border: 'none', background: 'transparent', cursor: 'pointer',
            color: copied ? theme.success : theme.textMuted,
            fontFamily: "'IBM Plex Sans',sans-serif", fontSize: '11.5px', fontWeight: 600,
            padding: '3px 4px',
          }}
        >
          {copied ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.7" /><path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="1.7" /></svg>
          )}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre>
        <NodeViewContent as="code" spellCheck={false} />
      </pre>
    </NodeViewWrapper>
  );
}
