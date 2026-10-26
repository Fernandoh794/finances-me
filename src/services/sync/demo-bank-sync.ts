import type { AccountRepository } from '../../repositories/types.js';
import type { BankSync, SyncSummary } from './types.js';

/** Sync de demonstração: não acessa a Pluggy, apenas reporta o que já está em memória. */
export class DemoBankSync implements BankSync {
  constructor(private readonly accounts: AccountRepository) {}

  async syncAll(): Promise<SyncSummary> {
    const accounts = await this.accounts.list();
    return { accounts: accounts.length, newOrUpdatedTransactions: 0, errors: [] };
  }
}
