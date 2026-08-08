import React from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import katex from 'katex';
import { theme } from '../lib/theme';

// Renders a math node with KaTeX; click to edit the LaTeX (inline → input,
// block → textarea). A freshly inserted empty node opens straight into editing.
export default function NoteMathView({ node, updateAttributes, editor }) {
  const isBlock = node.type.name === 'mathBlock';
  const latex = node.attrs.latex || '';
  const [editing, setEditing] = React.useState(!latex && editor.isEditable);
  const [draft, setDraft] = React.useState(latex);
  React.useEffect(() => { setDraft(latex); }, [latex]);

  const html = React.useMemo(() => {
    if (!latex.trim()) return null;
    try { return katex.renderToString(latex, { throwOnError: false, displayMode: isBlock }); }
    catch (e) { return null; }
  }, [latex, isBlock]);

  const commit = () => { updateAttributes({ latex: draft }); setEditing(false); };
  const Tag = isBlock ? 'div' : 'span';

  const editorEl = isBlock ? (
    <textarea
      data-testid="note-math-input" autoFocus value={draft} rows={Math.min(6, Math.max(1, draft.split('\n').length))}
      placeholder="\int_0^1 x^2 dx" spellCheck={false}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); commit(); } if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commit(); } }}
      style={{ width: '100%', minWidth: 240, resize: 'vertical', border: `1px solid ${theme.brandBorder || theme.border}`, borderRadius: 8, padding: '8px 10px', fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, background: theme.surface, color: theme.text, outline: 'none' }}
    />
  ) : (
    <input
      data-testid="note-math-input" autoFocus value={draft}
      placeholder="a^2 + b^2" spellCheck={false}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); commit(); } }}
      style={{ minWidth: 90, border: `1px solid ${theme.brandBorder || theme.border}`, borderRadius: 6, padding: '2px 6px', fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, background: theme.surface, color: theme.text, outline: 'none' }}
    />
  );

  const rendered = html ? (
    <Tag data-testid="note-math" className="note-math-rendered" dangerouslySetInnerHTML={{ __html: html }}
      style={{ cursor: editor.isEditable ? 'pointer' : 'default' }}
      onClick={() => editor.isEditable && setEditing(true)} />
  ) : (
    <Tag data-testid="note-math" className="note-math-empty"
      style={{ cursor: 'pointer', color: theme.textFaint, fontStyle: 'italic', fontSize: isBlock ? 14 : 13 }}
      onClick={() => editor.isEditable && setEditing(true)}>{isBlock ? '∑  Empty equation — click to edit' : '∑ math'}</Tag>
  );

  return (
    <NodeViewWrapper
      as={isBlock ? 'div' : 'span'}
      className={isBlock ? 'note-math-block' : 'note-math-inline'}
      style={isBlock ? { margin: '0.8em 0', textAlign: 'center' } : { display: 'inline-block' }}
      onMouseDown={(e) => { if (editing) e.stopPropagation(); }}
    >
      {editing && editor.isEditable ? editorEl : rendered}
    </NodeViewWrapper>
  );
}
