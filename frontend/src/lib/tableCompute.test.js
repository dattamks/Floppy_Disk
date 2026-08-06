import { describe, it, expect } from 'vitest';
import { evalFormula, computeCell } from './tableCompute';

describe('evalFormula', () => {
  const resolve = (name) => ({ Price: 10, Qty: 3, Name: 'Wid' }[name]);
  it('does arithmetic with precedence and parentheses', () => {
    expect(evalFormula('{Price} * {Qty}', resolve)).toBe(30);
    expect(evalFormula('{Price} + {Qty} * 2', resolve)).toBe(16);
    expect(evalFormula('({Price} + {Qty}) * 2', resolve)).toBe(26);
  });
  it('supports functions', () => {
    expect(evalFormula('ROUND({Price} / {Qty}, 2)', resolve)).toBe(3.33);
    expect(evalFormula('SUM(1, 2, {Qty})', resolve)).toBe(6);
    expect(evalFormula('IF({Qty}, 100, 0)', resolve)).toBe(100);
    expect(evalFormula('CONCAT({Name}, "-", {Qty})', resolve)).toBe('Wid-3');
  });
  it('divides by zero to 0 and reports bad syntax without throwing', () => {
    expect(evalFormula('{Price} / 0', resolve)).toBe(0);
    expect(evalFormula('{Price} +', resolve)).toBe('#ERR');
  });
});

describe('computeCell lookup + rollup', () => {
  const ctx = {
    fieldById: {}, fieldByName: {},
    linkedRows: () => [{ amt: 5 }, { amt: 15 }, { amt: 10 }],
    relFieldsFor: () => [{ id: 'amt', name: 'Amount', type: 'number' }],
  };
  const row = { data: {} };
  it('rolls up numeric values', () => {
    expect(computeCell({ type: 'rollup', options: { relation: 'r', field: 'amt', agg: 'sum' } }, row, ctx)).toBe('30');
    expect(computeCell({ type: 'rollup', options: { relation: 'r', field: 'amt', agg: 'max' } }, row, ctx)).toBe('15');
    expect(computeCell({ type: 'rollup', options: { relation: 'r', field: 'amt', agg: 'count' } }, row, ctx)).toBe('3');
  });
  it('looks up and joins values', () => {
    expect(computeCell({ type: 'lookup', options: { relation: 'r', field: 'amt' } }, row, ctx)).toBe('5, 15, 10');
  });
});
