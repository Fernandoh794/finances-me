import type { Account, Transaction } from '../../domain/types.js';
import { sumCents } from '../../lib/money.js';

export interface CategoryTotal {
  category: string;
  totalCents: number; // positivo = quanto foi gasto
  count: number;
}

export interface ExpensesSummary {
  totalCents: number; // positivo = quanto foi gasto
  count: number;
  byCategory: CategoryTotal[]; // maior gasto primeiro
}

/** Agrega gastos (amountCents negativos) em valores positivos por categoria. */
export function summarizeExpenses(transactions: readonly Transaction[]): ExpensesSummary {
  const byCategory = new Map<string, CategoryTotal>();
  for (const transaction of transactions) {
    const entry = byCategory.get(transaction.category) ?? {
      category: transaction.category,
      totalCents: 0,
      count: 0,
    };
    entry.totalCents = sumCents([entry.totalCents, -transaction.amountCents]);
    entry.count += 1;
    byCategory.set(transaction.category, entry);
  }

  const categories = [...byCategory.values()].sort(
    (a, b) => b.totalCents - a.totalCents || a.category.localeCompare(b.category),
  );
  return {
    totalCents: sumCents(categories.map((c) => c.totalCents)),
    count: transactions.length,
    byCategory: categories,
  };
}

export interface BalancesSummary {
  accounts: Account[];
  availableCents: number; // contas correntes + poupança
  creditCardBillsCents: number; // faturas atuais dos cartões
  investmentsCents: number;
}

export function summarizeBalances(accounts: readonly Account[]): BalancesSummary {
  const totalOf = (types: Account['type'][]) =>
    sumCents(accounts.filter((a) => types.includes(a.type)).map((a) => a.balanceCents));

  return {
    accounts: [...accounts],
    availableCents: totalOf(['CHECKING', 'SAVINGS']),
    creditCardBillsCents: totalOf(['CREDIT_CARD']),
    investmentsCents: totalOf(['INVESTMENT']),
  };
}
