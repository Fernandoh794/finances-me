import type { Account, AccountType, Transaction } from '../../domain/types.js';
import { addDaysIso, dayRange, todayIso } from '../../lib/dates.js';
import { toCents } from '../../lib/money.js';

// Dados fictícios e determinísticos para rodar o agente sem Pluggy/Firestore.

const DEMO_DAYS = 60;

const accounts = {
  nubankChecking: { id: 'demo-nubank-checking', name: 'Conta Corrente', bankName: 'Nubank' },
  nubankCard: { id: 'demo-nubank-card', name: 'Cartão Nubank', bankName: 'Nubank' },
  interChecking: { id: 'demo-inter-checking', name: 'Conta Digital', bankName: 'Banco Inter' },
} as const;

type DemoAccountKey = keyof typeof accounts;

const accountTypes: Record<DemoAccountKey, AccountType> = {
  nubankChecking: 'CHECKING',
  nubankCard: 'CREDIT_CARD',
  interChecking: 'CHECKING',
};

interface RecurringTemplate {
  slug: string;
  description: string;
  category: string;
  amount: number; // reais; negativo = saída
  account: DemoAccountKey;
  paymentType: string;
  isExpense: boolean;
  /** Ocorre quando (diasAtrás + offset) % every === 0. */
  every?: number;
  offset?: number;
  /** Ou: ocorre neste dia do mês. */
  dayOfMonth?: number;
}

const templates: RecurringTemplate[] = [
  // prettier-ignore
  { slug: 'mercado', description: 'Supermercado São José', category: 'Alimentação', amount: -187.43, account: 'nubankCard', paymentType: 'CARTÃO', isExpense: true, every: 7, offset: 2 },
  // prettier-ignore
  { slug: 'padaria', description: 'Padaria Pão Quente', category: 'Alimentação', amount: -18.9, account: 'nubankChecking', paymentType: 'PIX', isExpense: true, every: 3, offset: 0 },
  // prettier-ignore
  { slug: 'ifood', description: 'iFood', category: 'Alimentação', amount: -54.7, account: 'nubankCard', paymentType: 'CARTÃO', isExpense: true, every: 5, offset: 1 },
  // prettier-ignore
  { slug: 'uber', description: 'Uber', category: 'Transporte', amount: -23.15, account: 'nubankCard', paymentType: 'CARTÃO', isExpense: true, every: 4, offset: 3 },
  // prettier-ignore
  { slug: 'combustivel', description: 'Posto Shell', category: 'Transporte', amount: -210, account: 'interChecking', paymentType: 'CARTÃO', isExpense: true, every: 14, offset: 5 },
  // prettier-ignore
  { slug: 'farmacia', description: 'Drogasil', category: 'Saúde', amount: -64.3, account: 'nubankCard', paymentType: 'CARTÃO', isExpense: true, every: 12, offset: 4 },
  // prettier-ignore
  { slug: 'cinema', description: 'Cinemark', category: 'Lazer', amount: -72, account: 'nubankCard', paymentType: 'CARTÃO', isExpense: true, every: 15, offset: 6 },
  // prettier-ignore
  { slug: 'aluguel', description: 'Aluguel', category: 'Moradia', amount: -1800, account: 'nubankChecking', paymentType: 'BOLETO', isExpense: true, dayOfMonth: 5 },
  // prettier-ignore
  { slug: 'energia', description: 'Energisa', category: 'Moradia', amount: -243.57, account: 'nubankChecking', paymentType: 'BOLETO', isExpense: true, dayOfMonth: 12 },
  // prettier-ignore
  { slug: 'internet', description: 'Claro Internet', category: 'Serviços', amount: -119.9, account: 'nubankCard', paymentType: 'CARTÃO', isExpense: true, dayOfMonth: 8 },
  // prettier-ignore
  { slug: 'streaming', description: 'Netflix', category: 'Serviços', amount: -44.9, account: 'nubankCard', paymentType: 'CARTÃO', isExpense: true, dayOfMonth: 15 },
  // prettier-ignore
  { slug: 'salario', description: 'Salário', category: 'Renda', amount: 6500, account: 'nubankChecking', paymentType: 'TED', isExpense: false, dayOfMonth: 5 },
  // Não são gastos: evitam dupla contagem (ver Regras de Negócio da spec).
  // prettier-ignore
  { slug: 'fatura', description: 'Pagamento de fatura Nubank', category: 'Pagamento de fatura', amount: -1650.32, account: 'nubankChecking', paymentType: 'BOLETO', isExpense: false, dayOfMonth: 10 },
  // prettier-ignore
  { slug: 'transf-saida', description: 'Transferência para Banco Inter', category: 'Transferência entre contas', amount: -500, account: 'nubankChecking', paymentType: 'PIX', isExpense: false, dayOfMonth: 20 },
  // prettier-ignore
  { slug: 'transf-entrada', description: 'Transferência de Nubank', category: 'Transferência entre contas', amount: 500, account: 'interChecking', paymentType: 'PIX', isExpense: false, dayOfMonth: 20 },
];

function occursOn(template: RecurringTemplate, daysAgo: number, iso: string): boolean {
  if (template.dayOfMonth !== undefined) {
    return Number(iso.slice(8, 10)) === template.dayOfMonth;
  }
  if (template.every === undefined) return false;
  return (daysAgo + (template.offset ?? 0)) % template.every === 0;
}

export function buildDemoData(now: Date = new Date()): {
  accounts: Account[];
  transactions: Transaction[];
} {
  const today = todayIso(now);

  const demoAccounts: Account[] = [
    { key: 'nubankChecking', balance: 3250.4 },
    { key: 'nubankCard', balance: 1874.12, limit: 8000 },
    { key: 'interChecking', balance: 1120 },
  ].map(({ key, balance, limit }) => {
    const base = accounts[key as DemoAccountKey];
    return {
      ...base,
      itemId: 'demo-item',
      type: accountTypes[key as DemoAccountKey],
      balanceCents: toCents(balance),
      ...(limit !== undefined && { creditLimitCents: toCents(limit) }),
      currencyCode: 'BRL',
      updatedAt: now,
    };
  });

  const transactions: Transaction[] = [];
  for (let daysAgo = 0; daysAgo < DEMO_DAYS; daysAgo++) {
    const iso = addDaysIso(today, -daysAgo);
    const noon = new Date(dayRange(iso, iso).start.getTime() + 12 * 60 * 60 * 1000);

    for (const template of templates) {
      if (!occursOn(template, daysAgo, iso)) continue;
      const account = accounts[template.account];
      transactions.push({
        id: `demo-${iso}-${template.slug}`,
        accountId: account.id,
        accountType: accountTypes[template.account],
        bankName: account.bankName,
        description: template.description,
        amountCents: toCents(template.amount),
        date: noon,
        status: daysAgo === 0 ? 'PENDING' : 'POSTED',
        category: template.category,
        paymentType: template.paymentType,
        isExpense: template.isExpense,
      });
    }
  }

  return { accounts: demoAccounts, transactions };
}
