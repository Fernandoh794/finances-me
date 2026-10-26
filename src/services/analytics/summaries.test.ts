import { describe, expect, it } from 'vitest';
import type { Account, Transaction } from '../../domain/types.js';
import { summarizeBalances, summarizeExpenses } from './summaries.js';

function tx(category: string, amountCents: number): Transaction {
  return {
    id: `${category}-${amountCents}`,
    accountId: 'a',
    accountType: 'CHECKING',
    bankName: 'Banco',
    description: category,
    amountCents,
    date: new Date('2026-10-01T12:00:00Z'),
    status: 'POSTED',
    category,
    isExpense: true,
  };
}

function account(type: Account['type'], balanceCents: number): Account {
  return {
    id: `${type}-${balanceCents}`,
    itemId: 'i',
    name: type,
    bankName: 'Banco',
    type,
    balanceCents,
    currencyCode: 'BRL',
    updatedAt: new Date(),
  };
}

describe('summarizeExpenses', () => {
  it('soma em centavos e agrupa por categoria, maior primeiro', () => {
    const summary = summarizeExpenses([
      tx('Transporte', -2315),
      tx('Alimentação', -1890),
      tx('Alimentação', -18743),
    ]);

    expect(summary).toEqual({
      totalCents: 22948,
      count: 3,
      byCategory: [
        { category: 'Alimentação', totalCents: 20633, count: 2 },
        { category: 'Transporte', totalCents: 2315, count: 1 },
      ],
    });
  });

  it('lista vazia', () => {
    expect(summarizeExpenses([])).toEqual({ totalCents: 0, count: 0, byCategory: [] });
  });
});

describe('summarizeBalances', () => {
  it('separa disponível, faturas e investimentos', () => {
    const summary = summarizeBalances([
      account('CHECKING', 100_00),
      account('SAVINGS', 50_00),
      account('CREDIT_CARD', 30_00),
      account('INVESTMENT', 1000_00),
    ]);

    expect(summary.availableCents).toBe(150_00);
    expect(summary.creditCardBillsCents).toBe(30_00);
    expect(summary.investmentsCents).toBe(1000_00);
  });
});
