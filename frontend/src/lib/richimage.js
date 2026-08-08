import Image from '@tiptap/extension-image';
import { ReactNodeViewRenderer } from '@tiptap/react';
import NoteImageView from '../components/NoteImageView';

// Image with resize (width), alignment, and an optional caption. To keep notes
// as clean Markdown, a plain image still serializes as `![alt](src)`; once it's
// resized / aligned / captioned it switches to a single HTML <img> that carries
// those as attributes (width, data-align, data-caption). Markdown allows HTML,
// and a single tag round-trips through parseHTML with no fragile ancestor
// lookups. On export the tag is rendered as a proper <figure>/<figcaption>.

const parseWidth = (el) => {
  const w = el.getAttribute('width') || (el.style && el.style.width) || '';
  const n = parseInt(w, 10);
  return n > 0 ? n : null;
};
const escAttr = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export const RichImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => parseWidth(el),
        renderHTML: (attrs) => (attrs.width ? { width: attrs.width } : {}),
      },
      align: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-align') || null,
        renderHTML: (attrs) => (attrs.align ? { 'data-align': attrs.align } : {}),
      },
      caption: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-caption') || null,
        renderHTML: (attrs) => (attrs.caption ? { 'data-caption': attrs.caption } : {}),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'img[src]',
        getAttrs: (img) => ({
          src: img.getAttribute('src'),
          alt: img.getAttribute('alt'),
          title: img.getAttribute('title'),
          width: parseWidth(img),
          align: img.getAttribute('data-align') || null,
          caption: img.getAttribute('data-caption') || null,
        }),
      },
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(NoteImageView);
  },

  addStorage() {
    return {
      // Where NoteEditor stashes the lightbox opener so the node view can call it.
      openLightbox: null,
      markdown: {
        serialize(state, node) {
          const { src, alt, title, width, align, caption } = node.attrs;
          if (!width && !align && !caption) {
            state.write(`![${state.esc(alt || '')}](${src}${title ? ` ${state.quote(title)}` : ''})`);
            state.closeBlock(node);
            return;
          }
          const attrs = [`src="${escAttr(src)}"`, `alt="${escAttr(alt)}"`];
          if (width) attrs.push(`width="${width}"`);
          if (align) attrs.push(`data-align="${align}"`);
          if (caption) attrs.push(`data-caption="${escAttr(caption)}"`);
          state.write(`<img ${attrs.join(' ')}>`);
          state.closeBlock(node);
        },
        parse: {}, // ![](): markdown-it; <img …>: parseHTML
      },
    };
  },
});
