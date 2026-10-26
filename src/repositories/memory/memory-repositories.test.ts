import { describe, expect, it } from 'vitest';
import { dayRange } from '../../lib/dates.js';
import { buildDemoData } from './demo-data.js';
import { InMemoryAccountRepository, InMemoryTransactionRepository } from './memory-repositories.js';

const now = new Date('2026-10-26T15:00:00Z');
const demo = buildDemoData(now);

describe('buildDemoData', () => {
  it('é determinístico e tem IDs únicos', () => {
    const again = buildDemoData(now);
    expect(again.transactions).toEqual(demo.transactions);
    expect(new Set(demo.transactions.map((t) => t.id)).size).toBe(demo.transactions.length);
  });

  it('inclui movimentações que não são gasto', () => {
    const nonExpenses = demo.transactions.filter((t) => t.amountCents < 0 && !t.isExpense);
    expect(nonExpenses.map((t) => t.category)).toContain('Pagamento de fatura');
    expect(nonExpenses.map((t) => t.category)).toContain('Transferência entre contas');
  });
});

describe('InMemoryTransactionRepository', () => {
  const repo = new InMemoryTransactionRepository(demo.transactions);

  it('upsert é idempotente', async () => {
    const local = new InMemoryTransactionRepository();
    await local.upsertMany(demo.transactions);
    await local.upsertMany(demo.transactions);
    const all = await local.listRecent({ limit: 10_000, onlyExpenses: false });
    expect(all).toHaveLength(demo.transactions.length);
  });

  it('listRecent ordena da mais recente e filtra gastos', async () => {
    const recent = await repo.listRecent({ limit: 5, onlyExpenses: true });
    expect(recent).toHaveLength(5);
    expect(recent.every((t) => t.isExpense)).toBe(true);
    const times = recent.map((t) => t.date.getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it('listExpenses respeita intervalo e categoria sem acento', async () => {
    const range = dayRange('2026-10-01', '2026-10-31');
    const food = await repo.listExpenses(range, 'alimentacao');

    expect(food.length).toBeGreaterThan(0);
    expect(food.every((t) => t.category === 'Alimentação' && t.isExpense)).toBe(true);
    expect(food.every((t) => t.date >= range.start && t.date <= range.end)).toBe(true);
  });
});

describe('InMemoryAccountRepository', () => {
  it('lista ordenado por banco e nome', async () => {
    const repo = new InMemoryAccountRepository(demo.accounts);
    const names = (await repo.list()).map((a) => `${a.bankName}/${a.name}`);
    expect(names).toEqual([
      'Banco Inter/Conta Digital',
      'Nubank/Cartão Nubank',
      'Nubank/Conta Corrente',
    ]);
  });
});
