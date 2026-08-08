import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

// Foldable headings, Obsidian-style: a chevron in the heading's left gutter
// collapses everything under it (down to the next heading of the same or higher
// level). Fold state lives in plugin state and is mapped across edits, so the
// document itself is never mutated — collapsed blocks are just hidden with a
// display:none decoration.
const foldKey = new PluginKey('foldHeadings');

function topChildren(doc) {
  const kids = [];
  doc.forEach((node, offset, index) => kids.push({ node, pos: offset, index }));
  return kids;
}

// The document positions hidden when the heading at `pos` is folded.
function foldedRange(kids, i) {
  const level = kids[i].node.attrs.level;
  let from = null;
  let to = null;
  for (let j = i + 1; j < kids.length; j++) {
    const k = kids[j];
    if (k.node.type.name === 'heading' && k.node.attrs.level <= level) break;
    if (from == null) from = k.pos;
    to = k.pos + k.node.nodeSize;
  }
  return from == null ? null : { from, to };
}

// Toggle the fold at `headingPos`, keeping the caret out of any hidden range.
function toggleFold(view, headingPos) {
  const state = view.state;
  const folded = foldKey.getState(state) || [];
  const willFold = !folded.includes(headingPos);
  const tr = state.tr.setMeta(foldKey, { toggle: headingPos });
  if (willFold) {
    const kids = topChildren(state.doc);
    const idx = kids.findIndex((k) => k.pos === headingPos);
    const r = idx >= 0 ? foldedRange(kids, idx) : null;
    const sel = state.selection;
    if (r && sel.from >= r.from && sel.from <= r.to) {
      const node = kids[idx].node;
      tr.setSelection(sel.constructor.near(tr.doc.resolve(headingPos + node.nodeSize - 1)));
    }
  }
  view.dispatch(tr);
  view.focus();
}

function chevronDOM(view, pos, folded) {
  const el = document.createElement('span');
  el.className = 'nd-fold-toggle' + (folded ? ' is-folded' : '');
  el.setAttribute('contenteditable', 'false');
  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', folded ? 'Expand section' : 'Collapse section');
  el.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFold(view, pos);
  });
  return el;
}

function buildDecorations(doc, folded) {
  const set = new Set(folded);
  const kids = topChildren(doc);
  const decos = [];
  for (let i = 0; i < kids.length; i++) {
    const { node, pos } = kids[i];
    if (node.type.name !== 'heading') continue;
    const isFolded = set.has(pos);
    decos.push(Decoration.node(pos, pos + node.nodeSize, { class: isFolded ? 'nd-heading nd-folded-head' : 'nd-heading' }));
    decos.push(Decoration.widget(pos + 1, (view) => chevronDOM(view, pos, isFolded), { side: -1, key: 'fold' + pos + isFolded }));
    if (isFolded) {
      const r = foldedRange(kids, i);
      if (r) {
        for (let j = i + 1; j < kids.length; j++) {
          const k = kids[j];
          if (k.pos < r.from || k.pos >= r.to) continue;
          decos.push(Decoration.node(k.pos, k.pos + k.node.nodeSize, { class: 'nd-folded' }));
        }
      }
    }
  }
  return DecorationSet.create(doc, decos);
}

export const FoldableHeadings = Extension.create({
  name: 'foldableHeadings',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: foldKey,
        state: {
          init: () => [],
          apply(tr, value) {
            let folded = value;
            const meta = tr.getMeta(foldKey);
            if (meta && meta.toggle != null) {
              folded = folded.includes(meta.toggle)
                ? folded.filter((p) => p !== meta.toggle)
                : [...folded, meta.toggle];
            }
            if (tr.docChanged) {
              folded = folded
                .map((p) => tr.mapping.map(p, -1))
                .filter((p) => {
                  const n = tr.doc.nodeAt(p);
                  return n && n.type.name === 'heading';
                });
            }
            return folded;
          },
        },
        props: {
          decorations(state) {
            return buildDecorations(state.doc, foldKey.getState(state));
          },
        },
      }),
    ];
  },
});
