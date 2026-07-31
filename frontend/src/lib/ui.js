// Shared UI helpers used across the app's components.

export const humanSize = (b) => {
  if (!b || b < 0 || isNaN(b)) return '0 KB';
  if (b >= 1073741824) return (b / 1073741824).toFixed(1) + ' GB';
  if (b >= 1048576) return (b / 1048576).toFixed(1) + ' MB';
  return Math.max(1, Math.round(b / 1024)) + ' KB';
};

// Compact storage label from a GB value: sub-GB -> MB, >=1024 GB -> TB, else GB.
export const fmtStorage = (gb) => {
  if (gb == null || isNaN(gb)) return '0 GB';
  if (gb >= 1024) {
    const tb = gb / 1024;
    return (tb >= 10 || tb % 1 === 0 ? Math.round(tb) : tb.toFixed(1)) + ' TB';
  }
  if (gb < 1 && gb > 0) return Math.max(1, Math.round(gb * 1024)) + ' MB';
  return (gb >= 100 || gb % 1 === 0 ? Math.round(gb) : gb.toFixed(1)) + ' GB';
};

// Seconds -> "M:SS" (or "H:MM:SS"). Returns '' for missing/invalid input.
export const fmtDuration = (secs) => {
  if (secs == null || isNaN(secs) || secs < 0) return '';
  const s = Math.floor(secs % 60);
  const m = Math.floor((secs / 60) % 60);
  const h = Math.floor(secs / 3600);
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
};

export const kindOf = (mime) =>
  mime.startsWith('video')
    ? 'video'
    : mime.startsWith('image')
      ? 'image'
      : mime.startsWith('audio')
        ? 'audio'
        : 'doc';

// Lowercased file extension (no dot), or '' if none.
export const extOf = (name = '') => {
  const m = /\.([^.\/\\]+)$/.exec(name || '');
  return m ? m[1].toLowerCase() : '';
};

// A file's display title without its text-note extension (for the note editor).
export const baseName = (name) => (name || '').replace(/\.(md|markdown|txt)$/i, '');

// Finer-grained "how should we preview this" kind, from the name + coarse kind.
// One of: video | image | audio | pdf | markdown | json | yaml | text | doc.
export const previewKindOf = (name, kind) => {
  const ext = extOf(name);
  if (kind === 'video' || ['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v'].includes(ext)) return 'video';
  if (kind === 'image' || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext))
    return 'image';
  if (kind === 'audio' || ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(ext)) return 'audio';
  if (ext === 'pdf') return 'pdf';
  if (['md', 'markdown'].includes(ext)) return 'markdown';
  if (ext === 'json') return 'json';
  if (['yaml', 'yml'].includes(ext)) return 'yaml';
  if (
    [
      'txt',
      'log',
      'csv',
      'xml',
      'ini',
      'conf',
      'env',
      'js',
      'jsx',
      'ts',
      'tsx',
      'py',
      'sh',
      'css',
      'html',
      'sql',
    ].includes(ext)
  )
    return 'text';
  return 'doc';
};

// Inline hover styling helper: swaps style props on enter, restores on leave.
export const hov = (styles) => ({
  onMouseEnter: (e) => {
    const el = e.currentTarget;
    el.__h = el.__h || {};
    for (const k in styles) {
      el.__h[k] = el.style[k];
      el.style[k] = styles[k];
    }
  },
  onMouseLeave: (e) => {
    const el = e.currentTarget;
    if (el.__h) {
      for (const k in styles) el.style[k] = el.__h[k] || '';
    }
  },
});
