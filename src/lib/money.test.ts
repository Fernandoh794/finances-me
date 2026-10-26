import { describe, expect, it } from 'vitest';
import { formatBRL, sumCents, toCents } from './money.js';

describe('toCents', () => {
  it.each([
    [0.29, 29],
    [1.1, 110],
    [-45.9, -4590],
    [1234.56, 123456],
    [0, 0],
    [-0, 0],
  ])('%d reais → %d centavos', (amount, cents) => {
    expect(Object.is(toCents(amount), cents)).toBe(true);
  });

  it('rejeita NaN e Infinity', () => {
    expect(() => toCents(Number.NaN)).toThrow(RangeError);
    expect(() => toCents(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('sumCents', () => {
  it('soma sem erro de ponto flutuante', () => {
    expect(sumCents([toCents(0.1), toCents(0.2)])).toBe(30);
  });

  it('rejeita valores não inteiros', () => {
    expect(() => sumCents([10, 0.5])).toThrow(RangeError);
  });

  it('retorna zero para lista vazia', () => {
    expect(sumCents([])).toBe(0);
  });
});

describe('formatBRL', () => {
  it.each([
    [123456, 'R$ 1.234,56'],
    [5, 'R$ 0,05'],
    [0, 'R$ 0,00'],
    [-4590, '-R$ 45,90'],
  ])('%d → %s', (cents, expected) => {
    expect(formatBRL(cents)).toBe(expected);
  });
});
