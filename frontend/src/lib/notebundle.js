import { zipSync } from 'fflate';

// Bundle a note's export with its media. Small media embed inline (data: URI);
// larger media move into a `media/` folder and attachments into a `sources/`
// folder, referenced by relative path, all packed into a single .zip. If nothing
// needs a folder (everything embedded, no attachments), callers fall back to a
// plain single-file export.
//
// The rewriting here is pure (string → string + a file map); the caller fetches
// each asset's bytes and passes them in via `assets` (a Map url → asset), so this
// module stays testable and free of browser fetch/FileReader APIs.

// Extract the storage file id from a .../files/<id>/raw URL.
export function parseFileId(url) {
  const m = /\/files\/([^/?#]+)\/raw/.exec(url || '');
  return m ? m[1] : null;
}

// A filesystem-safe base name (no separators/control chars, bounded length).
export function safeName(name) {
  const n = String(name || 'file').replace(/[\\/:*?"<>|\x00-\x1f]+/g, '_').replace(/^\.+/, '').trim();
  return n.slice(0, 120) || 'file';
}

function uniquePath(used, folder, name) {
  const base = safeName(name);
  let candidate = `${folder}/${base}`;
  if (!used.has(candidate)) { used.add(candidate); return candidate; }
  const dot = base.lastIndexOf('.');
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot) : '';
  let i = 1;
  while (used.has(`${folder}/${stem}-${i}${ext}`)) i += 1;
  candidate = `${folder}/${stem}-${i}${ext}`;
  used.add(candidate);
  return candidate;
}

// Rewrite a full HTML document so its media/attachments become inline data URIs
// (small) or relative paths into media/ + sources/ (foldered). Returns the new
// HTML and the map of folder files.
export function bundleHtml(doc, assets, { embedCap }) {
  const files = {};
  const used = new Set();
  let out = doc;
  const put = (folder, a) => { const p = uniquePath(used, folder, a.name); files[p] = a.u8; return p; };
  const rewriteMedia = (re) => {
    out = out.replace(re, (m, pre, url, post) => {
      const a = assets.get(url);
      if (!a) return m;
      if (a.size <= embedCap && a.dataUri) return pre + a.dataUri + post;
      return pre + put('media', a) + post;
    });
  };
  rewriteMedia(/(<img\b[^>]*?\bsrc=")([^"]+)(")/gi);
  rewriteMedia(/(<(?:video|audio)\b[^>]*?\bsrc=")([^"]+)(")/gi);
  // Attachments (non-media links to stored files) always move to sources/.
  out = out.replace(/(<a\b[^>]*?\bhref=")([^"]+\/raw)(")/gi, (m, pre, url, post) => {
    const a = assets.get(url);
    if (!a) return m;
    return pre + put('sources', a) + post;
  });
  return { doc: out, files };
}

// Rewrite note Markdown the same way: images embed (small) or move to media/;
// <video>/<audio> tags likewise; attachment links [name](…/raw) move to sources/.
// Images are rewritten first, so their URLs no longer end in /raw and the
// attachment pass can't touch them.
export function bundleMarkdown(md, assets, { embedCap }) {
  const files = {};
  const used = new Set();
  let out = String(md || '');
  const put = (folder, a) => { const p = uniquePath(used, folder, a.name); files[p] = a.u8; return p; };
  const embedOrFolder = (a) => (a.size <= embedCap && a.dataUri ? a.dataUri : put('media', a));
  // Images ![alt](url)
  out = out.replace(/(!\[[^\]]*\]\()([^)]+)(\))/g, (m, pre, url, post) => {
    const a = assets.get(url);
    return a ? pre + embedOrFolder(a) + post : m;
  });
  // <img src="url"> (rich/resized images stored as HTML) and <video>/<audio src>.
  out = out.replace(/(<(?:img|video|audio)\b[^>]*?\bsrc=")([^"]+)(")/gi, (m, pre, url, post) => {
    const a = assets.get(url);
    return a ? pre + embedOrFolder(a) + post : m;
  });
  // Attachment links [text](…/raw) — images already handled above.
  out = out.replace(/(\[[^\]]*\]\()([^)]+\/raw)(\))/g, (m, pre, url, post) => {
    const a = assets.get(url);
    if (!a) return m;
    return pre + put('sources', a) + post;
  });
  return { md: out, files };
}

// Find every stored-file URL referenced by a note's HTML or Markdown.
export function collectAssetUrls(text) {
  const urls = new Set();
  const push = (u) => { if (u && /\/files\/[^/?#]+\/raw/.test(u)) urls.add(u); };
  const s = String(text || '');
  let m;
  const reAttr = /(?:src|href)="([^"]+)"/gi;
  while ((m = reAttr.exec(s))) push(m[1]);
  const reMd = /\]\(([^)]+)\)/g;
  while ((m = reMd.exec(s))) push(m[1]);
  return [...urls];
}

// Pack path→Uint8Array entries into a .zip (Uint8Array).
export function makeZip(entries) {
  return zipSync(entries, { level: 6 });
}
