import { addDaysIso, endOfMonthIso, startOfMonthIso, startOfWeekIso } from '../../../lib/dates.js';
import { normalizeText } from '../../../lib/text.js';

// Roteador por palavras-chave que imita o LLM no modo offline. Cobre só as perguntas
// básicas da spec; o Gemini substitui isso quando LLM_PROVIDER=gemini.

export interface Intent {
  name: string;
  args: Record<string, unknown>;
}

interface Period {
  startDate: string;
  endDate: string;
}

const KNOWN_CATEGORIES = [
  'alimentacao',
  'transporte',
  'saude',
  'lazer',
  'moradia',
  'servicos',
  'educacao',
  'compras',
];

export function resolvePeriod(text: string, today: string): Period {
  const lastDays = /ultimos (\d{1,3}) dias/.exec(text);
  if (lastDays) {
    return { startDate: addDaysIso(today, -(Number(lastDays[1]) - 1)), endDate: today };
  }
  if (text.includes('ontem')) {
    const yesterday = addDaysIso(today, -1);
    return { startDate: yesterday, endDate: yesterday };
  }
  if (text.includes('hoje')) return { startDate: today, endDate: today };
  if (text.includes('semana passada')) {
    const start = addDaysIso(startOfWeekIso(today), -7);
    return { startDate: start, endDate: addDaysIso(start, 6) };
  }
  if (text.includes('semana')) return { startDate: startOfWeekIso(today), endDate: today };
  if (text.includes('mes passado')) {
    const lastMonthDay = addDaysIso(startOfMonthIso(today), -1);
    return { startDate: startOfMonthIso(lastMonthDay), endDate: endOfMonthIso(lastMonthDay) };
  }
  return { startDate: startOfMonthIso(today), endDate: today }; // padrão: mês atual
}

export function detectIntent(rawText: string, today: string): Intent | undefined {
  const text = normalizeText(rawText);

  if (/sincroniz|atualiz/.test(text)) {
    return { name: 'sync_bank_data', args: {} };
  }

  if (/ultim|recent|lancamentos|extrato/.test(text)) {
    const limit = /\b(\d{1,2})\b/.exec(text);
    return {
      name: 'get_recent_transactions',
      args: {
        limit: limit ? Math.min(Number(limit[1]), 50) : 10,
        onlyExpenses: /gast|despes|compr/.test(text),
      },
    };
  }

  if (/gast|despes/.test(text)) {
    const category = KNOWN_CATEGORIES.find((name) => text.includes(name));
    return {
      name: 'get_expenses_summary',
      args: { ...resolvePeriod(text, today), ...(category !== undefined && { category }) },
    };
  }

  if (/saldo|quanto (eu )?tenho|fatura/.test(text)) {
    return { name: 'get_balances', args: {} };
  }

  return undefined;
}
