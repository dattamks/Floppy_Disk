// Computed table columns, evaluated on the client for display (never stored):
//   formula - an expression over this row's fields, e.g. {Price} * {Qty}
//   lookup  - pull a field from rows linked via a relation column
//   rollup  - aggregate a field across linked rows (sum/avg/min/max/count)
//
// The formula evaluator is a small, safe recursive-descent parser - no eval() -
// supporting numbers, strings, + - * / %, parentheses, and a few functions.

const FUNCS = {
  SUM: (a) => a.reduce((s, x) => s + num(x), 0),
  AVG: (a) => (a.length ? a.reduce((s, x) => s + num(x), 0) / a.length : 0),
  MIN: (a) => Math.min(...a.map(num)),
  MAX: (a) => Math.max(...a.map(num)),
  ROUND: (a) => { const f = 10 ** (a[1] !== undefined ? num(a[1]) : 0); return Math.round(num(a[0]) * f) / f; },
  ABS: (a) => Math.abs(num(a[0])),
  LEN: (a) => String(a[0] ?? '').length,
  IF: (a) => (truthy(a[0]) ? a[1] : a[2]),
  CONCAT: (a) => a.map((x) => (x == null ? '' : String(x))).join(''),
};
const num = (x) => (typeof x === 'number' ? x : (x === '' || x == null ? 0 : (Number(x) || 0)));
const truthy = (x) => (typeof x === 'number' ? x !== 0 : !!x && x !== 'false' && x !== '0');

function tokenize(s) {
  const toks = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === ' ' || ch === '\t' || ch === '\n') { i++; continue; }
    if (ch === '{') { const j = s.indexOf('}', i); if (j < 0) throw new Error('bad field ref'); toks.push({ t: 'field', v: s.slice(i + 1, j).trim() }); i = j + 1; continue; }
    if (ch === '"' || ch === "'") { const j = s.indexOf(ch, i + 1); if (j < 0) throw new Error('bad string'); toks.push({ t: 'str', v: s.slice(i + 1, j) }); i = j + 1; continue; }
    if ('+-*/%(),'.includes(ch)) { toks.push({ t: ch }); i++; continue; }
    if (/[0-9.]/.test(ch)) { let j = i; while (j < s.length && /[0-9.]/.test(s[j])) j++; toks.push({ t: 'num', v: parseFloat(s.slice(i, j)) }); i = j; continue; }
    if (/[A-Za-z_]/.test(ch)) { let j = i; while (j < s.length && /[A-Za-z0-9_]/.test(s[j])) j++; toks.push({ t: 'ident', v: s.slice(i, j) }); i = j; continue; }
    throw new Error(`bad char ${ch}`);
  }
  return toks;
}

export function evalFormula(expr, resolve) {
  if (!expr || !expr.trim()) return '';
  let toks;
  try { toks = tokenize(expr); } catch { return '#ERR'; }
  let p = 0;
  const peek = () => toks[p];
  const eat = (t) => { const tok = toks[p]; if (!tok || (t && tok.t !== t)) throw new Error('parse'); p++; return tok; };
  const add = (a, b) => (typeof a === 'number' && typeof b === 'number' ? a + b : String(a) + String(b));

  function parseExpr() {
    let v = parseTerm();
    while (peek() && (peek().t === '+' || peek().t === '-')) { const op = eat().t; const r = parseTerm(); v = op === '+' ? add(v, r) : num(v) - num(r); }
    return v;
  }
  function parseTerm() {
    let v = parseFactor();
    while (peek() && (peek().t === '*' || peek().t === '/' || peek().t === '%')) {
      const op = eat().t; const r = num(parseFactor());
      v = op === '*' ? num(v) * r : op === '/' ? (r === 0 ? 0 : num(v) / r) : (r === 0 ? 0 : num(v) % r);
    }
    return v;
  }
  function parseFactor() {
    const tok = peek();
    if (!tok) throw new Error('eof');
    if (tok.t === '-') { eat(); return -num(parseFactor()); }
    if (tok.t === 'num') { eat(); return tok.v; }
    if (tok.t === 'str') { eat(); return tok.v; }
    if (tok.t === 'field') { eat(); return resolve(tok.v); }
    if (tok.t === '(') { eat('('); const v = parseExpr(); eat(')'); return v; }
    if (tok.t === 'ident') {
      eat(); const name = tok.v.toUpperCase();
      const args = [];
      if (peek() && peek().t === '(') { eat('('); if (peek() && peek().t !== ')') { args.push(parseExpr()); while (peek() && peek().t === ',') { eat(','); args.push(parseExpr()); } } eat(')'); }
      const fn = FUNCS[name];
      return fn ? fn(args) : '#FN';
    }
    throw new Error('unexpected');
  }
  try { const v = parseExpr(); if (p !== toks.length) return '#ERR'; return v; } catch { return '#ERR'; }
}

// Render a target field's value to a short display string (for lookups).
function targetDisplay(field, v) {
  if (v == null || v === '') return '';
  if (!field) return String(v);
  if (field.type === 'single_select') return (field.options?.choices || []).find((c) => c.id === v)?.name || '';
  if (field.type === 'multi_select') return (v || []).map((id) => (field.options?.choices || []).find((c) => c.id === id)?.name || '').filter(Boolean).join(', ');
  if (field.type === 'currency') return `${field.options?.symbol || '$'}${v}`;
  if (field.type === 'percent') return `${v}%`;
  return String(v);
}

export function computeCell(field, row, ctx) {
  const data = row.data || {};
  if (field.type === 'formula') {
    return evalFormula(field.options?.expr || '', (name) => {
      const f = ctx.fieldByName[name];
      if (!f) return '';
      const raw = data[f.id];
      if (['number', 'currency', 'percent', 'rating'].includes(f.type)) return num(raw);
      if (f.type === 'checkbox') return raw ? 1 : 0;
      return raw == null ? '' : String(raw);
    });
  }
  if (field.type === 'lookup' || field.type === 'rollup') {
    const relId = field.options?.relation;
    const tgtId = field.options?.field;
    const linked = ctx.linkedRows(relId, row);      // array of target row data objects
    const tfields = ctx.relFieldsFor(relId);
    const tfield = (tfields || []).find((f) => f.id === tgtId);
    if (field.type === 'lookup') {
      return linked.map((d) => targetDisplay(tfield, d[tgtId])).filter((x) => x !== '').join(', ');
    }
    const agg = field.options?.agg || 'sum';
    if (agg === 'count') return String(linked.length);
    const nums = linked.map((d) => Number(d[tgtId])).filter((n) => !Number.isNaN(n));
    if (!nums.length) return '';
    const sum = nums.reduce((s, x) => s + x, 0);
    const out = agg === 'sum' ? sum : agg === 'avg' ? sum / nums.length : agg === 'min' ? Math.min(...nums) : agg === 'max' ? Math.max(...nums) : sum;
    return String(Math.round(out * 1000) / 1000);
  }
  return '';
}

export const COMPUTED_TYPES = new Set(['formula', 'lookup', 'rollup']);
