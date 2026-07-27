// Tiny, dependency-free syntax highlighters for the file viewers.
//
// Safe by construction: only `&`, `<`, `>` are escaped up front (quotes are
// kept so JSON string tokens still match), then we wrap recognized tokens in
// <span class="tok-*"> — no user text is ever emitted as raw markup.

const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const STRING = '"(?:\\\\.|[^"\\\\])*"';

// JSON: keys, strings, numbers, booleans/null.
export function highlightJson(src) {
  const re = new RegExp(
    `(${STRING})(\\s*:)?|\\b(true|false|null)\\b|-?\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?`,
    'g'
  );
  return esc(src).replace(re, (m, str, colon, kw) => {
    if (str !== undefined && colon) return `<span class="tok-key">${str}</span>${colon}`;
    if (str !== undefined) return `<span class="tok-str">${str}</span>`;
    if (kw) return `<span class="tok-kw">${m}</span>`;
    return `<span class="tok-num">${m}</span>`;
  });
}

// YAML: comments, `key:`, quoted strings, and scalar booleans/null.
// Order matters — each pass must not re-scan markup emitted by an earlier pass.
// Strings run first (only that pass looks for quotes, and it's single-pass), so
// the quotes we later emit inside class="…" are never re-matched.
export function highlightYaml(src) {
  return esc(src)
    .split('\n')
    .map((line) => {
      // Whole-line comment.
      if (/^\s*#/.test(line)) return `<span class="tok-comment">${line}</span>`;
      // Quoted strings first (the only pass that consumes quote chars).
      let out = line.replace(
        /"(?:\\.|[^"\\])*"|'[^']*'/g,
        (s) => `<span class="tok-str">${s}</span>`
      );
      // "key:" at the start of the (indented) line.
      out = out.replace(
        /^(\s*-?\s*)([A-Za-z0-9_.-]+)(\s*:)/,
        (_, pre, key, colon) => `${pre}<span class="tok-key">${key}</span>${colon}`
      );
      // Bare booleans / null (won't appear inside the class names we emit).
      out = out.replace(
        /\b(true|false|null|yes|no)\b/gi,
        (kw) => `<span class="tok-kw">${kw}</span>`
      );
      return out;
    })
    .join('\n');
}
