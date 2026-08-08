import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

// In-note find & replace. Highlights every match (the current one distinctly),
// steps through them, and replaces one or all. Matching is per text node — good
// enough for prose; a phrase split across formatting boundaries won't match,
// which mirrors how most editors behave.
const searchKey = new PluginKey('searchReplace');

function findMatches(doc, term, caseSensitive) {
  const out = [];
  if (!term) return out;
  const needle = caseSensitive ? term : term.toLowerCase();
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const hay = caseSensitive ? node.text : node.text.toLowerCase();
    let i = 0;
    while ((i = hay.indexOf(needle, i)) !== -1) {
      out.push({ from: pos + i, to: pos + i + term.length });
      i += term.length;
    }
  });
  return out;
}

function decorate(doc, results, current) {
  if (!results.length) return DecorationSet.empty;
  return DecorationSet.create(doc, results.map((r, i) =>
    Decoration.inline(r.from, r.to, { class: i === current ? 'search-current' : 'search-match' })));
}

export const SearchReplace = Extension.create({
  name: 'searchReplace',

  addOptions() {
    return { onUpdate: () => {} };
  },

  addStorage() {
    return { term: '', caseSensitive: false, results: [], current: 0 };
  },

  addProseMirrorPlugins() {
    const ext = this;
    const report = () => {
      const s = ext.storage;
      ext.options.onUpdate({ count: s.results.length, current: s.results.length ? s.current + 1 : 0 });
    };
    return [
      new Plugin({
        key: searchKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, old) {
            const refresh = tr.getMeta(searchKey);
            if (refresh || tr.docChanged) {
              const s = ext.storage;
              s.results = findMatches(tr.doc, s.term, s.caseSensitive);
              if (s.current >= s.results.length) s.current = 0;
              report();
              return decorate(tr.doc, s.results, s.current);
            }
            return old.map(tr.mapping, tr.doc);
          },
        },
        props: { decorations(state) { return searchKey.getState(state); } },
      }),
    ];
  },

  addCommands() {
    const refresh = (editor) => editor.view.dispatch(editor.state.tr.setMeta(searchKey, true));
    const scrollToCurrent = (editor) => {
      const s = editor.storage.searchReplace;
      const r = s.results[s.current];
      if (r) editor.chain().setTextSelection({ from: r.from, to: r.to }).scrollIntoView().run();
    };
    return {
      setSearch: (term, caseSensitive = false) => ({ editor }) => {
        const s = editor.storage.searchReplace;
        s.term = term; s.caseSensitive = caseSensitive; s.current = 0;
        refresh(editor);
        return true;
      },
      searchNext: () => ({ editor }) => {
        const s = editor.storage.searchReplace;
        if (!s.results.length) return false;
        s.current = (s.current + 1) % s.results.length;
        refresh(editor); scrollToCurrent(editor);
        return true;
      },
      searchPrev: () => ({ editor }) => {
        const s = editor.storage.searchReplace;
        if (!s.results.length) return false;
        s.current = (s.current - 1 + s.results.length) % s.results.length;
        refresh(editor); scrollToCurrent(editor);
        return true;
      },
      replaceCurrent: (replaceTerm) => ({ editor }) => {
        const s = editor.storage.searchReplace;
        const r = s.results[s.current];
        if (!r) return false;
        editor.view.dispatch(editor.state.tr.insertText(replaceTerm || '', r.from, r.to));
        refresh(editor); scrollToCurrent(editor);
        return true;
      },
      replaceAll: (replaceTerm) => ({ editor }) => {
        const s = editor.storage.searchReplace;
        const results = findMatches(editor.state.doc, s.term, s.caseSensitive);
        if (!results.length) return false;
        let tr = editor.state.tr;
        for (let i = results.length - 1; i >= 0; i--) tr = tr.insertText(replaceTerm || '', results[i].from, results[i].to);
        editor.view.dispatch(tr);
        s.current = 0;
        refresh(editor);
        return true;
      },
      clearSearch: () => ({ editor }) => {
        const s = editor.storage.searchReplace;
        s.term = ''; s.results = []; s.current = 0;
        refresh(editor);
        return true;
      },
    };
  },
});
