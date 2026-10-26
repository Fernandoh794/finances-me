import type {
  BalancesOutput,
  ExpensesSummaryOutput,
  RecentTransactionsOutput,
  SyncOutput,
} from '../../tools/finance-tools.js';
import type { ToolResult } from '../types.js';

// Transforma o resultado das tools em texto de WhatsApp, imitando a resposta final do LLM.

function hasError(output: unknown): output is { error: string } {
  return typeof output === 'object' && output !== null && 'error' in output;
}

function renderBalances(output: BalancesOutput): string {
  const lines = output.accounts.map(
    (account) => `• ${account.name} (${account.bank}) — ${account.type}: *${account.balance}*`,
  );
  return [
    '*Seus saldos*',
    ...lines,
    '',
    `Disponível em contas: *${output.totalAvailable}*`,
    `Faturas de cartão: *${output.totalCreditCardBills}*`,
  ].join('\n');
}

function renderExpenses(output: ExpensesSummaryOutput): string {
  const scope = output.category === undefined ? '' : ` com ${output.category}`;
  const header = `*Gastos${scope} de ${output.period.start} a ${output.period.end}*`;
  if (output.transactionCount === 0) return `${header}\nNenhum gasto encontrado no período.`;

  return [
    header,
    `Total: *${output.total}* (${output.transactionCount} transações)`,
    '',
    ...output.byCategory.map((entry) => `• ${entry.category}: *${entry.total}* (${entry.share})`),
  ].join('\n');
}

function renderRecent(output: RecentTransactionsOutput): string {
  if (output.transactions.length === 0) return 'Nenhum lançamento encontrado.';
  return [
    `*Últimos ${output.transactions.length} lançamentos*`,
    ...output.transactions.map((t) => `• ${t.date} — ${t.description} — *${t.amount}* (${t.bank})`),
  ].join('\n');
}

function renderSync(output: SyncOutput): string {
  const errors = output.errors.length === 0 ? '' : `\n⚠️ ${output.errors.length} erro(s).`;
  return `Sincronização concluída: ${output.accounts} contas, ${output.newOrUpdatedTransactions} transações novas/atualizadas.${errors}`;
}

export function renderToolResult(result: ToolResult): string {
  if (hasError(result.output)) return `⚠️ Não consegui consultar: ${result.output.error}`;

  switch (result.name) {
    case 'get_balances':
      return renderBalances(result.output as BalancesOutput);
    case 'get_expenses_summary':
      return renderExpenses(result.output as ExpensesSummaryOutput);
    case 'get_recent_transactions':
      return renderRecent(result.output as RecentTransactionsOutput);
    case 'sync_bank_data':
      return renderSync(result.output as SyncOutput);
    default:
      return JSON.stringify(result.output);
  }
}
