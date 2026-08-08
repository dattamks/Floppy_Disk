// Turn a note's server-hosted media (/storage/files/<id>/raw) into a fully
// self-contained export. Each referenced image/video/audio is fetched once and
// inlined as a base64 data: URI, so the exported .html/.md renders anywhere —
// offline, emailed, moved to another machine — with no dependency on the running
// server. Files above a size cap are NOT inlined (a multi-hundred-MB base64 blob
// would make the export unusable); those become a labeled "external media" card
// that names the file and links back to it.

const DEFAULT_CAP = 24 * 1024 * 1024; // 24 MB — inline anything at or below this

async function fetchDataUri(url) {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const dataUri = await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(new Error('read failed'));
    fr.readAsDataURL(blob);
  });
  return { dataUri, size: blob.size, type: blob.type || '' };
}

const humanSize = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

// Collect the unique src URLs referenced by <img>/<video>/<audio> in some HTML.
function collectSrcs(html) {
  const urls = new Set();
  const re = /<(img|video|audio)\b[^>]*\bsrc="([^"]+)"/gi;
  let m;
  while ((m = re.exec(html))) {
    const u = m[2];
    if (/^(https?:|\/|\.)/i.test(u)) urls.add(u);
  }
  return [...urls];
}

// Fetch every referenced media URL once; return a Map url -> {dataUri,size,type} or {failed:true}.
export async function buildMediaMap(urls, cap = DEFAULT_CAP) {
  const map = new Map();
  await Promise.all(urls.map(async (u) => {
    try { map.set(u, await fetchDataUri(u)); }
    catch { map.set(u, { failed: true }); }
  }));
  return map;
}

// Rewrite export HTML so media is self-contained. Images inline when possible;
// video/audio inline when small (unless `mediaAsCard` forces a card, e.g. for
// PDF, where a player can't print). A card names the file and links to it — an
// absolute URL when we can resolve one, so the link survives outside the app.
export async function embedMediaInHtml(html, { cap = DEFAULT_CAP, mediaAsCard = false } = {}) {
  const urls = collectSrcs(html);
  if (!urls.length) return html;
  const map = await buildMediaMap(urls, cap);
  const nameFromUrl = (u) => decodeURIComponent((u.split('/').filter(Boolean).slice(-2, -1)[0] || 'file'));
  const origin = (typeof window !== 'undefined' && window.location && window.location.origin) || '';
  const absolute = (u) => (u && u[0] === '/' ? origin + u : u);
  const card = (tag, src, info) => {
    const label = tag === 'video' ? '▶ Video' : '♪ Audio';
    const sz = info && info.size ? ` · ${humanSize(info.size)}` : '';
    const href = absolute(src);
    const link = href ? `<a class="media-link" href="${href}">Open ${nameFromUrl(src)}</a>` : '';
    return `<div class="media-card"><span class="media-ic">${label}</span><span class="media-name">${nameFromUrl(src)}${sz}</span>${link}</div>`;
  };

  html = html.replace(/<(video|audio)\b([^>]*)\bsrc="([^"]+)"([^>]*)>\s*<\/\1>/gi, (m, tag, pre, src, post) => {
    const info = map.get(src);
    if (!mediaAsCard && info && !info.failed && info.size <= cap) return `<${tag}${pre}src="${info.dataUri}"${post}></${tag}>`;
    return card(tag, src, info);
  });
  html = html.replace(/<img\b([^>]*)\bsrc="([^"]+)"([^>]*)>/gi, (m, pre, src, post) => {
    const info = map.get(src);
    if (info && !info.failed && info.size <= cap) return `<img${pre}src="${info.dataUri}"${post}>`;
    return m;
  });
  return html;
}

// Rewrite a note's Markdown so images embed as data URIs (portable .md). Video /
// audio have no Markdown player, so their stored <video>/<audio> tags are inlined
// as data URIs when small (Markdown allows HTML) or turned into a labeled link.
export async function embedMediaInMarkdown(md, { cap = DEFAULT_CAP } = {}) {
  let src = String(md || '');
  const urls = new Set();
  src.replace(/!\[[^\]]*\]\(([^)]+)\)/g, (m, u) => { if (/^(https?:|\/|\.)/i.test(u)) urls.add(u); return m; });
  src.replace(/<(?:video|audio)\b[^>]*\bsrc="([^"]+)"/gi, (m, u) => { if (/^(https?:|\/|\.)/i.test(u)) urls.add(u); return m; });
  if (!urls.size) return md;
  const map = await buildMediaMap([...urls], cap);
  const nameFromUrl = (u) => decodeURIComponent((u.split('/').filter(Boolean).slice(-2, -1)[0] || 'file'));

  src = src.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (m, alt, u) => {
    const info = map.get(u);
    return info && !info.failed && info.size <= cap ? `![${alt}](${info.dataUri})` : m;
  });
  src = src.replace(/<(video|audio)\b([^>]*)\bsrc="([^"]+)"([^>]*)>\s*<\/\1>/gi, (m, tag, pre, u, post) => {
    const info = map.get(u);
    if (info && !info.failed && info.size <= cap) return `<${tag}${pre}src="${info.dataUri}"${post}></${tag}>`;
    const label = tag === 'video' ? '▶ Video' : '♪ Audio';
    return `[${label}: ${nameFromUrl(u)}](${u})`;
  });
  return src;
}
