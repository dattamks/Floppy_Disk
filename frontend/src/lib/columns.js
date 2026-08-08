import { Node, mergeAttributes } from '@tiptap/core';

// Side-by-side columns for notes. A `columns` block holds 2–4 `column` nodes,
// each with its own block content. Stored as <div data-columns><div data-column>
// …</div>…</div> HTML in the note's Markdown (tiptap-markdown serializes these
// as HTML in html mode), so they round-trip through save/reload and collapse to
// a single stack on narrow screens / in exports.

export const Column = Node.create({
  name: 'column',
  content: 'block+',
  isolating: true,
  parseHTML() { return [{ tag: 'div[data-column]' }]; },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-column': '', class: 'note-column' }), 0];
  },
});

export const Columns = Node.create({
  name: 'columns',
  group: 'block',
  content: 'column{2,4}',
  isolating: true,
  parseHTML() { return [{ tag: 'div[data-columns]' }]; },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-columns': '', class: 'note-columns' }), 0];
  },
  addCommands() {
    return {
      setColumns: (n = 2) => ({ chain }) => {
        const count = Math.max(2, Math.min(4, n));
        const cols = Array.from({ length: count }, () => ({ type: 'column', content: [{ type: 'paragraph' }] }));
        return chain().insertContent({ type: this.name, content: cols }).run();
      },
    };
  },
});
