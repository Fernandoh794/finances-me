export interface SyncSummary {
  accounts: number;
  newOrUpdatedTransactions: number;
  errors: string[];
}

export interface BankSync {
  syncAll(): Promise<SyncSummary>;
}
