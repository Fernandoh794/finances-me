import { pino } from 'pino';
import { createFinanceTools } from '../agent/tools/finance-tools.js';
import { buildDemoData } from '../repositories/memory/demo-data.js';
import {
  InMemoryAccountRepository,
  InMemoryTransactionRepository,
} from '../repositories/memory/memory-repositories.js';
import { DemoBankSync } from '../services/sync/demo-bank-sync.js';

export const FIXED_NOW = new Date('2026-10-26T15:00:00Z'); // segunda-feira, 12:00 em SP

export const silentLogger = pino({ level: 'silent' });

export function createDemoTools(now: Date = FIXED_NOW) {
  const demo = buildDemoData(now);
  const accounts = new InMemoryAccountRepository(demo.accounts);
  const transactions = new InMemoryTransactionRepository(demo.transactions);
  return createFinanceTools({ accounts, transactions, bankSync: new DemoBankSync(accounts) });
}
