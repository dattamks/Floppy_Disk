import { describe, it, expect } from 'vitest';
import { bundleHtml, bundleMarkdown, collectAssetUrls, parseFileId, safeName, makeZip } from './notebundle';

const u8 = (n) => new Uint8Array(n);
const asset = (name, size, { dataUri = null } = {}) => ({ u8: u8(Math.min(size, 8)), size, type: '', dataUri, name });

describe('notebundle', () => {
  it('parses file ids and safe names', () => {
    expect(parseFileId('/api/v1/storage/files/abc-123/raw')).toBe('abc-123');
    expect(safeName('a/b:c*.png')).toBe('a_b_c_.png');
  });

  it('collects media + attachment urls', () => {
    const html = '<img src="/files/i1/raw"/><video src="/files/v1/raw"></video><a href="/files/a1/raw">x</a>';
    expect(collectAssetUrls(html).sort()).toEqual(['/files/a1/raw', '/files/i1/raw', '/files/v1/raw']);
  });

  it('HTML: embeds small media, folders large media + attachments', () => {
    const doc = '<div><img alt="" src="/files/i1/raw"/><video class="note-media" controls src="/files/v1/raw"></video><a href="/files/a1/raw">📎 spec.pdf</a></div>';
    const assets = new Map([
      ['/files/i1/raw', asset('small.png', 500, { dataUri: 'data:image/png;base64,AA' })],
      ['/files/v1/raw', asset('clip.mp4', 5 * 1024 * 1024)],
      ['/files/a1/raw', asset('spec.pdf', 1000)],
    ]);
    const { doc: out, files } = bundleHtml(doc, assets, { embedCap: 1024 * 1024 });
    expect(out).toContain('src="data:image/png;base64,AA"'); // small image embedded
    expect(out).toContain('src="media/clip.mp4"'); // large video foldered
    expect(out).toContain('href="sources/spec.pdf"'); // attachment foldered
    expect(Object.keys(files).sort()).toEqual(['media/clip.mp4', 'sources/spec.pdf']);
  });

  it('Markdown: same routing, images before attachments', () => {
    const md = '![map](/files/i1/raw)\n\n[📎 spec.pdf](/files/a1/raw)';
    const assets = new Map([
      ['/files/i1/raw', asset('map.png', 5 * 1024 * 1024)],
      ['/files/a1/raw', asset('spec.pdf', 1000)],
    ]);
    const { md: out, files } = bundleMarkdown(md, assets, { embedCap: 1024 * 1024 });
    expect(out).toContain('![map](media/map.png)');
    expect(out).toContain('[📎 spec.pdf](sources/spec.pdf)');
    expect(Object.keys(files).sort()).toEqual(['media/map.png', 'sources/spec.pdf']);
  });

  it('dedupes colliding filenames', () => {
    const doc = '<img src="/files/i1/raw"/><img src="/files/i2/raw"/>';
    const assets = new Map([
      ['/files/i1/raw', asset('photo.png', 5e6)],
      ['/files/i2/raw', asset('photo.png', 5e6)],
    ]);
    const { files } = bundleHtml(doc, assets, { embedCap: 1024 });
    expect(Object.keys(files).sort()).toEqual(['media/photo-1.png', 'media/photo.png']);
  });

  it('produces a real zip archive', () => {
    const zip = makeZip({ 'a.txt': new TextEncoder().encode('hi'), 'media/x.bin': u8(4) });
    expect(zip[0]).toBe(0x50); // 'P'
    expect(zip[1]).toBe(0x4b); // 'K' — zip magic
    expect(zip.length).toBeGreaterThan(20);
  });
});
