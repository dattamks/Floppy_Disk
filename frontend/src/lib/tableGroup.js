// Pure row-grouping for tables. Groups a table's rows by a single field into an
// ordered list of buckets. Kept framework-free so it's unit-testable and shared
// by every view. Grouping by a field lives in the view config (config.groupBy).

// Scalar fields only - arrays (multi-select/relation/attachment) and computed
// types (formula/lookup/rollup) don't group cleanly.
export const GROUPABLE = new Set([
  'text', 'long_text', 'number', 'currency', 'percent', 'rating',
  'checkbox', 'single_select', 'date', 'url', 'email',
]);

export function isGroupable(type) {
  return GROUPABLE.has(type);
}

const EMPTY = '__empty__';

function keyOf(field, row) {
  const v = row.data ? row.data[field.id] : undefined;
  if (field.type === 'checkbox') return v ? 'true' : 'false';
  if (v === undefined || v === null || v === '') return EMPTY;
  return String(v);
}

function labelOf(field, key) {
  if (field.type === 'checkbox') return key === 'true' ? 'Checked' : 'Unchecked';
  if (key === EMPTY) return 'Empty';
  if (field.type === 'single_select') {
    const c = (field.options?.choices || []).find((ch) => ch.id === key);
    return c ? c.name : 'Empty';
  }
  if (field.type === 'currency') return `${field.options?.symbol || '$'}${key}`;
  if (field.type === 'percent') return `${key}%`;
  return key;
}

function orderKeys(field, keys) {
  const empties = keys.filter((k) => k === EMPTY);
  const rest = keys.filter((k) => k !== EMPTY);
  if (field.type === 'single_select') {
    const order = (field.options?.choices || []).map((c) => c.id);
    rest.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  } else if (['number', 'currency', 'percent', 'rating'].includes(field.type)) {
    rest.sort((a, b) => Number(a) - Number(b));
  } else if (field.type === 'checkbox') {
    rest.sort((a, b) => (a === 'true' ? 0 : 1) - (b === 'true' ? 0 : 1)); // checked first
  } else {
    rest.sort((a, b) => String(a).localeCompare(String(b)));
  }
  return [...rest, ...empties]; // the Empty bucket always sorts last
}

// Group rows (assumed already filtered + sorted) by a field. Returns an ordered
// array of { key, label, count, rows }, preserving the incoming row order within
// each bucket so the active sort still applies inside a group.
export function groupRows(rows, field) {
  const buckets = new Map();
  for (const row of rows) {
    const k = keyOf(field, row);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(row);
  }
  return orderKeys(field, [...buckets.keys()]).map((k) => ({
    key: k, label: labelOf(field, k), count: buckets.get(k).length, rows: buckets.get(k),
  }));
}
