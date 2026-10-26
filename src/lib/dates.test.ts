import { describe, expect, it } from 'vitest';
import { dayRange, formatDateBR, formatDateTimeBR, todayIso } from './dates.js';

describe('dayRange', () => {
  it('cobre o dia inteiro em America/Sao_Paulo (UTC-3)', () => {
    const { start, end } = dayRange('2026-10-01', '2026-10-31');

    expect(start.toISOString()).toBe('2026-10-01T03:00:00.000Z');
    expect(end.toISOString()).toBe('2026-11-01T02:59:59.999Z');
  });

  it('aceita intervalo de um único dia', () => {
    const { start, end } = dayRange('2026-10-26', '2026-10-26');
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000 - 1);
  });

  it('rejeita formato inválido', () => {
    expect(() => dayRange('26/10/2026', '2026-10-26')).toThrow(/YYYY-MM-DD/);
  });

  it('rejeita data inexistente', () => {
    expect(() => dayRange('2026-02-30', '2026-03-01')).toThrow(/inexistente/);
  });

  it('rejeita intervalo invertido', () => {
    expect(() => dayRange('2026-10-27', '2026-10-26')).toThrow(/posterior/);
  });
});

describe('todayIso', () => {
  it('usa o fuso de São Paulo, não UTC', () => {
    // 01:30 UTC do dia 27 ainda é dia 26 em São Paulo.
    expect(todayIso(new Date('2026-10-27T01:30:00Z'))).toBe('2026-10-26');
  });
});

describe('formatação', () => {
  const date = new Date('2026-10-26T19:30:00Z');

  it('formatDateBR', () => {
    expect(formatDateBR(date)).toBe('26/10/2026');
  });

  it('formatDateTimeBR', () => {
    expect(formatDateTimeBR(date)).toBe('segunda-feira, 26/10/2026 16:30');
  });
});
