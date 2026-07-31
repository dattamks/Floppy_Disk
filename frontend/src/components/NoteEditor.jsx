import React, { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from 'tiptap-markdown';
import { theme } from '../lib/theme';

// A WYSIWYG rich-text note editor. You write with real formatting (bold looks
// bold, headings are headings, checkboxes are clickable) — no Markdown syntax
// to learn — but the value in and out is always Markdown, so notes stay plain
// .md files that search, the knowledge graph, and MCP all understand.

const prose = `
  .note-wysiwyg .ProseMirror{outline:none;min-height:100%;padding:18px 20px;color:${theme.text};font-size:15px;line-height:1.7;}
  .note-wysiwyg .ProseMirror > * + *{margin-top:0.6em;}
  .note-wysiwyg .ProseMirror h1{font-family:'Space Grotesk',sans-serif;font-size:1.7em;font-weight:700;line-height:1.25;}
  .note-wysiwyg .ProseMirror h2{font-family:'Space Grotesk',sans-serif;font-size:1.38em;font-weight:700;line-height:1.3;}
  .note-wysiwyg .ProseMirror h3{font-family:'Space Grotesk',sans-serif;font-size:1.16em;font-weight:600;}
  .note-wysiwyg .ProseMirror ul,.note-wysiwyg .ProseMirror ol{padding-left:1.5em;}
  .note-wysiwyg .ProseMirror li{margin:0.15em 0;}
  .note-wysiwyg .ProseMirror blockquote{border-left:3px solid ${theme.border};margin-left:0;padding-left:14px;color:${theme.textMuted};}
  .note-wysiwyg .ProseMirror code{background:${theme.surface};padding:1px 5px;border-radius:5px;font-family:'IBM Plex Mono',monospace;font-size:0.9em;}
  .note-wysiwyg .ProseMirror pre{background:${theme.surface};border:1px solid ${theme.border};border-radius:9px;padding:12px 14px;overflow:auto;font-family:'IBM Plex Mono',monospace;font-size:0.9em;}
  .note-wysiwyg .ProseMirror pre code{background:none;padding:0;}
  .note-wysiwyg .ProseMirror a{color:${theme.brand};text-decoration:underline;}
  .note-wysiwyg .ProseMirror hr{border:none;border-top:1px solid ${theme.border};margin:0.9em 0;}
  .note-wysiwyg .ProseMirror ul[data-type="taskList"]{list-style:none;padding-left:0.2em;}
  .note-wysiwyg .ProseMirror ul[data-type="taskList"] li{display:flex;align-items:flex-start;gap:8px;}
  .note-wysiwyg .ProseMirror ul[data-type="taskList"] li > label{margin-top:0.28em;flex:0 0 auto;}
  .note-wysiwyg .ProseMirror ul[data-type="taskList"] li > div{flex:1 1 auto;}
  .note-wysiwyg .ProseMirror input[type="checkbox"]{accent-color:${theme.brand};width:15px;height:15px;cursor:pointer;}
  .note-wysiwyg .ProseMirror p.is-editor-empty:first-child::before{content:attr(data-placeholder);color:${theme.textFaint};float:left;height:0;pointer-events:none;}
`;

function Btn({ label, title, active, disabled, onClick, wide }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()} // keep the editor selection
      onClick={onClick}
      disabled={disabled}
      style={{
        minWidth: wide ? 'auto' : '30px',
        height: '30px',
        padding: wide ? '0 9px' : '0 6px',
        borderRadius: '7px',
        border: `1px solid ${active ? theme.brand : theme.border}`,
        background: active ? theme.brand : theme.white,
        color: active ? theme.white : disabled ? theme.textFaint : theme.text,
        fontSize: '13px',
        fontWeight: '600',
        cursor: disabled ? 'default' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'IBM Plex Sans',sans-serif",
      }}
    >
      {label}
    </button>
  );
}

export default function NoteEditor({ value, onChange, placeholder }) {
  const lastEmitted = useRef(value || '');
  const editor = useEditor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder: placeholder || 'Start writing…' }),
      Markdown.configure({ html: false, tightLists: true, linkify: true, transformPastedText: true }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      const md = editor.storage.markdown.getMarkdown();
      lastEmitted.current = md;
      if (onChange) onChange(md);
    },
  });

  // Pull an external value change (e.g. the user edited the raw Markdown tab)
  // into the editor — but never while it merely echoes our own last emit, which
  // would fight the caret mid-typing.
  useEffect(() => {
    if (!editor) return;
    if ((value || '') !== lastEmitted.current) {
      lastEmitted.current = value || '';
      editor.commands.setContent(value || '', false);
    }
  }, [value, editor]);

  if (!editor) return null;
  const can = editor.can();
  const setLink = () => {
    const prev = editor.getAttributes('link').href || '';
    const url = window.prompt('Link URL', prev);
    if (url === null) return;
    if (url === '') return editor.chain().focus().extendMarkRange('link').unsetLink().run();
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const sep = () => (
    <span style={{ width: '1px', height: '20px', background: theme.border, margin: '0 3px' }} />
  );

  return (
    <div
      className="note-wysiwyg"
      style={{
        flex: '1 1 340px',
        minHeight: '240px',
        display: 'flex',
        flexDirection: 'column',
        border: `1px solid ${theme.brand}`,
        borderRadius: '11px',
        overflow: 'hidden',
        background: theme.white,
      }}
    >
      <style>{prose}</style>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '4px',
          padding: '7px 8px',
          borderBottom: `1px solid ${theme.border}`,
          background: theme.surface,
        }}
      >
        <Btn label={<b>B</b>} title="Bold (⌘B)" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} />
        <Btn label={<i>I</i>} title="Italic (⌘I)" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} />
        <Btn label={<span style={{ textDecoration: 'line-through' }}>S</span>} title="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} />
        {sep()}
        <Btn label="H1" title="Heading 1" active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} />
        <Btn label="H2" title="Heading 2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
        <Btn label="H3" title="Heading 3" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} />
        {sep()}
        <Btn label="•" title="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} />
        <Btn label="1." title="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
        <Btn label="☑" title="Checklist" active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()} />
        {sep()}
        <Btn label="&rdquo;" title="Quote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} />
        <Btn label="</>" title="Code block" active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()} />
        <Btn label="🔗" title="Link" active={editor.isActive('link')} onClick={setLink} />
        {sep()}
        <Btn label="↺" title="Undo (⌘Z)" disabled={!can.undo()} onClick={() => editor.chain().focus().undo().run()} />
        <Btn label="↻" title="Redo (⌘⇧Z)" disabled={!can.redo()} onClick={() => editor.chain().focus().redo().run()} />
      </div>
      <div style={{ flex: '1 1 auto', overflow: 'auto' }}>
        <EditorContent editor={editor} style={{ height: '100%' }} />
      </div>
    </div>
  );
}
