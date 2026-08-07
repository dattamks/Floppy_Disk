// Pure row-filtering for tables. Filters live in a view's config
// (config.filters = [{ field, op, value }]) and are combined with AND. Kept
// framework-free so it's unit-testable and shared by every view.

export const OP_LABELS = {
  contains: 'contains', is: 'is', is_not: 'is not',
  gt: '>', lt: '<', gte: '≥', lte: '≤',
  empty: 'is empty', not_empty: 'is not empty',
  checked: 'is checked', unchecked: 'is not checked',
  has: 'has', has_not: "doesn't have",
  before: 'before', after: 'after',
};

// Operators offered for a field type. Computed types (formula/lookup/rollup)
// are intentionally excluded from filtering - they're derived at read time.
export function opsForType(type) {
  if (['number', 'currency', 'percent', 'rating'].includes(type)) return ['is', 'is_not', 'gt', 'lt', 'gte', 'lte', 'empty', 'not_empty'];
  if (type === 'checkbox') return ['checked', 'unchecked'];
  if (type === 'single_select') return ['is', 'is_not', 'empty', 'not_empty'];
  if (type === 'multi_select') return ['has', 'has_not', 'empty', 'not_empty'];
  if (type === 'date') return ['is', 'before', 'after', 'empty', 'not_empty'];
  if (['relation', 'attachment'].includes(type)) return ['not_empty', 'empty'];
  return ['contains', 'is', 'not_empty', 'empty']; // text, long_text, url, email
}

// Does an operator need a value input?
export function opNeedsValue(op) {
  return !['empty', 'not_empty', 'checked', 'unchecked'].includes(op);
}

function isEmpty(v) {
  return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
}

function matchOne(row, filter, field) {
  if (!field) return true; // stale filter referencing a removed field - ignore
  const cell = row.data ? row.data[field.id] : undefined;
  const op = filter.op;
  const val = filter.value;

  switch (op) {
    case 'empty': return isEmpty(cell);
    case 'not_empty': return !isEmpty(cell);
    case 'checked': return cell === true;
    case 'unchecked': return !cell;
    default: break;
  }
  if (isEmpty(cell)) return false; // any value-comparing op fails on an empty cell

  switch (op) {
    case 'contains': return String(cell).toLowerCase().includes(String(val ?? '').toLowerCase());
    case 'is':
      if (['number', 'currency', 'percent', 'rating'].includes(field.type)) return Number(cell) === Number(val);
      return String(cell) === String(val ?? '');
    case 'is_not':
      if (['number', 'currency', 'percent', 'rating'].includes(field.type)) return Number(cell) !== Number(val);
      return String(cell) !== String(val ?? '');
    case 'gt': return Number(cell) > Number(val);
    case 'lt': return Number(cell) < Number(val);
    case 'gte': return Number(cell) >= Number(val);
    case 'lte': return Number(cell) <= Number(val);
    case 'before': return String(cell) < String(val ?? '');   // ISO dates compare lexically
    case 'after': return String(cell) > String(val ?? '');
    case 'has': return Array.isArray(cell) && cell.includes(val);
    case 'has_not': return !(Array.isArray(cell) && cell.includes(val));
    default: return true;
  }
}

// Keep only rows passing every (complete) filter. Filters missing a needed
// value are treated as not-yet-applied and skipped, so a half-built condition
// doesn't blank the table.
export function filterRows(rows, filters, fieldsById) {
  const active = (filters || []).filter((f) => f && f.field && f.op && (!opNeedsValue(f.op) || !(f.value === undefined || f.value === '')));
  if (active.length === 0) return rows;
  return rows.filter((row) => active.every((f) => matchOne(row, f, fieldsById[f.field])));
}
