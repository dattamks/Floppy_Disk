import { Node, mergeAttributes } from '@tiptap/core';

// Inline media players for notes. An uploaded video or audio file becomes a real
// <video>/<audio> element (not a bare link), stored as that HTML tag in the
// note's Markdown — tiptap-markdown serializes these nodes as HTML in html mode,
// so they round-trip through save/reload. Both are atoms (no editable content)
// and draggable, so the block drag-handle can reorder them.
const mediaAttributes = () => ({
  src: {
    default: null,
    parseHTML: (el) => el.getAttribute('src'),
    renderHTML: (attrs) => (attrs.src ? { src: attrs.src } : {}),
  },
  title: {
    default: null,
    parseHTML: (el) => el.getAttribute('title'),
    renderHTML: (attrs) => (attrs.title ? { title: attrs.title } : {}),
  },
});

export const Video = Node.create({
  name: 'video',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes: mediaAttributes,
  parseHTML() {
    return [{ tag: 'video[src]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['video', mergeAttributes(HTMLAttributes, { controls: 'true', preload: 'metadata', class: 'note-video' })];
  },
  addCommands() {
    return {
      setVideo: (opts) => ({ commands }) => commands.insertContent({ type: this.name, attrs: opts }),
    };
  },
});

export const Audio = Node.create({
  name: 'audio',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes: mediaAttributes,
  parseHTML() {
    return [{ tag: 'audio[src]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['audio', mergeAttributes(HTMLAttributes, { controls: 'true', preload: 'metadata', class: 'note-audio' })];
  },
  addCommands() {
    return {
      setAudio: (opts) => ({ commands }) => commands.insertContent({ type: this.name, attrs: opts }),
    };
  },
});
