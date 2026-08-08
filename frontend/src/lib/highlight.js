// Tiny, dependency-free syntax highlighters for the file viewers.
//
// Safe by construction: only `&`, `<`, `>` are escaped up front (quotes are
// kept so JSON string tokens still match), then we wrap recognized tokens in
// <span class="tok-*"> - no user text is ever emitted as raw markup.

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

// Generic source-code highlighter for the common languages we preview (JS/TS,
// Python, shell, SQL, CSS, Go, Rust, Java, …). Deliberately lightweight and
// dependency-free: one left-to-right pass over a master alternation, so a token
// (comment / string) is matched as a whole and its interior is never re-scanned
// - the same safety property as highlightJson/Yaml. `lang` is the file extension
// and only decides which line-comment markers apply, so we don't mis-colour a
// CSS `#fff` as a comment.
const CODE_KEYWORDS = [
  // JS/TS
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do', 'switch',
  'case', 'break', 'continue', 'new', 'class', 'extends', 'super', 'import', 'from', 'export',
  'default', 'async', 'await', 'yield', 'try', 'catch', 'finally', 'throw', 'typeof',
  'instanceof', 'in', 'of', 'this', 'void', 'delete', 'interface', 'type', 'enum', 'implements',
  'public', 'private', 'protected', 'static', 'readonly', 'as', 'namespace',
  // Python
  'def', 'elif', 'lambda', 'pass', 'with', 'not', 'and', 'or', 'is', 'None', 'True', 'False',
  'global', 'nonlocal', 'assert', 'del', 'raise', 'except', 'finally',
  // shell / sql / misc
  'echo', 'fi', 'then', 'done', 'esac', 'local', 'select', 'insert', 'update', 'delete', 'where',
  'join', 'group', 'order', 'by', 'into', 'values', 'set', 'create', 'table', 'struct', 'func',
  'package', 'fn', 'impl', 'match', 'use', 'mut', 'pub', 'null', 'true', 'false',
];
const HASH_COMMENT = new Set(['py', 'sh', 'bash', 'zsh', 'rb', 'r', 'pl', 'toml', 'ini', 'conf', 'env', 'dockerfile', 'makefile', 'yml', 'yaml']);
const DASH_COMMENT = new Set(['sql']);

export function highlightCode(src, lang) {
  const ext = (lang || '').toLowerCase();
  const markers = ['//'];
  if (HASH_COMMENT.has(ext)) markers.push('#');
  if (DASH_COMMENT.has(ext)) markers.push('--');
  const lineC = markers.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const kw = '\\b(?:' + CODE_KEYWORDS.join('|') + ')\\b';
  const re = new RegExp(
    '(\\/\\*[\\s\\S]*?\\*\\/)' +                                          // 1 block comment
    `|((?:${lineC}).*)` +                                                 // 2 line comment (to EOL)
    '|(`(?:\\\\.|[^`\\\\])*`|"(?:\\\\.|[^"\\\\])*"|\'(?:\\\\.|[^\'\\\\])*\')' + // 3 string
    '|(' + kw + ')' +                                                     // 4 keyword
    '|(\\b\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?\\b)',                        // 5 number
    'g'
  );
  return esc(src).replace(re, (m, block, line, str, kwm, num) => {
    if (block) return `<span class="tok-comment">${m}</span>`;
    if (line) return `<span class="tok-comment">${m}</span>`;
    if (str) return `<span class="tok-str">${m}</span>`;
    if (kwm) return `<span class="tok-kw">${m}</span>`;
    return `<span class="tok-num">${m}</span>`;
  });
}

// YAML: comments, `key:`, quoted strings, and scalar booleans/null.
// Order matters - each pass must not re-scan markup emitted by an earlier pass.
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
