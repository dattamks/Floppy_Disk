import { describe, it, expect } from 'vitest';
import { renderNoteHtml } from './noteexport';

describe('renderNoteHtml', () => {
  it('renders headings, emphasis, highlight and code', () => {
    const h = renderNoteHtml('# Title\n\n**b** *i* ==hi== `c`');
    expect(h).toContain('<h1>Title</h1>');
    expect(h).toContain('<strong>b</strong>');
    expect(h).toContain('<mark>hi</mark>');
    expect(h).toContain('<code>c</code>');
  });

  it('renders images as <img>', () => {
    expect(renderNoteHtml('![alt](/a/raw)')).toContain('<img alt="alt" src="/a/raw"/>');
  });

  it('renders pipe tables', () => {
    const h = renderNoteHtml('| A | B |\n| --- | --- |\n| 1 | 2 |');
    expect(h).toContain('<table>');
    expect(h).toMatch(/<th>A<\/th>/);
    expect(h).toMatch(/<td>1<\/td>/);
  });

  it('passes through callout blocks with a type class', () => {
    const h = renderNoteHtml('<div class="note-callout" data-callout="warning"><p>hi</p></div>');
    expect(h).toContain('callout callout-warning');
    expect(h).toContain('<p>hi</p>');
  });

  it('rebuilds video/audio as sanitized media tags', () => {
    const h = renderNoteHtml('<video src="/v/raw" controls="true"></video>');
    expect(h).toContain('<video class="note-media" controls preload="metadata" src="/v/raw"></video>');
  });

  it('renders task lists and blockquotes', () => {
    const h = renderNoteHtml('- [x] done\n- [ ] todo\n\n> quote');
    expect(h).toContain('checkbox');
    expect(h).toContain('<blockquote>quote</blockquote>');
  });

  it('does not emit raw script tags', () => {
    const h = renderNoteHtml('<script>alert(1)</script>');
    expect(h).not.toContain('<script>');
  });

  it('renders wiki-links as display text, not dead links', () => {
    const h = renderNoteHtml('see [[My Note|alias]] here');
    expect(h).toContain('<span class="wikilink">My Note</span>');
  });

  it('renders resized/aligned images as an aligned figure with width', () => {
    const h = renderNoteHtml('<img src="/f/raw" alt="A" width="280" data-align="center">');
    expect(h).toContain('note-figure align-center');
    expect(h).toContain('<img src="/f/raw" alt="A" width="280">');
  });

  it('renders inline and block math as MathML', () => {
    const h = renderNoteHtml('inline $a^2$ and\n\n$$\n\\int x\n$$');
    expect((h.match(/<math/g) || []).length).toBe(2);
    expect(h).toContain('note-math-block');
  });

  it('leaves dollar amounts in prose alone (not parsed as math)', () => {
    const h = renderNoteHtml('The item is $5, shipping is $10 total.');
    expect(h).not.toContain('<math');
    expect(h).toContain('$5');
    expect(h).toContain('$10');
  });

  it('renders columns side by side, nesting a callout', () => {
    const md = '<div data-columns=""><div data-column=""><p>Left</p></div><div data-column=""><div data-callout="info"><p>Hi</p></div></div></div>';
    const h = renderNoteHtml(md);
    expect(h).toContain('export-columns');
    expect((h.match(/class="export-col"/g) || []).length).toBe(2);
    expect(h).toContain('callout callout-info');
  });

  it('renders a captioned image as a figure with figcaption', () => {
    const h = renderNoteHtml('<img src="/f/raw" alt="C" data-align="right" data-caption="Hi there">');
    expect(h).toContain('note-figure align-right');
    expect(h).toContain('<figcaption>Hi there</figcaption>');
  });
});
