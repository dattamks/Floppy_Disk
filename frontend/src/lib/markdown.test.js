import { describe, it, expect } from 'vitest';
import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it('renders headings, bold, italic, and inline code', () => {
    const html = renderMarkdown('# Title\n\nsome **bold** and *italic* and `code`.');
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
    expect(html).toContain('<code>code</code>');
  });

  it('renders unordered and ordered lists', () => {
    const ul = renderMarkdown('- one\n- two');
    expect(ul).toContain('<ul>');
    expect(ul).toContain('<li>one</li>');
    const ol = renderMarkdown('1. first\n2. second');
    expect(ol).toContain('<ol>');
    expect(ol).toContain('<li>first</li>');
  });

  it('renders fenced code blocks verbatim', () => {
    const html = renderMarkdown('```\nconst x = 1;\n```');
    expect(html).toContain('<pre class="md-pre"><code>const x = 1;</code></pre>');
  });

  it('is XSS-safe: raw HTML is escaped, not injected', () => {
    const html = renderMarkdown('<script>alert(1)</script>\n\nhi');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('renders links but neutralizes dangerous hrefs', () => {
    const ok = renderMarkdown('[site](https://example.com)');
    expect(ok).toContain('href="https://example.com"');
    const bad = renderMarkdown('[x](javascript:alert(1))');
    expect(bad).not.toContain('javascript:');
    expect(bad).toContain('href="#"');
  });

  it('leaves intra-word underscores alone (snake_case, underscored URLs)', () => {
    const html = renderMarkdown('call some_variable_name here');
    expect(html).toContain('some_variable_name');
    expect(html).not.toContain('<em>');
    const link = renderMarkdown('[doc](/files/my_file_name.pdf)');
    expect(link).toContain('href="/files/my_file_name.pdf"');
  });

  it('still emphasizes underscores at word boundaries', () => {
    expect(renderMarkdown('an _italic_ word')).toContain('<em>italic</em>');
  });
});
