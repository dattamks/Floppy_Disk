import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

// Renders `[[Note]]` inline as an Obsidian-style link — the brackets dim, the
// title colored and clickable — without changing the underlying text. The doc
// still holds literal `[[Note]]`, so Markdown serialization (and therefore the
// knowledge graph and search) stays exactly as before. Clicking a link calls
// the injected `getOnOpen()` handler with the target title.
const WIKI_RE = /\[\[([^[\]]+)\]\]/g;

export const WikiLink = Extension.create({
  name: 'wikiLink',
  addOptions() {
    return { getOnOpen: () => null };
  },
  addProseMirrorPlugins() {
    const options = this.options;
    return [
      new Plugin({
        key: new PluginKey('wikiLink'),
        props: {
          decorations(state) {
            const decos = [];
            state.doc.descendants((node, pos) => {
              if (!node.isText || !node.text) return;
              const text = node.text;
              WIKI_RE.lastIndex = 0;
              let m;
              while ((m = WIKI_RE.exec(text))) {
                const from = pos + m.index;
                const to = from + m[0].length;
                const target = m[1].trim();
                decos.push(Decoration.inline(from, from + 2, { class: 'wiki-bracket' }));
                decos.push(
                  Decoration.inline(from + 2, to - 2, {
                    class: 'wiki-link',
                    'data-wikilink': target,
                  }),
                );
                decos.push(Decoration.inline(to - 2, to, { class: 'wiki-bracket' }));
              }
            });
            return DecorationSet.create(state.doc, decos);
          },
          handleClickOn(view, pos, node, nodePos, event) {
            const el = event.target;
            const name = el && el.getAttribute && el.getAttribute('data-wikilink');
            if (name != null) {
              const onOpen = options.getOnOpen && options.getOnOpen();
              if (onOpen) {
                event.preventDefault();
                onOpen(name);
                return true;
              }
            }
            return false;
          },
        },
      }),
    ];
  },
});
