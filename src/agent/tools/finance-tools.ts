import { z } from 'zod';
import type { AccountType } from '../../domain/types.js';
import { dayRange, formatDateBR } from '../../lib/dates.js';
import { formatBRL } from '../../lib/money.js';
import type { AccountRepository, TransactionRepository } from '../../repositories/types.js';
import { summarizeBalances, summarizeExpenses } from '../../services/analytics/summaries.js';
import type { BankSync, SyncSummary } from '../../services/sync/types.js';
import { defineTool, type AgentTool } from './define-tool.js';

// As tools devolvem valores já formatados em R$: o LLM só repete, nunca calcula.

export interface FinanceToolsDeps {
  accounts: AccountRepository;
  transactions: TransactionRepository;
  bankSync: BankSync;
}

const accountTypeLabels: Record<AccountType, string> = {
  CHECKING: 'Conta corrente',
  CREDIT_CARD: 'Cartão de crédito (fatura atual)',
  SAVINGS: 'Poupança',
  INVESTMENT: 'Investimento',
};

export interface BalancesOutput {
  accounts: { name: string; bank: string; type: string; balance: string }[];
  totalAvailable: string;
  totalCreditCardBills: string;
  totalInvestments: string;
}

export interface ExpensesSummaryOutput {
  period: { start: string; end: string };
  category?: string;
  total: string;
  transactionCount: number;
  byCategory: { category: string; total: string; share: string; transactionCount: number }[];
}

export interface RecentTransactionsOutput {
  transactions: {
    date: string;
    description: string;
    amount: string;
    bank: string;
    category: string;
  }[];
}

export type SyncOutput = SyncSummary;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe('Data no formato YYYY-MM-DD, no fuso America/Sao_Paulo');

export function createFinanceTools(deps: FinanceToolsDeps): AgentTool[] {
  return [
    defineTool({
      name: 'get_balances',
      description:
        'Retorna o saldo de cada conta, a fatura atual de cada cartão e os totais consolidados.',
      schema: z.object({}),
      async execute(): Promise<BalancesOutput> {
        const summary = summarizeBalances(await deps.accounts.list());
        return {
          accounts: summary.accounts.map((account) => ({
            name: account.name,
            bank: account.bankName,
            type: accountTypeLabels[account.type],
            balance: formatBRL(account.balanceCents),
          })),
          totalAvailable: formatBRL(summary.availableCents),
          totalCreditCardBills: formatBRL(summary.creditCardBillsCents),
          totalInvestments: formatBRL(summary.investmentsCents),
        };
      },
    }),

    defineTool({
      name: 'get_expenses_summary',
      description:
        'Soma os gastos de um período (datas inclusivas), opcionalmente de uma categoria, e agrupa por categoria. Não conta pagamento de fatura nem transferências entre contas próprias.',
      schema: z.object({
        startDate: isoDate,
        endDate: isoDate,
        category: z.string().min(1).optional().describe('Ex.: Alimentação, Transporte'),
      }),
      async execute({ startDate, endDate, category }): Promise<ExpensesSummaryOutput> {
        const range = dayRange(startDate, endDate);
        const summary = summarizeExpenses(await deps.transactions.listExpenses(range, category));
        const share = (cents: number) =>
          summary.totalCents === 0 ? '0%' : `${Math.round((cents / summary.totalCents) * 100)}%`;

        return {
          period: { start: formatDateBR(range.start), end: formatDateBR(range.end) },
          // Nome canônico (com acento) quando há gastos; senão, o que foi pedido.
          ...(category !== undefined && { category: summary.byCategory[0]?.category ?? category }),
          total: formatBRL(summary.totalCents),
          transactionCount: summary.count,
          byCategory: summary.byCategory.map((entry) => ({
            category: entry.category,
            total: formatBRL(entry.totalCents),
            share: share(entry.totalCents),
            transactionCount: entry.count,
          })),
        };
      },
    }),

    defineTool({
      name: 'get_recent_transactions',
      description: 'Lista os lançamentos mais recentes (data, descrição, valor, banco, categoria).',
      schema: z.object({
        limit: z.number().int().min(1).max(50).default(10),
        onlyExpenses: z
          .boolean()
          .default(false)
          .describe('true para listar só gastos (ex.: "meus últimos gastos")'),
      }),
      async execute({ limit, onlyExpenses }): Promise<RecentTransactionsOutput> {
        const transactions = await deps.transactions.listRecent({ limit, onlyExpenses });
        return {
          transactions: transactions.map((transaction) => ({
            date: formatDateBR(transaction.date),
            description: transaction.description,
            amount: formatBRL(transaction.amountCents),
            bank: transaction.bankName,
            category: transaction.category,
          })),
        };
      },
    }),

    defineTool({
      name: 'sync_bank_data',
      description: 'Sincroniza agora contas e transações com os bancos.',
      schema: z.object({}),
      execute: (): Promise<SyncOutput> => deps.bankSync.syncAll(),
    }),
  ];
}
