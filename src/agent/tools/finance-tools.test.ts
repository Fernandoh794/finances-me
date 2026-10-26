import { describe, expect, it } from 'vitest';
import { createDemoTools } from '../../test-support/fixtures.js';
import type {
  BalancesOutput,
  ExpensesSummaryOutput,
  RecentTransactionsOutput,
} from './finance-tools.js';

const tools = new Map(createDemoTools().map((tool) => [tool.spec.name, tool]));

function tool(name: string) {
  const found = tools.get(name);
  if (!found) throw new Error(`tool ${name} não registrada`);
  return found;
}

describe('specs das tools', () => {
  it('expõe as quatro tools da spec', () => {
    expect([...tools.keys()]).toEqual([
      'get_balances',
      'get_expenses_summary',
      'get_recent_transactions',
      'sync_bank_data',
    ]);
  });

  it('gera JSON Schema sem $schema e com defaults opcionais', () => {
    const params = tool('get_recent_transactions').spec.parameters;
    expect(params).not.toHaveProperty('$schema');
    expect(params.required ?? []).toEqual([]);
    expect(tool('get_expenses_summary').spec.parameters.required).toEqual(['startDate', 'endDate']);
  });
});

describe('get_balances', () => {
  it('retorna valores formatados e totais', async () => {
    const output = (await tool('get_balances').run({})) as BalancesOutput;
    expect(output.accounts).toHaveLength(3);
    expect(output.totalAvailable).toBe('R$ 4.370,40');
    expect(output.totalCreditCardBills).toBe('R$ 1.874,12');
  });
});

describe('get_expenses_summary', () => {
  it('agrega o período sem contar fatura nem transferências', async () => {
    const output = (await tool('get_expenses_summary').run({
      startDate: '2026-10-01',
      endDate: '2026-10-31',
    })) as ExpensesSummaryOutput;

    const categories = output.byCategory.map((c) => c.category);
    expect(categories).toContain('Moradia');
    expect(categories).not.toContain('Pagamento de fatura');
    expect(categories).not.toContain('Transferência entre contas');
    expect(output.period).toEqual({ start: '01/10/2026', end: '31/10/2026' });
  });

  it('rejeita datas inválidas', async () => {
    await expect(
      tool('get_expenses_summary').run({ startDate: 'ontem', endDate: '2026-10-26' }),
    ).rejects.toThrow();
  });
});

describe('get_recent_transactions', () => {
  it('aplica defaults e limite', async () => {
    const all = (await tool('get_recent_transactions').run({})) as RecentTransactionsOutput;
    expect(all.transactions).toHaveLength(10);

    const expenses = (await tool('get_recent_transactions').run({
      limit: 5,
      onlyExpenses: true,
    })) as RecentTransactionsOutput;
    expect(expenses.transactions).toHaveLength(5);
    expect(expenses.transactions.every((t) => t.amount.startsWith('-R$'))).toBe(true);
  });

  it('rejeita limite acima do máximo', async () => {
    await expect(tool('get_recent_transactions').run({ limit: 500 })).rejects.toThrow();
  });
});
