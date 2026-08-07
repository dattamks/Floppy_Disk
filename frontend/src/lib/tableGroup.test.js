import { describe, it, expect } from 'vitest';
import { groupRows, isGroupable } from './tableGroup';

describe('groupRows', () => {
  it('groups single-select in choice order, Empty last', () => {
    const field = { id: 's', type: 'single_select', options: { choices: [{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Beta' }] } };
    const rows = [
      { id: '1', data: { s: 'b' } }, { id: '2', data: { s: 'a' } },
      { id: '3', data: {} }, { id: '4', data: { s: 'a' } },
    ];
    const gs = groupRows(rows, field);
    expect(gs.map((g) => [g.label, g.count])).toEqual([['Alpha', 2], ['Beta', 1], ['Empty', 1]]);
    expect(gs[0].rows.map((r) => r.id)).toEqual(['2', '4']);
  });
  it('groups checkbox as Checked then Unchecked', () => {
    const field = { id: 'd', type: 'checkbox' };
    const rows = [{ id: '1', data: { d: false } }, { id: '2', data: { d: true } }, { id: '3', data: {} }];
    expect(groupRows(rows, field).map((g) => [g.label, g.count])).toEqual([['Checked', 1], ['Unchecked', 2]]);
  });
  it('groups numbers ascending', () => {
    const field = { id: 'n', type: 'number' };
    const rows = [{ id: '1', data: { n: 20 } }, { id: '2', data: { n: 3 } }, { id: '3', data: { n: 20 } }];
    expect(groupRows(rows, field).map((g) => [g.label, g.count])).toEqual([['3', 1], ['20', 2]]);
  });
  it('knows which types are groupable', () => {
    expect(isGroupable('single_select')).toBe(true);
    expect(isGroupable('multi_select')).toBe(false);
    expect(isGroupable('formula')).toBe(false);
  });
});
