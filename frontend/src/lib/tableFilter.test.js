import { describe, it, expect } from 'vitest';
import { filterRows, opsForType, opNeedsValue } from './tableFilter';

const fields = {
  name: { id: 'name', type: 'text' },
  qty: { id: 'qty', type: 'number' },
  done: { id: 'done', type: 'checkbox' },
  status: { id: 'status', type: 'single_select' },
  tags: { id: 'tags', type: 'multi_select' },
  due: { id: 'due', type: 'date' },
};
const rows = [
  { id: '1', data: { name: 'Alpha', qty: 10, done: true, status: 's1', tags: ['a', 'b'], due: '2026-01-10' } },
  { id: '2', data: { name: 'Beta', qty: 3, status: 's2', tags: ['b'], due: '2026-03-01' } },
  { id: '3', data: { name: 'Gamma', qty: 20, done: true, tags: [] } },
];
const ids = (rs) => rs.map((r) => r.id);

describe('filterRows', () => {
  it('returns all rows when there are no active filters', () => {
    expect(ids(filterRows(rows, [], fields))).toEqual(['1', '2', '3']);
    // A half-built filter (needs a value, has none) is skipped, not applied.
    expect(ids(filterRows(rows, [{ field: 'name', op: 'contains', value: '' }], fields))).toEqual(['1', '2', '3']);
  });
  it('text contains + is', () => {
    expect(ids(filterRows(rows, [{ field: 'name', op: 'contains', value: 'a' }], fields))).toEqual(['1', '2', '3']);
    expect(ids(filterRows(rows, [{ field: 'name', op: 'is', value: 'Beta' }], fields))).toEqual(['2']);
  });
  it('numeric comparisons', () => {
    expect(ids(filterRows(rows, [{ field: 'qty', op: 'gte', value: '10' }], fields))).toEqual(['1', '3']);
    expect(ids(filterRows(rows, [{ field: 'qty', op: 'lt', value: '10' }], fields))).toEqual(['2']);
  });
  it('checkbox + empty/not_empty', () => {
    expect(ids(filterRows(rows, [{ field: 'done', op: 'checked' }], fields))).toEqual(['1', '3']);
    expect(ids(filterRows(rows, [{ field: 'done', op: 'unchecked' }], fields))).toEqual(['2']);
    expect(ids(filterRows(rows, [{ field: 'status', op: 'empty' }], fields))).toEqual(['3']);
    expect(ids(filterRows(rows, [{ field: 'status', op: 'not_empty' }], fields))).toEqual(['1', '2']);
  });
  it('single/multi-select and date', () => {
    expect(ids(filterRows(rows, [{ field: 'status', op: 'is', value: 's2' }], fields))).toEqual(['2']);
    expect(ids(filterRows(rows, [{ field: 'tags', op: 'has', value: 'a' }], fields))).toEqual(['1']);
    expect(ids(filterRows(rows, [{ field: 'due', op: 'after', value: '2026-02-01' }], fields))).toEqual(['2']);
  });
  it('combines conditions with AND', () => {
    expect(ids(filterRows(rows, [
      { field: 'done', op: 'checked' },
      { field: 'qty', op: 'gte', value: '15' },
    ], fields))).toEqual(['3']);
  });
  it('ignores a filter on a removed field', () => {
    expect(ids(filterRows(rows, [{ field: 'ghost', op: 'is', value: 'x' }], fields))).toEqual(['1', '2', '3']);
  });
});

describe('opsForType / opNeedsValue', () => {
  it('offers type-appropriate operators', () => {
    expect(opsForType('number')).toContain('gte');
    expect(opsForType('checkbox')).toEqual(['checked', 'unchecked']);
    expect(opsForType('relation')).toEqual(['not_empty', 'empty']);
  });
  it('knows which operators need a value', () => {
    expect(opNeedsValue('contains')).toBe(true);
    expect(opNeedsValue('empty')).toBe(false);
    expect(opNeedsValue('checked')).toBe(false);
  });
});
