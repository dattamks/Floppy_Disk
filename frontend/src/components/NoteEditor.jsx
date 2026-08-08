import React, { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent, ReactNodeViewRenderer, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import DragHandle from 'tiptap-extension-global-drag-handle';
import { Markdown } from 'tiptap-markdown';
import { lowlight } from '../lib/lowlight';
import { WikiLink } from '../lib/wikilink';
import { FoldableHeadings } from '../lib/foldheadings';
import { Callout, CALLOUT_TYPES } from '../lib/callout';
import { searchEmoji } from '../lib/emoji';
import { Video, Audio } from '../lib/medianodes';
import { RichImage } from '../lib/richimage';
import { MathInline, MathBlock } from '../lib/mathnodes';
import { Columns, Column } from '../lib/columns';
import { TrailingNode } from '../lib/trailingnode';
import { SearchReplace } from '../lib/searchreplace';
import 'katex/dist/katex.min.css';
import NoteCodeBlock from './NoteCodeBlock';
import Lightbox from './Lightbox';

// A tiny inline placeholder image (soft gradient) so a note can show an image
// without an external fetch — real image insert/upload is a follow-up.
import { theme } from '../lib/theme';

// tiptap-markdown escapes bracket characters (they can start a link), so a
// typed `[[Note]]` serializes as `\[\[Note\]\]`. That would break the graph,
// which keys off literal `[[Note]]`. Restore the wiki-link brackets on the way
// out — regular `[text](url)` links use single brackets and are untouched.
const unescapeWiki = (md) => (md || '').replace(/\\\[\\\[/g, '[[').replace(/\\\]\\\]/g, ']]');

// Code blocks get syntax highlighting (lowlight), plus a corner language label
// and a copy button, via a React node view — the Obsidian look.
const CodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(NoteCodeBlock);
  },
}).configure({ lowlight });

// A WYSIWYG rich-text note editor. You write with real formatting (bold looks
// bold, headings are headings, checkboxes are clickable) - no Markdown syntax
// to learn - but the value in and out is always Markdown, so notes stay plain
// .md files that search, the knowledge graph, and MCP all understand.

const prose = `
  .note-wysiwyg .ProseMirror{outline:none;min-height:100%;padding:18px 20px;color:${theme.text};font-size:15px;line-height:1.7;}
  .note-wysiwyg .ProseMirror > * + *{margin-top:0.7em;}
  .note-wysiwyg .ProseMirror p{margin:0;}
  .note-wysiwyg .ProseMirror h1,.note-wysiwyg .ProseMirror h2,.note-wysiwyg .ProseMirror h3{font-family:'Space Grotesk',sans-serif;color:${theme.textInk};}
  .note-wysiwyg .ProseMirror h1{font-size:1.7em;font-weight:700;line-height:1.22;letter-spacing:-0.01em;}
  .note-wysiwyg .ProseMirror h2{font-size:1.38em;font-weight:700;line-height:1.28;letter-spacing:-0.005em;}
  .note-wysiwyg .ProseMirror h3{font-size:1.16em;font-weight:600;line-height:1.35;}
  .note-wysiwyg .ProseMirror h1 + *,.note-wysiwyg .ProseMirror h2 + *,.note-wysiwyg .ProseMirror h3 + *{margin-top:0.35em;}
  /* Foldable headings: a chevron in the left gutter collapses the section. */
  .note-wysiwyg .ProseMirror .nd-heading{position:relative;}
  .note-wysiwyg .ProseMirror .nd-fold-toggle{position:absolute;left:-1.15em;top:0.3em;width:1em;height:1em;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;color:${theme.textFaint};opacity:0;transition:opacity .12s,transform .12s;font-size:0.72em;user-select:none;}
  .note-wysiwyg .ProseMirror .nd-fold-toggle::before{content:'▾';}
  .note-wysiwyg .ProseMirror .nd-heading:hover .nd-fold-toggle,.note-wysiwyg .ProseMirror .nd-fold-toggle.is-folded{opacity:1;}
  .note-wysiwyg .ProseMirror .nd-fold-toggle.is-folded{transform:rotate(-90deg);}
  .note-wysiwyg .ProseMirror .nd-folded{display:none !important;}
  .note-wysiwyg .ProseMirror .nd-folded-head::after{content:' ⋯';color:${theme.textFainter};font-weight:400;}
  .note-wysiwyg .ProseMirror ul,.note-wysiwyg .ProseMirror ol{padding-left:1.5em;}
  .note-wysiwyg .ProseMirror li{margin:0.15em 0;}
  .note-wysiwyg .ProseMirror li > p{margin:0;}
  .note-wysiwyg .ProseMirror blockquote{border-left:3px solid ${theme.brandBorder || theme.border};margin-left:0;padding:2px 0 2px 16px;color:${theme.textMuted};font-style:italic;}
  .note-wysiwyg .ProseMirror code{background:${theme.surface};padding:1.5px 6px;border-radius:5px;border:1px solid ${theme.border};font-family:'IBM Plex Mono',monospace;font-size:0.86em;color:${theme.textSoft};}
  .note-wysiwyg .ProseMirror a{color:${theme.brand};text-decoration:underline;text-underline-offset:2px;text-decoration-thickness:1px;}
  .note-wysiwyg .ProseMirror .wiki-link{color:${theme.brand};cursor:pointer;border-bottom:1px solid ${theme.brandBorder || theme.border};padding-bottom:0.5px;}
  .note-wysiwyg .ProseMirror .wiki-link:hover{background:${theme.brandBg};border-radius:3px;}
  .note-wysiwyg .ProseMirror .wiki-bracket{color:${theme.textFainter};}
  /* An uploaded file attachment: a link on its own line to the stored bytes. */
  .note-wysiwyg .ProseMirror p > a[href*="/raw"]:only-child{display:inline-flex;align-items:center;gap:6px;background:${theme.surface2};border:1px solid ${theme.border};border-radius:8px;padding:6px 12px;color:${theme.text};text-decoration:none;}
  .note-wysiwyg .ProseMirror p > a[href*="/raw"]:only-child:hover{border-color:${theme.brandBorder};background:${theme.surface}}
  .note-wysiwyg .ProseMirror hr{border:none;border-top:1px solid ${theme.border};margin:1.4em 0;}
  .note-wysiwyg .ProseMirror ul[data-type="taskList"]{list-style:none;padding-left:0;margin:0.4em 0;}
  .note-wysiwyg .ProseMirror ul[data-type="taskList"] li{display:flex;flex-direction:row;align-items:flex-start;gap:9px;margin:0.15em 0;}
  .note-wysiwyg .ProseMirror ul[data-type="taskList"] li::before{content:none;}
  .note-wysiwyg .ProseMirror ul[data-type="taskList"] li > label{flex:0 0 auto;margin:0;display:inline-flex;align-items:center;height:1.6em;user-select:none;}
  .note-wysiwyg .ProseMirror ul[data-type="taskList"] li > div{flex:1 1 auto;min-width:0;}
  .note-wysiwyg .ProseMirror ul[data-type="taskList"] li > div > p{margin:0;}
  .note-wysiwyg .ProseMirror ul[data-type="taskList"] li[data-checked="true"] > div{color:${theme.textMuted};text-decoration:line-through;}
  .note-wysiwyg .ProseMirror input[type="checkbox"]{accent-color:${theme.brand};width:15px;height:15px;cursor:pointer;}
  .note-wysiwyg .ProseMirror p.is-editor-empty:first-child::before{content:attr(data-placeholder);color:${theme.textFaint};float:left;height:0;pointer-events:none;}
  .note-wysiwyg .ProseMirror [style*="text-align:center"],.note-wysiwyg .ProseMirror [style*="text-align: center"]{text-align:center;}
  .note-wysiwyg .ProseMirror [style*="text-align:right"],.note-wysiwyg .ProseMirror [style*="text-align: right"]{text-align:right;}
  .note-wysiwyg .ProseMirror img{max-width:100%;height:auto;border-radius:10px;display:block;margin:0.5em 0;}
  .note-wysiwyg .ProseMirror img.ProseMirror-selectednode{outline:2px solid ${theme.brand};}
  /* Code blocks: rounded panel, corner language label + copy button, lowlight syntax colors. */
  .note-wysiwyg .ProseMirror .note-codeblock pre{margin:0;background:${theme.surface2};border:1px solid ${theme.border};border-radius:10px;padding:38px 15px 14px;overflow:auto;}
  .note-wysiwyg .ProseMirror .note-codeblock pre code{display:block;background:none;border:none;padding:0;font-family:'IBM Plex Mono','SFMono-Regular',Menlo,monospace;font-size:13px;line-height:1.65;color:${theme.textSoft};white-space:pre;}
  .note-wysiwyg .ProseMirror .note-codeblock .hljs-comment,.note-wysiwyg .ProseMirror .note-codeblock .hljs-quote{color:${theme.textFaint};font-style:italic;}
  .note-wysiwyg .ProseMirror .note-codeblock .hljs-keyword,.note-wysiwyg .ProseMirror .note-codeblock .hljs-selector-tag,.note-wysiwyg .ProseMirror .note-codeblock .hljs-literal,.note-wysiwyg .ProseMirror .note-codeblock .hljs-type,.note-wysiwyg .ProseMirror .note-codeblock .hljs-built_in{color:${theme.brand};}
  .note-wysiwyg .ProseMirror .note-codeblock .hljs-string,.note-wysiwyg .ProseMirror .note-codeblock .hljs-regexp,.note-wysiwyg .ProseMirror .note-codeblock .hljs-char{color:${theme.teal};}
  .note-wysiwyg .ProseMirror .note-codeblock .hljs-number,.note-wysiwyg .ProseMirror .note-codeblock .hljs-symbol{color:${theme.violet};}
  .note-wysiwyg .ProseMirror .note-codeblock .hljs-title,.note-wysiwyg .ProseMirror .note-codeblock .hljs-title.function_,.note-wysiwyg .ProseMirror .note-codeblock .hljs-section,.note-wysiwyg .ProseMirror .note-codeblock .hljs-name{color:${theme.warnDark};}
  .note-wysiwyg .ProseMirror .note-codeblock .hljs-attr,.note-wysiwyg .ProseMirror .note-codeblock .hljs-attribute,.note-wysiwyg .ProseMirror .note-codeblock .hljs-variable,.note-wysiwyg .ProseMirror .note-codeblock .hljs-property{color:${theme.textSoft};}
  .note-wysiwyg .ProseMirror .note-codeblock .hljs-meta,.note-wysiwyg .ProseMirror .note-codeblock .hljs-comment.hljs-doctag{color:${theme.textMuted};}
  /* Tables: compact, content wraps, columns drag-resizable. */
  .note-wysiwyg .ProseMirror .tableWrapper{overflow-x:auto;margin:0.7em 0;}
  .note-wysiwyg .ProseMirror table{border-collapse:collapse;table-layout:fixed;width:auto;max-width:100%;}
  .note-wysiwyg .ProseMirror th,.note-wysiwyg .ProseMirror td{border:1px solid ${theme.borderStrong2 || theme.border};padding:7px 12px;vertical-align:top;text-align:left;min-width:70px;box-sizing:border-box;position:relative;word-break:break-word;white-space:normal;}
  .note-wysiwyg .ProseMirror th{background:${theme.surface};font-weight:600;}
  .note-wysiwyg .ProseMirror th > p,.note-wysiwyg .ProseMirror td > p{margin:0;}
  .note-wysiwyg .ProseMirror .selectedCell:after{background:${theme.brandBg};opacity:0.5;content:"";position:absolute;inset:0;pointer-events:none;z-index:1;}
  .note-wysiwyg .ProseMirror .column-resize-handle{position:absolute;right:-2px;top:0;bottom:-1px;width:4px;background:${theme.brand};pointer-events:none;}
  .note-wysiwyg .ProseMirror.resize-cursor{cursor:col-resize;}
  /* Full-page (document) variant: roomier rhythm — the Obsidian reading feel. */
  .note-wysiwyg.note-page .ProseMirror{padding:4px 0 40px;font-size:16.5px;line-height:1.75;}
  .note-wysiwyg.note-page .ProseMirror > * + *{margin-top:0.9em;}
  .note-wysiwyg.note-page .ProseMirror h1{margin-top:0.4em;}
  .note-wysiwyg.note-page .ProseMirror h2{margin-top:1.5em;}
  .note-wysiwyg.note-page .ProseMirror h3{margin-top:1.2em;}
  .note-wysiwyg.note-page .ProseMirror h1:first-child,.note-wysiwyg.note-page .ProseMirror h2:first-child,.note-wysiwyg.note-page .ProseMirror h3:first-child{margin-top:0;}
  .note-wysiwyg.note-page .ProseMirror hr{margin:2em 0;}
  /* Highlight mark (==text==) */
  .note-wysiwyg .ProseMirror mark{background:${theme.starBg};color:inherit;padding:0.5px 3px;border-radius:3px;box-decoration-break:clone;-webkit-box-decoration-break:clone;}
  /* Slash-menu icon tiles (icon via ::before so it stays out of the label text) */
  .note-wysiwyg .slash-ico::before{content:attr(data-icon);}
  /* Find & replace matches */
  .note-wysiwyg .ProseMirror .search-match{background:${theme.starBg};border-radius:2px;}
  .note-wysiwyg .ProseMirror .search-current{background:${theme.brandBg};outline:1.5px solid ${theme.brand};border-radius:2px;}
  /* Images open full-screen on click */
  .note-wysiwyg .ProseMirror img{cursor:zoom-in;}
  /* Resizable/aligned/captioned image node view */
  .note-wysiwyg .ProseMirror .note-figure{max-width:100%;}
  .note-wysiwyg .ProseMirror .note-figure img{margin:0;cursor:default;}
  /* Math (KaTeX) */
  .note-wysiwyg .ProseMirror .note-math-inline{display:inline-block;}
  .note-wysiwyg .ProseMirror .note-math-block{margin:0.8em 0;text-align:center;}
  .note-wysiwyg .ProseMirror .note-math-block .katex-display{margin:0;}
  .note-wysiwyg .ProseMirror .note-math-inline.ProseMirror-selectednode .note-math-rendered,.note-wysiwyg .ProseMirror .note-math-block.ProseMirror-selectednode .note-math-rendered{outline:2px solid ${theme.brand};border-radius:5px;}
  /* Columns / side-by-side */
  .note-wysiwyg .ProseMirror .note-columns{display:flex;gap:18px;margin:1em 0;align-items:flex-start;}
  .note-wysiwyg .ProseMirror .note-column{flex:1 1 0;min-width:0;border:1px dashed ${theme.border};border-radius:9px;padding:8px 12px;}
  .note-wysiwyg .ProseMirror .note-column > *:first-child{margin-top:0;}
  .note-wysiwyg .ProseMirror .note-column > *:last-child{margin-bottom:0;}
  @media (max-width:640px){.note-wysiwyg .ProseMirror .note-columns{flex-direction:column;gap:10px;}}
  /* Inline media players */
  .note-wysiwyg .ProseMirror .note-video{max-width:100%;max-height:72vh;border-radius:10px;display:block;margin:0.6em 0;background:#000;outline:none;}
  .note-wysiwyg .ProseMirror .note-video.ProseMirror-selectednode{outline:2px solid ${theme.brand};}
  .note-wysiwyg .ProseMirror .note-audio{width:100%;margin:0.7em 0;border-radius:9px;}
  .note-wysiwyg .ProseMirror .note-audio.ProseMirror-selectednode{outline:2px solid ${theme.brand};border-radius:9px;}
  /* Callouts / admonitions — colored panels with a left icon (icon is CSS-only) */
  .note-wysiwyg .ProseMirror .note-callout{position:relative;margin:1em 0;padding:12px 15px 12px 44px;border-radius:11px;border:1px solid ${theme.border};background:${theme.surface2};}
  .note-wysiwyg .ProseMirror .note-callout > *{margin-top:0 !important;}
  .note-wysiwyg .ProseMirror .note-callout > * + *{margin-top:0.5em !important;}
  .note-wysiwyg .ProseMirror .note-callout::before{position:absolute;left:0;top:0;width:34px;text-align:center;padding-top:11px;font-size:15px;font-weight:700;}
  .note-wysiwyg .ProseMirror .note-callout[data-callout="info"]{border-color:${theme.brandBorder};background:${theme.brandBgSoft};}
  .note-wysiwyg .ProseMirror .note-callout[data-callout="info"]::before{content:'ℹ';color:${theme.brand};}
  .note-wysiwyg .ProseMirror .note-callout[data-callout="success"]{border-color:${theme.teal};background:${theme.tealBg};}
  .note-wysiwyg .ProseMirror .note-callout[data-callout="success"]::before{content:'✓';color:${theme.teal};}
  .note-wysiwyg .ProseMirror .note-callout[data-callout="warning"]{border-color:${theme.warn};background:${theme.warnBg};}
  .note-wysiwyg .ProseMirror .note-callout[data-callout="warning"]::before{content:'⚠';color:${theme.warnDark};}
  .note-wysiwyg .ProseMirror .note-callout[data-callout="danger"]{border-color:${theme.dangerBorder2 || theme.danger};background:${theme.dangerBgSoft};}
  .note-wysiwyg .ProseMirror .note-callout[data-callout="danger"]::before{content:'✕';color:${theme.danger};}
  .note-wysiwyg .ProseMirror .note-callout[data-callout="note"]{border-color:${theme.borderStrong};background:${theme.surface3 || theme.surface2};}
  .note-wysiwyg .ProseMirror .note-callout[data-callout="note"]::before{content:'✎';color:${theme.textMuted};}
  /* Block drag-handle (left gutter, appears on hover; reorders blocks) */
  .drag-handle{position:absolute;width:22px;height:24px;z-index:50;cursor:grab;display:flex;align-items:center;justify-content:center;border-radius:6px;transition:background .12s;}
  .drag-handle::before{content:'⠿';color:${theme.textFainter};font-size:16px;line-height:1;}
  .drag-handle:hover{background:${theme.surface};}
  .drag-handle:hover::before{color:${theme.textMuted};}
  .drag-handle:active{cursor:grabbing;}
  .drag-handle.hide{opacity:0;pointer-events:none;}
`;

// Slash-command menu items. Each `run` receives a TipTap chain (already focused,
// with the "/query" text removed) and returns it after applying its block type.
const SLASH_COMMANDS = [
  { key: 'text', label: 'Text', group: 'Basic', icon: 'T', alias: ['paragraph', 'plain', 'p'], run: (c) => c.setParagraph() },
  { key: 'h1', label: 'Heading 1', group: 'Basic', icon: 'H1', alias: ['title', 'h1'], run: (c) => c.toggleHeading({ level: 1 }) },
  { key: 'h2', label: 'Heading 2', group: 'Basic', icon: 'H2', alias: ['subtitle', 'h2'], run: (c) => c.toggleHeading({ level: 2 }) },
  { key: 'h3', label: 'Heading 3', group: 'Basic', icon: 'H3', alias: ['h3'], run: (c) => c.toggleHeading({ level: 3 }) },
  { key: 'bullet', label: 'Bulleted list', group: 'Lists', icon: '•', alias: ['ul', 'unordered'], run: (c) => c.toggleBulletList() },
  { key: 'numbered', label: 'Numbered list', group: 'Lists', icon: '1.', alias: ['ol', 'ordered'], run: (c) => c.toggleOrderedList() },
  { key: 'todo', label: 'To-do list', group: 'Lists', icon: '☑', alias: ['todo', 'task', 'check', 'checkbox'], run: (c) => c.toggleTaskList() },
  { key: 'quote', label: 'Quote', group: 'Blocks', icon: '❝', alias: ['blockquote'], run: (c) => c.toggleBlockquote() },
  { key: 'code', label: 'Code block', group: 'Blocks', icon: '{}', alias: ['pre', 'snippet'], run: (c) => c.toggleCodeBlock() },
  { key: 'math', label: 'Math block', group: 'Blocks', icon: '∑', alias: ['equation', 'latex', 'katex', 'formula', 'tex'], run: (c) => c.setMathBlock('') },
  { key: 'table', label: 'Table', group: 'Blocks', icon: '▦', alias: ['grid'], run: (c) => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }) },
  { key: 'columns', label: 'Two columns', group: 'Blocks', icon: '▚', alias: ['column', 'side by side', 'grid', 'split'], run: (c) => c.setColumns(2) },
  { key: 'divider', label: 'Divider', group: 'Blocks', icon: '—', alias: ['hr', 'rule', 'separator', 'section'], run: (c) => c.setHorizontalRule() },
  { key: 'callout', label: 'Callout', group: 'Callouts', icon: 'ℹ', alias: ['info', 'note', 'aside', 'admonition', 'panel'], run: (c) => c.setCallout('info') },
  { key: 'warning', label: 'Warning callout', group: 'Callouts', icon: '⚠', alias: ['warn', 'caution'], run: (c) => c.setCallout('warning') },
  { key: 'success', label: 'Success callout', group: 'Callouts', icon: '✓', alias: ['tip', 'done', 'ok'], run: (c) => c.setCallout('success') },
  { key: 'danger', label: 'Danger callout', group: 'Callouts', icon: '✕', alias: ['error', 'alert', 'important', 'stop'], run: (c) => c.setCallout('danger') },
  { key: 'image', label: 'Image', group: 'Media', icon: '🖼', alias: ['picture', 'photo', 'img'], upload: 'image' },
  { key: 'file', label: 'File attachment', group: 'Media', icon: '📎', alias: ['attach', 'attachment', 'upload', 'pdf', 'video', 'audio', 'doc'], upload: 'any' },
  { key: 'left', label: 'Align left', group: 'Align', icon: '⤎', alias: ['align'], run: (c) => c.setTextAlign('left') },
  { key: 'center', label: 'Align center', group: 'Align', icon: '↔', alias: ['align', 'centre'], run: (c) => c.setTextAlign('center') },
  { key: 'right', label: 'Align right', group: 'Align', icon: '⤏', alias: ['align'], run: (c) => c.setTextAlign('right') },
];

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

export default function NoteEditor({ value, onChange, placeholder, variant, noteNames, onOpenWikiLink, onUploadFile }) {
  const page = variant === 'page'; // borderless, document-like surface (note full-page)
  const lastEmitted = useRef(value || '');
  const fileInputRef = useRef(null);
  const uploadModeRef = useRef('image'); // 'image' | 'any' — what the picker inserts
  const onUploadRef = useRef(onUploadFile);
  onUploadRef.current = onUploadFile;
  const [slash, setSlash] = useState(null); // { items, index, left, top } when the "/" menu is open
  const [wiki, setWiki] = useState(null); // { items, index, left, top, query } when the "[[" menu is open
  const [emoji, setEmoji] = useState(null); // { items, index, left, top, query } when the ":" menu is open
  const [tableTools, setTableTools] = useState(null); // { top, left } when the caret is in a table
  const [lightbox, setLightbox] = useState(null); // { src, alt } when an image is open full-screen
  const [findOpen, setFindOpen] = useState(false); // find & replace bar
  const [findStat, setFindStat] = useState({ count: 0, current: 0 });
  const [findTerm, setFindTerm] = useState('');
  const [replaceWith, setReplaceWith] = useState('');
  const findInputRef = useRef(null);
  const handleFilesRef = useRef(() => {}); // upload dropped/pasted files (set after insertUploadedFile)
  const slashRef = useRef(null);
  const applyRef = useRef(() => {});
  const wikiRef = useRef(null);
  const applyWikiRef = useRef(() => {});
  const emojiRef = useRef(null);
  const applyEmojiRef = useRef(() => {});
  // Latest props the wiki-link plugin/autocomplete read (the editor is built once).
  const onOpenRef = useRef(onOpenWikiLink);
  const noteNamesRef = useRef(noteNames || []);
  const onChangeRef = useRef(onChange);
  onOpenRef.current = onOpenWikiLink;
  noteNamesRef.current = noteNames || [];
  onChangeRef.current = onChange; // always emit through the latest onChange

  // Floating table controls when the caret sits inside a table.
  const refreshTableTools = (ed) => {
    if (!ed.isActive('table')) return setTableTools(null);
    const { $from } = ed.state.selection;
    let pos = null;
    for (let d = $from.depth; d > 0; d--) {
      if ($from.node(d).type.name === 'table') { pos = $from.before(d); break; }
    }
    if (pos == null) return setTableTools(null);
    const coords = ed.view.coordsAtPos(pos);
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
    setTableTools({ top: Math.max(8, coords.top - 42), left: Math.min(Math.max(8, coords.left), vw - 360) });
  };

  // Show/refresh the slash menu when the caret sits in a paragraph whose text
  // (up to the caret) is exactly "/query" — the Notion trigger.
  const refreshSlash = (ed) => {
    const sel = ed.state.selection;
    if (!sel.empty || sel.$from.parent.type.name !== 'paragraph') return setSlash(null);
    const before = sel.$from.parent.textContent.slice(0, sel.$from.parentOffset);
    const m = /^\/(\S*)$/.exec(before);
    if (!m) return setSlash(null);
    const q = m[1].toLowerCase();
    const items = SLASH_COMMANDS.filter(
      (c) => !q || c.label.toLowerCase().includes(q) || c.alias.some((a) => a.includes(q)),
    );
    if (!items.length) return setSlash(null);
    const coords = ed.view.coordsAtPos(sel.from);
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    const menuH = Math.min(310, 40 + items.length * 34);
    // Flip the menu above the caret when it would overflow the viewport bottom.
    const top = coords.bottom + menuH > vh - 8 ? Math.max(8, coords.top - menuH - 6) : coords.bottom + 6;
    const left = Math.min(coords.left, vw - 236);
    setSlash((p) => ({ items, index: p ? Math.min(p.index, items.length - 1) : 0, left, top }));
  };

  // Show/refresh the "[[" wiki-link autocomplete: when the text before the
  // caret has an unclosed "[[query" (no closing "]]" yet), suggest existing
  // note titles that match the query.
  const refreshWiki = (ed) => {
    const sel = ed.state.selection;
    if (!sel.empty) return setWiki(null);
    const before = sel.$from.parent.textContent.slice(0, sel.$from.parentOffset);
    const m = /\[\[([^[\]]*)$/.exec(before);
    if (!m) return setWiki(null);
    const q = m[1].toLowerCase();
    const names = noteNamesRef.current || [];
    const items = names
      .filter((n) => !q || n.toLowerCase().includes(q))
      .slice(0, 8);
    if (!items.length) return setWiki(null);
    const coords = ed.view.coordsAtPos(sel.from);
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    const menuH = Math.min(300, 34 + items.length * 34);
    const top = coords.bottom + menuH > vh - 8 ? Math.max(8, coords.top - menuH - 6) : coords.bottom + 6;
    const left = Math.min(coords.left, vw - 250);
    setWiki((p) => ({ items, index: p ? Math.min(p.index, items.length - 1) : 0, left, top, query: m[1] }));
  };

  // Show/refresh the ":" emoji picker: ":query" (2+ chars) at a word boundary.
  const refreshEmoji = (ed) => {
    const sel = ed.state.selection;
    if (!sel.empty) return setEmoji(null);
    const before = sel.$from.parent.textContent.slice(0, sel.$from.parentOffset);
    const m = /(?:^|\s):([a-z0-9_+-]{2,})$/i.exec(before);
    if (!m) return setEmoji(null);
    const items = searchEmoji(m[1], 28);
    if (!items.length) return setEmoji(null);
    const coords = ed.view.coordsAtPos(sel.from);
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    const menuH = 210;
    const top = coords.bottom + menuH > vh - 8 ? Math.max(8, coords.top - menuH - 6) : coords.bottom + 6;
    const left = Math.min(coords.left, vw - 260);
    setEmoji((p) => ({ items, index: p ? Math.min(p.index, items.length - 1) : 0, left, top, query: m[1] }));
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      CodeBlock,
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder: placeholder || "Start writing… or press '/' for commands" }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      RichImage.configure({ inline: false, allowBase64: true }),
      Highlight,
      Callout,
      Video,
      Audio,
      MathInline,
      MathBlock,
      Columns,
      Column,
      Table.configure({ resizable: true, cellMinWidth: 60 }),
      TableRow,
      TableHeader,
      TableCell,
      WikiLink.configure({ getOnOpen: () => onOpenRef.current }),
      FoldableHeadings,
      TrailingNode,
      SearchReplace.configure({ onUpdate: (s) => setFindStat(s) }),
      DragHandle.configure({ dragHandleWidth: 22, scrollTreshold: 100 }),
      Markdown.configure({ html: true, tightLists: true, linkify: true, transformPastedText: true }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      const md = unescapeWiki(editor.storage.markdown.getMarkdown());
      lastEmitted.current = md;
      if (onChangeRef.current) onChangeRef.current(md);
      refreshSlash(editor);
      refreshWiki(editor);
      refreshEmoji(editor);
      refreshTableTools(editor);
    },
    onSelectionUpdate: ({ editor }) => { refreshSlash(editor); refreshWiki(editor); refreshEmoji(editor); refreshTableTools(editor); },
    editorProps: {
      // Paste or drop image/media/any files straight into the note — they upload
      // and embed (image inline, video/audio as players, else an attachment chip).
      handlePaste: (view, event) => {
        const files = event.clipboardData && event.clipboardData.files;
        if (files && files.length) { handleFilesRef.current(files); return true; }
        return false;
      },
      handleDrop: (view, event, slice, moved) => {
        if (moved) return false; // internal block drag — let ProseMirror handle it
        const files = event.dataTransfer && event.dataTransfer.files;
        if (files && files.length) { event.preventDefault(); handleFilesRef.current(files); return true; }
        return false;
      },
      handleKeyDown: (view, event) => {
        // ⌘/Ctrl-F opens the in-note find & replace bar (overrides browser find).
        if ((event.metaKey || event.ctrlKey) && (event.key === 'f' || event.key === 'F')) {
          setFindOpen(true);
          setTimeout(() => { if (findInputRef.current) { findInputRef.current.focus(); findInputRef.current.select(); } }, 0);
          return true;
        }
        // The "[[" autocomplete takes precedence when both could be open.
        const w = wikiRef.current;
        if (w) {
          if (event.key === 'Escape') { setWiki(null); return true; }
          if (event.key === 'ArrowDown') { setWiki((p) => p && { ...p, index: (p.index + 1) % p.items.length }); return true; }
          if (event.key === 'ArrowUp') { setWiki((p) => p && { ...p, index: (p.index - 1 + p.items.length) % p.items.length }); return true; }
          if (event.key === 'Enter' || event.key === 'Tab') { applyWikiRef.current(w.items[w.index]); return true; }
          return false;
        }
        const em = emojiRef.current;
        if (em) {
          if (event.key === 'Escape') { setEmoji(null); return true; }
          if (event.key === 'ArrowDown') { setEmoji((p) => p && { ...p, index: (p.index + 1) % p.items.length }); return true; }
          if (event.key === 'ArrowUp') { setEmoji((p) => p && { ...p, index: (p.index - 1 + p.items.length) % p.items.length }); return true; }
          if (event.key === 'Enter' || event.key === 'Tab') { applyEmojiRef.current(em.items[em.index]); return true; }
          return false;
        }
        const s = slashRef.current;
        if (!s) return false;
        if (event.key === 'Escape') { setSlash(null); return true; }
        if (event.key === 'ArrowDown') { setSlash((p) => p && { ...p, index: (p.index + 1) % p.items.length }); return true; }
        if (event.key === 'ArrowUp') { setSlash((p) => p && { ...p, index: (p.index - 1 + p.items.length) % p.items.length }); return true; }
        if (event.key === 'Enter') { applyRef.current(s.items[s.index]); return true; }
        return false;
      },
    },
  });

  // Upload a picked file and insert it: images inline, everything else as a
  // clickable attachment link. The file also lands in the library/gallery.
  const insertUploadedFile = (file) => {
    const up = onUploadRef.current;
    if (!editor || !file || !up) return;
    Promise.resolve(up(file))
      .then((res) => {
        if (!res || !res.url) return;
        const kind = res.kind || '';
        const name = res.name || 'attachment';
        if (kind === 'image') {
          editor.chain().focus().setImage({ src: res.url, alt: res.name || 'image' }).run();
        } else if (kind === 'video') {
          editor.chain().focus().setVideo({ src: res.url, title: name }).run();
        } else if (kind === 'audio') {
          editor.chain().focus().setAudio({ src: res.url, title: name }).run();
        } else {
          // Everything else: a clickable attachment chip on its own line.
          const safe = String(name).replace(/[<>&"]/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[ch]));
          editor.chain().focus().insertContent(
            `<p><a href="${res.url}" target="_blank" rel="noopener">📎 ${safe}</a></p>`
          ).run();
        }
      })
      .catch(() => {});
  };

  const onFilePicked = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ''; // allow re-picking the same file
    if (file) insertUploadedFile(file);
  };
  // Upload every dropped/pasted file, in order.
  handleFilesRef.current = (files) => { Array.from(files).forEach((f) => insertUploadedFile(f)); };

  // Apply a slash command: delete the "/query" text, then run the block command
  // (or, for upload commands, open the file picker).
  const applySlash = (cmd) => {
    if (!editor || !cmd) return;
    const from = editor.state.selection.$from.start();
    const to = editor.state.selection.from;
    editor.chain().focus().deleteRange({ from, to }).run();
    setSlash(null);
    if (cmd.upload) {
      uploadModeRef.current = cmd.upload;
      if (fileInputRef.current) {
        fileInputRef.current.accept = cmd.upload === 'image' ? 'image/*' : '';
        fileInputRef.current.click();
      }
      return;
    }
    cmd.run(editor.chain().focus()).run();
  };
  slashRef.current = slash;
  applyRef.current = applySlash;

  // Complete a "[[query" into "[[Name]]" and place the caret after it.
  const applyWiki = (name) => {
    if (!editor || !name) return;
    const to = editor.state.selection.from;
    const from = to - (wiki?.query?.length || 0);
    editor.chain().focus().insertContentAt({ from, to }, name + ']]').run();
    setWiki(null);
  };
  wikiRef.current = wiki;
  applyWikiRef.current = applyWiki;

  // Replace the ":query" with the chosen emoji character.
  const applyEmoji = (item) => {
    if (!editor || !item) return;
    const to = editor.state.selection.from;
    const from = to - (emoji?.query?.length || 0) - 1; // include the leading ":"
    editor.chain().focus().insertContentAt({ from, to }, item.char + ' ').run();
    setEmoji(null);
  };
  emojiRef.current = emoji;
  applyEmojiRef.current = applyEmoji;

  // Pull an external value change (e.g. the user edited the raw Markdown tab)
  // into the editor - but never while it merely echoes our own last emit, which
  // would fight the caret mid-typing.
  useEffect(() => {
    if (!editor) return;
    if ((value || '') !== lastEmitted.current) {
      lastEmitted.current = value || '';
      editor.commands.setContent(value || '', false);
    }
  }, [value, editor]);

  // Let the image node view open the shared lightbox (its expand button).
  useEffect(() => {
    if (editor && editor.storage.image) editor.storage.image.openLightbox = (s, a) => setLightbox({ src: s, alt: a });
  }, [editor]);

  if (!editor) return null;
  const can = editor.can();
  const setLink = () => {
    const prev = editor.getAttributes('link').href || '';
    const url = window.prompt('Link URL', prev);
    if (url === null) return;
    if (url === '') return editor.chain().focus().extendMarkRange('link').unsetLink().run();
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  // Code block is a *block* toggle, so on a paragraph made of soft line breaks
  // (how single-newline Markdown loads) it would turn the whole note into one
  // code block. Instead: leave an existing code block via toggle, and for a
  // plain caret insert a fresh empty code block rather than swallowing the
  // current text. A real multi-block selection still converts as expected.
  const codeBlock = () => {
    const chain = editor.chain().focus();
    if (editor.isActive('codeBlock')) return chain.toggleCodeBlock().run();
    if (editor.state.selection.empty) return chain.insertContent({ type: 'codeBlock' }).run();
    return chain.toggleCodeBlock().run();
  };

  const sep = () => (
    <span style={{ width: '1px', height: '20px', background: theme.border, margin: '0 3px' }} />
  );

  return (
    <div
      className={page ? 'note-wysiwyg note-page' : 'note-wysiwyg'}
      style={{
        flex: page ? '1 1 auto' : '1 1 340px',
        minHeight: page ? 0 : '240px',
        display: 'flex',
        flexDirection: 'column',
        border: page ? 'none' : `1px solid ${theme.brand}`,
        borderRadius: page ? 0 : '11px',
        overflow: 'hidden',
        background: page ? 'transparent' : theme.white,
      }}
    >
      <style>{prose}</style>
      <input ref={fileInputRef} type="file" onChange={onFilePicked} style={{ display: 'none' }} data-testid="note-file-input" />
      {page ? null : (
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
        <Btn label={<span style={{ fontFamily: "'IBM Plex Mono',monospace" }}>{'<>'}</span>} title="Inline code" active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()} />
        <Btn label={<span style={{ background: theme.starBg, padding: '0 3px', borderRadius: 3 }}>H</span>} title="Highlight" active={editor.isActive('highlight')} onClick={() => editor.chain().focus().toggleHighlight().run()} />
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
        <Btn label={<span style={{ fontFamily: "'IBM Plex Mono',monospace" }}>{'{ }'}</span>} title="Code block" active={editor.isActive('codeBlock')} onClick={codeBlock} />
        <Btn label="🔗" title="Link" active={editor.isActive('link')} onClick={setLink} />
        {sep()}
        <Btn label="↺" title="Undo (⌘Z)" disabled={!can.undo()} onClick={() => editor.chain().focus().undo().run()} />
        <Btn label="↻" title="Redo (⌘⇧Z)" disabled={!can.redo()} onClick={() => editor.chain().focus().redo().run()} />
      </div>
      )}
      <div style={{ flex: '1 1 auto', overflow: page ? 'visible' : 'auto' }}>
        <EditorContent editor={editor} style={{ height: '100%' }} />
      </div>
      <BubbleMenu
        editor={editor}
        tippyOptions={{ duration: 120, maxWidth: 'none' }}
        shouldShow={({ editor: ed, from, to }) => {
          if (from === to) return false; // no selection
          if (ed.isActive('image') || ed.isActive('video') || ed.isActive('audio') || ed.isActive('codeBlock')) return false;
          return true;
        }}
      >
        <div data-testid="note-bubble" onMouseDown={(e) => e.preventDefault()}
          style={{ display: 'flex', alignItems: 'center', gap: 2, padding: 4, background: theme.toastBg, borderRadius: 10, boxShadow: '0 10px 30px rgba(0,0,0,0.34)' }}>
          {[
            ['bold', <b key="b">B</b>, 'Bold', () => editor.chain().focus().toggleBold().run()],
            ['italic', <i key="i">I</i>, 'Italic', () => editor.chain().focus().toggleItalic().run()],
            ['strike', <span key="s" style={{ textDecoration: 'line-through' }}>S</span>, 'Strikethrough', () => editor.chain().focus().toggleStrike().run()],
            ['code', <span key="c" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12 }}>{'<>'}</span>, 'Inline code', () => editor.chain().focus().toggleCode().run()],
            ['highlight', <span key="h">H</span>, 'Highlight', () => editor.chain().focus().toggleHighlight().run()],
            ['link', <span key="l">🔗</span>, 'Link', () => setLink()],
          ].map(([mark, label, title, fn]) => (
            <button key={mark} type="button" title={title} data-testid={`bubble-${mark}`}
              onMouseDown={(e) => { e.preventDefault(); fn(); }}
              style={{ minWidth: 28, height: 28, padding: '0 7px', border: 'none', borderRadius: 7, cursor: 'pointer',
                background: editor.isActive(mark) ? theme.brand : 'transparent',
                color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: "'IBM Plex Sans',sans-serif",
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              {label}
            </button>
          ))}
          <span style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.18)', margin: '0 3px' }} />
          {[
            ['h1', 'H1', 'Heading 1', () => editor.chain().focus().toggleHeading({ level: 1 }).run(), editor.isActive('heading', { level: 1 })],
            ['h2', 'H2', 'Heading 2', () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive('heading', { level: 2 })],
            ['quote', '❝', 'Quote', () => editor.chain().focus().toggleBlockquote().run(), editor.isActive('blockquote')],
          ].map(([key, label, title, fn, active]) => (
            <button key={key} type="button" title={title} data-testid={`bubble-${key}`}
              onMouseDown={(e) => { e.preventDefault(); fn(); }}
              style={{ minWidth: 28, height: 28, padding: '0 7px', border: 'none', borderRadius: 7, cursor: 'pointer',
                background: active ? theme.brand : 'transparent', color: '#fff', fontSize: 12.5, fontWeight: 600,
                fontFamily: "'IBM Plex Sans',sans-serif", display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              {label}
            </button>
          ))}
        </div>
      </BubbleMenu>
      {findOpen ? (() => {
        const closeFind = () => { editor.commands.clearSearch(); setFindOpen(false); setFindTerm(''); editor.commands.focus(); };
        const onTerm = (v) => { setFindTerm(v); editor.commands.setSearch(v); };
        const inp = { height: 30, border: `1px solid ${theme.border}`, borderRadius: 7, padding: '0 9px', fontSize: 13, outline: 'none', background: theme.white, color: theme.text, fontFamily: "'IBM Plex Sans',sans-serif" };
        const ib = { width: 28, height: 28, border: `1px solid ${theme.border}`, borderRadius: 7, background: theme.white, color: theme.text, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 };
        const tb = { height: 30, padding: '0 10px', border: `1px solid ${theme.border}`, borderRadius: 7, background: theme.surface, color: theme.text, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit' };
        return (
          <div data-testid="note-find" onMouseDown={(e) => e.stopPropagation()}
            style={{ position: 'fixed', top: 70, right: 26, zIndex: 90, display: 'flex', flexDirection: 'column', gap: 7, padding: 9,
              background: theme.white, border: `1px solid ${theme.border}`, borderRadius: 12, boxShadow: '0 16px 42px rgba(16,24,40,0.22)', width: 320 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input ref={findInputRef} data-testid="note-find-input" value={findTerm} placeholder="Find in note" style={{ ...inp, flex: 1 }}
                onChange={(e) => onTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); e.shiftKey ? editor.commands.searchPrev() : editor.commands.searchNext(); }
                  else if (e.key === 'Escape') { e.preventDefault(); closeFind(); }
                }} />
              <span data-testid="note-find-count" style={{ minWidth: 48, textAlign: 'center', fontSize: 12, color: theme.textMuted }}>
                {findTerm ? (findStat.count ? `${findStat.current}/${findStat.count}` : '0/0') : ''}
              </span>
              <button data-testid="note-find-prev" title="Previous (⇧⏎)" onClick={() => editor.commands.searchPrev()} style={ib}>↑</button>
              <button data-testid="note-find-next" title="Next (⏎)" onClick={() => editor.commands.searchNext()} style={ib}>↓</button>
              <button data-testid="note-find-close" title="Close (Esc)" onClick={closeFind} style={ib}>✕</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input data-testid="note-replace-input" value={replaceWith} placeholder="Replace with" style={{ ...inp, flex: 1 }}
                onChange={(e) => setReplaceWith(e.target.value)} />
              <button data-testid="note-replace-one" onClick={() => editor.commands.replaceCurrent(replaceWith)} style={tb}>Replace</button>
              <button data-testid="note-replace-all" onClick={() => editor.commands.replaceAll(replaceWith)} style={tb}>All</button>
            </div>
          </div>
        );
      })() : null}
      <Lightbox src={lightbox && lightbox.src} alt={lightbox && lightbox.alt} onClose={() => setLightbox(null)} />
      {tableTools ? (
        <div data-testid="table-tools" onMouseDown={(e) => e.preventDefault()}
          style={{ position: 'fixed', top: tableTools.top, left: tableTools.left, zIndex: 70, display: 'flex', gap: 3, padding: 4, background: theme.white, border: `1px solid ${theme.border}`, borderRadius: 9, boxShadow: '0 8px 24px rgba(16,24,40,0.16)' }}>
          {[
            ['table-add-row', '+ Row', () => editor.chain().focus().addRowAfter().run()],
            ['table-add-col', '+ Col', () => editor.chain().focus().addColumnAfter().run()],
            ['table-del-row', '− Row', () => editor.chain().focus().deleteRow().run()],
            ['table-del-col', '− Col', () => editor.chain().focus().deleteColumn().run()],
            ['table-header', 'Header', () => editor.chain().focus().toggleHeaderRow().run()],
          ].map(([id, label, fn]) => (
            <button key={id} data-testid={id} onClick={fn}
              style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '12.5px', fontWeight: 600, color: theme.text, padding: '5px 8px', borderRadius: 6 }}>{label}</button>
          ))}
          <span style={{ width: 1, background: theme.border, margin: '3px 2px' }} />
          <button data-testid="table-delete" onClick={() => editor.chain().focus().deleteTable().run()}
            style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '12.5px', fontWeight: 600, color: theme.danger, padding: '5px 8px', borderRadius: 6 }}>Delete table</button>
        </div>
      ) : null}
      {slash ? (
        <div
          data-testid="slash-menu"
          style={{
            position: 'fixed', left: slash.left, top: slash.top, zIndex: 80,
            width: 250, maxHeight: 340, overflowY: 'auto', padding: 5,
            background: theme.white, border: `1px solid ${theme.border}`, borderRadius: 11,
            boxShadow: '0 14px 38px rgba(16,24,40,0.2)',
          }}
        >
          {slash.items.map((c, i) => {
            const active = i === slash.index;
            const showHeader = i === 0 || slash.items[i - 1].group !== c.group;
            return (
              <React.Fragment key={c.key}>
                {showHeader ? (
                  <div style={{ padding: i === 0 ? '4px 9px 6px' : '9px 9px 6px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em', color: theme.textFaint, textTransform: 'uppercase' }}>{c.group}</div>
                ) : null}
                <button
                  data-testid="slash-item"
                  onMouseDown={(e) => { e.preventDefault(); applySlash(c); }}
                  onMouseEnter={() => setSlash((p) => p && { ...p, index: i })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 9, width: '100%', border: 'none',
                    background: active ? theme.brandBg : 'transparent',
                    color: active ? theme.brand : theme.text,
                    borderRadius: 7, padding: '6px 8px', cursor: 'pointer', textAlign: 'left',
                    fontFamily: "'IBM Plex Sans',sans-serif", fontSize: '13px', fontWeight: 500,
                  }}
                >
                  <span aria-hidden className="slash-ico" data-icon={c.icon} style={{ flex: '0 0 auto', width: 24, height: 24, borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: c.icon.length > 1 ? 11 : 13, fontWeight: 600, background: active ? theme.white : theme.surface, border: `1px solid ${active ? (theme.brandBorder || theme.border) : theme.border}`, color: active ? theme.brand : theme.textMuted }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label}</span>
                </button>
              </React.Fragment>
            );
          })}
        </div>
      ) : null}
      {wiki ? (
        <div
          data-testid="wiki-menu"
          style={{
            position: 'fixed', left: wiki.left, top: wiki.top, zIndex: 80,
            width: 236, maxHeight: 300, overflowY: 'auto', padding: 5,
            background: theme.white, border: `1px solid ${theme.border}`, borderRadius: 11,
            boxShadow: '0 14px 38px rgba(16,24,40,0.2)',
          }}
        >
          <div style={{ padding: '4px 9px 6px', fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.04em', color: theme.textFaint, textTransform: 'uppercase' }}>Link to note</div>
          {wiki.items.map((n, i) => (
            <button
              key={n}
              data-testid="wiki-item"
              onMouseDown={(e) => { e.preventDefault(); applyWiki(n); }}
              onMouseEnter={() => setWiki((p) => p && { ...p, index: i })}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%', border: 'none',
                background: i === wiki.index ? theme.brandBg : 'transparent',
                color: i === wiki.index ? theme.brand : theme.text,
                borderRadius: 7, padding: '7px 9px', cursor: 'pointer', textAlign: 'left',
                fontFamily: "'IBM Plex Sans',sans-serif", fontSize: '13px', fontWeight: 500,
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flex: '0 0 auto' }}><path d="M9 15l6-6M10.5 6.5l1-1a4 4 0 0 1 6 6l-1 1M13.5 17.5l-1 1a4 4 0 0 1-6-6l1-1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n}</span>
            </button>
          ))}
        </div>
      ) : null}
      {emoji ? (
        <div
          data-testid="emoji-menu"
          style={{
            position: 'fixed', left: emoji.left, top: emoji.top, zIndex: 80,
            width: 250, maxHeight: 214, overflowY: 'auto', padding: 6,
            background: theme.white, border: `1px solid ${theme.border}`, borderRadius: 11,
            boxShadow: '0 14px 38px rgba(16,24,40,0.2)', display: 'flex', flexWrap: 'wrap', gap: 2,
          }}
        >
          {emoji.items.map((e, i) => (
            <button
              key={e.char + e.name}
              data-testid="emoji-item"
              title={`:${e.name}:`}
              onMouseDown={(ev) => { ev.preventDefault(); applyEmoji(e); }}
              onMouseEnter={() => setEmoji((p) => p && { ...p, index: i })}
              style={{
                width: 34, height: 34, border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 19,
                background: i === emoji.index ? theme.brandBg : 'transparent',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {e.char}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
