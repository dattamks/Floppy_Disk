// Classify a non-image/video/audio file by its extension so the grid can show a
// distinct icon + colour per type (PDF vs spreadsheet vs code vs archive, ...).
// Returns { key, color, ext } - `key` drives the glyph, `ext` is the short label.

const GROUPS = [
  { key: 'pdf', color: '#E5484D', ext: ['pdf'] },
  { key: 'sheet', color: '#30A46C', ext: ['xls', 'xlsx', 'csv', 'tsv', 'ods', 'numbers'] },
  { key: 'slides', color: '#F76808', ext: ['ppt', 'pptx', 'key', 'odp'] },
  { key: 'word', color: '#0B7BF0', ext: ['doc', 'docx', 'rtf', 'odt', 'pages'] },
  { key: 'text', color: '#64748B', ext: ['txt', 'md', 'markdown', 'text', 'log', 'rst'] },
  {
    key: 'code',
    color: '#5145E5',
    ext: [
      'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'py', 'rb', 'go', 'rs', 'java', 'kt',
      'c', 'cc', 'cpp', 'h', 'hpp', 'cs', 'php', 'swift', 'scala', 'sh', 'bash', 'zsh',
      'sql', 'json', 'yaml', 'yml', 'toml', 'xml', 'html', 'htm', 'css', 'scss', 'sass',
      'less', 'vue', 'svelte', 'ipynb', 'dockerfile', 'ini', 'env',
    ],
  },
  { key: 'archive', color: '#F59E0B', ext: ['zip', 'tar', 'gz', 'tgz', 'bz2', 'rar', '7z', 'xz'] },
];

export function fileType(name) {
  const dot = String(name || '').lastIndexOf('.');
  const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
  for (const g of GROUPS) {
    if (g.ext.includes(ext)) return { key: g.key, color: g.color, ext: ext.toUpperCase() };
  }
  // Unknown extension: a neutral document with the (short) extension as the label.
  return { key: 'file', color: '#64748B', ext: ext ? ext.slice(0, 4).toUpperCase() : 'FILE' };
}
