import { Node, mergeAttributes } from '@tiptap/core';

// Callout / admonition block — a colored panel with an icon, for notes, tips,
// warnings, etc. Stored as `<div data-callout="type">…</div>` in the note's
// Markdown (tiptap-markdown serializes unknown nodes as HTML in html mode), so
// it round-trips through save/reload and stays valid Markdown. The icon is
// drawn purely with CSS (::before), so it never lands in the stored content.
export const CALLOUT_TYPES = [
  { type: 'info', label: 'Info' },
  { type: 'success', label: 'Success' },
  { type: 'warning', label: 'Warning' },
  { type: 'danger', label: 'Danger' },
  { type: 'note', label: 'Note' },
];

const VALID = new Set(CALLOUT_TYPES.map((c) => c.type));

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      type: {
        default: 'info',
        parseHTML: (el) => {
          const t = el.getAttribute('data-callout') || 'info';
          return VALID.has(t) ? t : 'info';
        },
        renderHTML: (attrs) => ({ 'data-callout': attrs.type || 'info' }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-callout]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'note-callout' }), 0];
  },

  addCommands() {
    return {
      setCallout: (type = 'info') => ({ commands }) => commands.wrapIn(this.name, { type }),
      toggleCallout: (type = 'info') => ({ commands, editor }) => (
        editor.isActive(this.name)
          ? commands.lift(this.name)
          : commands.wrapIn(this.name, { type })
      ),
    };
  },
});
