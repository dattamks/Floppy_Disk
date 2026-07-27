import { describe, it, expect } from 'vitest';
import { highlightJson, highlightYaml } from './highlight';

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
