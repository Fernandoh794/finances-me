import type { Account, Transaction } from '../domain/types.js';
import type { DateRange } from '../lib/dates.js';

export interface AccountRepository {
  list(): Promise<Account[]>;
  upsertMany(accounts: readonly Account[]): Promise<void>;
}

export interface RecentTransactionsQuery {
  limit: number;
  onlyExpenses: boolean;
}

export interface TransactionRepository {
  upsertMany(transactions: readonly Transaction[]): Promise<void>;
  /** Mais recentes primeiro. */
  listRecent(query: RecentTransactionsQuery): Promise<Transaction[]>;
  /** Apenas `isExpense = true` dentro do intervalo; categoria comparada sem acento/caixa. */
  listExpenses(range: DateRange, category?: string): Promise<Transaction[]>;
}
