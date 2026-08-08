import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

// Keep an empty paragraph at the very end of the document. Without it, a note
// that ends in a container-ish block (table, callout, code block, image, video,
// audio, divider) traps the caret — there's nowhere to click or arrow to in
// order to keep writing. This guarantees a landing paragraph after any such
// block, matching what Notion/Obsidian do. The trailing paragraph is plain and
// serializes away to nothing meaningful, so the stored Markdown stays clean.
export const TrailingNode = Extension.create({
  name: 'trailingNode',

  addProseMirrorPlugins() {
    const key = new PluginKey(this.name);
    return [
      new Plugin({
        key,
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((tr) => tr.docChanged)) return null;
          const { doc, tr, schema } = newState;
          const para = schema.nodes.paragraph;
          if (!para) return null;
          const last = doc.lastChild;
          // Already ends in a paragraph → nothing to do (also avoids a loop when
          // this plugin's own insert re-triggers appendTransaction).
          if (last && last.type.name === 'paragraph') return null;
          return tr.insert(doc.content.size, para.create());
        },
      }),
    ];
  },
});
