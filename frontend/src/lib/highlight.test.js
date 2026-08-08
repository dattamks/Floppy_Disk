import { describe, it, expect } from 'vitest';
import { highlightJson, highlightYaml, highlightCode } from './highlight';

describe('highlightJson', () => {
  it('marks keys, strings, numbers, and keywords', () => {
    const html = highlightJson('{"name": "floppy", "n": 3, "ok": true, "x": null}');
    expect(html).toContain('<span class="tok-key">"name"</span>:');
    expect(html).toContain('<span class="tok-str">"floppy"</span>');
    expect(html).toContain('<span class="tok-num">3</span>');
    expect(html).toContain('<span class="tok-kw">true</span>');
    expect(html).toContain('<span class="tok-kw">null</span>');
  });

  it('escapes angle brackets in content', () => {
    const html = highlightJson('{"html": "<b>hi</b>"}');
    expect(html).not.toContain('<b>');
    expect(html).toContain('&lt;b&gt;');
  });
});

describe('highlightYaml', () => {
  it('marks comments, keys, and quoted strings', () => {
    const html = highlightYaml('# a comment\nhost: "localhost"\nport: 8000\ndebug: true');
    expect(html).toContain('<span class="tok-comment"># a comment</span>');
    expect(html).toContain('<span class="tok-key">host</span>:');
    expect(html).toContain('<span class="tok-str">"localhost"</span>');
    expect(html).toContain('<span class="tok-kw">true</span>');
  });

  it('escapes angle brackets', () => {
    const html = highlightYaml('note: <script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('highlightCode', () => {
  it('marks keywords, strings, numbers, and // line comments', () => {
    const html = highlightCode('const x = "hi"; // note\nreturn 42', 'js');
    expect(html).toContain('<span class="tok-kw">const</span>');
    expect(html).toContain('<span class="tok-str">"hi"</span>');
    expect(html).toContain('<span class="tok-comment">// note</span>');
    expect(html).toContain('<span class="tok-num">42</span>');
    expect(html).toContain('<span class="tok-kw">return</span>');
  });

  it('treats # as a comment only for hash-comment languages', () => {
    expect(highlightCode('# a python comment', 'py')).toContain('<span class="tok-comment"># a python comment</span>');
    // In CSS, `#` is not a comment - a hex colour must not be greyed out.
    expect(highlightCode('.a { color: #fff }', 'css')).not.toContain('tok-comment');
  });

  it('handles block comments and escapes angle brackets', () => {
    const html = highlightCode('/* <b> */ let y = 1', 'ts');
    expect(html).toContain('<span class="tok-comment">/* &lt;b&gt; */</span>');
    expect(html).not.toContain('<b>');
  });

  it('does not tokenize keywords inside a string', () => {
    const html = highlightCode('const s = "return const"', 'js');
    // The whole quoted text stays one string token; no stray keyword spans inside.
    expect(html).toContain('<span class="tok-str">"return const"</span>');
  });
});
