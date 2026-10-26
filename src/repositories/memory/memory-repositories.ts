import type { Account, Transaction } from '../../domain/types.js';
import type { DateRange } from '../../lib/dates.js';
import { normalizeText } from '../../lib/text.js';
import type {
  AccountRepository,
  RecentTransactionsQuery,
  TransactionRepository,
} from '../types.js';

export class InMemoryAccountRepository implements AccountRepository {
  private readonly accounts = new Map<string, Account>();

  constructor(initial: readonly Account[] = []) {
    for (const account of initial) this.accounts.set(account.id, account);
  }

  list(): Promise<Account[]> {
    const sorted = [...this.accounts.values()].sort(
      (a, b) => a.bankName.localeCompare(b.bankName) || a.name.localeCompare(b.name),
    );
    return Promise.resolve(sorted);
  }

  upsertMany(accounts: readonly Account[]): Promise<void> {
    for (const account of accounts) this.accounts.set(account.id, account);
    return Promise.resolve();
  }
}

export class InMemoryTransactionRepository implements TransactionRepository {
  private readonly transactions = new Map<string, Transaction>();

  constructor(initial: readonly Transaction[] = []) {
    for (const transaction of initial) this.transactions.set(transaction.id, transaction);
  }

  upsertMany(transactions: readonly Transaction[]): Promise<void> {
    for (const transaction of transactions) this.transactions.set(transaction.id, transaction);
    return Promise.resolve();
  }

  listRecent({ limit, onlyExpenses }: RecentTransactionsQuery): Promise<Transaction[]> {
    const result = this.sortedByDateDesc()
      .filter((transaction) => !onlyExpenses || transaction.isExpense)
      .slice(0, limit);
    return Promise.resolve(result);
  }

  listExpenses(range: DateRange, category?: string): Promise<Transaction[]> {
    const categoryKey = category === undefined ? undefined : normalizeText(category);
    const result = this.sortedByDateDesc().filter(
      (transaction) =>
        transaction.isExpense &&
        transaction.date >= range.start &&
        transaction.date <= range.end &&
        (categoryKey === undefined || normalizeText(transaction.category) === categoryKey),
    );
    return Promise.resolve(result);
  }

  private sortedByDateDesc(): Transaction[] {
    return [...this.transactions.values()].sort((a, b) => b.date.getTime() - a.date.getTime());
  }
}
