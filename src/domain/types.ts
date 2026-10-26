export type AccountType = 'CHECKING' | 'CREDIT_CARD' | 'SAVINGS' | 'INVESTMENT';

export interface Account {
  id: string; // Pluggy account ID
  itemId: string; // Pluggy item ID (conexão bancária de origem)
  name: string;
  bankName: string;
  type: AccountType;
  balanceCents: number; // Saldo disponível (conta) ou fatura atual (cartão)
  creditLimitCents?: number;
  currencyCode: string;
  updatedAt: Date;
}

export interface Transaction {
  id: string; // Pluggy transaction ID
  accountId: string;
  accountType: AccountType;
  bankName: string;
  description: string;
  amountCents: number; // negativo = saída, positivo = entrada
  date: Date;
  status: 'PENDING' | 'POSTED';
  category: string;
  paymentType?: string;
  isExpense: boolean;
}
