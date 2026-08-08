import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import NoteMathView from '../components/NoteMathView';

// LaTeX math for notes: inline `$…$` and block `$$…$$`, rendered live with KaTeX.
// Stored as portable Markdown math (the standard `$`/`$$` delimiters, which
// Obsidian, Pandoc, GitHub, etc. understand). A small markdown-it plugin turns
// those delimiters into <span data-math>/<div data-math> on load, which the
// nodes parse; on save they serialize back to `$…$` / `$$…$$`.

const escAttr = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

// markdown-it: inline `$…$` and block `$$…$$` → data-math elements.
function mathMarkdownPlugin(md) {
  const inlineRule = (state, silent) => {
    const src = state.src;
    if (src[state.pos] !== '$' || src[state.pos + 1] === '$') return false;
    const start = state.pos + 1;
    // Pandoc-style delimiters so ordinary prose with dollar amounts isn't eaten
    // as math: the opening `$` must be followed by a non-space character (rules
    // out "$5"), the closing `$` must be preceded by a non-space character and
    // not be immediately followed by a digit (so "$5, shipping is $10" stays
    // prose, not the equation "5, shipping is").
    if (start >= state.posMax || /\s/.test(src[start])) return false;
    let end = start;
    while (end < state.posMax) {
      if (src[end] === '$' && src[end - 1] !== '\\') break;
      end += 1;
    }
    if (end >= state.posMax || end === start) return false;
    if (/\s/.test(src[end - 1])) return false;
    if (/[0-9]/.test(src[end + 1] || '')) return false;
    const content = src.slice(start, end);
    if (!content.trim()) return false;
    if (!silent) {
      const token = state.push('math_inline', 'span', 0);
      token.content = content;
    }
    state.pos = end + 1;
    return true;
  };
  const blockRule = (state, startLine, endLine, silent) => {
    const begin = state.bMarks[startLine] + state.tShift[startLine];
    let max = state.eMarks[startLine];
    if (begin + 2 > max || state.src.slice(begin, begin + 2) !== '$$') return false;
    const firstRest = state.src.slice(begin + 2, max);
    let content;
    let nextLine = startLine;
    if (firstRest.trim().endsWith('$$') && firstRest.trim().length > 2) {
      content = firstRest.trim().slice(0, -2).trim(); // single-line $$…$$
      nextLine = startLine + 1;
    } else {
      const lines = firstRest ? [firstRest] : [];
      nextLine = startLine + 1;
      let closed = false;
      while (nextLine < endLine) {
        const s = state.bMarks[nextLine] + state.tShift[nextLine];
        const e = state.eMarks[nextLine];
        const line = state.src.slice(s, e);
        if (line.trim() === '$$') { closed = true; break; }
        lines.push(line);
        nextLine += 1;
      }
      if (!closed) return false;
      content = lines.join('\n').trim();
      nextLine += 1;
    }
    if (silent) return true;
    state.line = nextLine;
    const token = state.push('math_block', 'div', 0);
    token.content = content;
    token.map = [startLine, nextLine];
    return true;
  };
  md.inline.ruler.before('escape', 'math_inline', inlineRule);
  md.block.ruler.before('fence', 'math_block', blockRule, { alt: ['paragraph', 'blockquote'] });
  md.renderer.rules.math_inline = (t, i) => `<span data-math="${escAttr(t[i].content)}"></span>`;
  md.renderer.rules.math_block = (t, i) => `<div data-math="${escAttr(t[i].content)}"></div>\n`;
}

const mathAttrs = () => ({
  latex: {
    default: '',
    parseHTML: (el) => el.getAttribute('data-math') || '',
    renderHTML: (attrs) => ({ 'data-math': attrs.latex || '' }),
  },
});

export const MathInline = Node.create({
  name: 'mathInline',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes: mathAttrs,
  parseHTML() { return [{ tag: 'span[data-math]' }]; },
  renderHTML({ HTMLAttributes }) { return ['span', mergeAttributes(HTMLAttributes, { class: 'note-math-inline' })]; },
  addNodeView() { return ReactNodeViewRenderer(NoteMathView); },
  addCommands() {
    return { setMathInline: (latex = '') => ({ commands }) => commands.insertContent({ type: this.name, attrs: { latex } }) };
  },
  addStorage() {
    return {
      markdown: {
        serialize(state, node) { state.write(`$${node.attrs.latex || ''}$`); },
        parse: {},
      },
    };
  },
});

export const MathBlock = Node.create({
  name: 'mathBlock',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes: mathAttrs,
  parseHTML() { return [{ tag: 'div[data-math]' }]; },
  renderHTML({ HTMLAttributes }) { return ['div', mergeAttributes(HTMLAttributes, { class: 'note-math-block' })]; },
  addNodeView() { return ReactNodeViewRenderer(NoteMathView); },
  addCommands() {
    return { setMathBlock: (latex = '') => ({ commands }) => commands.insertContent({ type: this.name, attrs: { latex } }) };
  },
  addStorage() {
    return {
      markdown: {
        serialize(state, node) { state.write(`$$\n${node.attrs.latex || ''}\n$$`); state.closeBlock(node); },
        // One registration wires both inline + block delimiters.
        parse: { setup(md) { md.use(mathMarkdownPlugin); } },
      },
    };
  },
});
