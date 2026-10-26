import { describe, expect, it } from 'vitest';
import { createDemoTools, FIXED_NOW, silentLogger } from '../../../test-support/fixtures.js';
import { Agent } from '../../agent.js';
import { FAKE_LLM_HELP, FakeLlmProvider } from './fake-llm.js';
import { detectIntent, resolvePeriod } from './intents.js';

const today = '2026-10-26'; // segunda-feira

describe('resolvePeriod', () => {
  it.each([
    ['hoje', '2026-10-26', '2026-10-26'],
    ['ontem', '2026-10-25', '2026-10-25'],
    ['essa semana', '2026-10-26', '2026-10-26'],
    ['semana passada', '2026-10-19', '2026-10-25'],
    ['esse mes', '2026-10-01', '2026-10-26'],
    ['mes passado', '2026-09-01', '2026-09-30'],
    ['ultimos 7 dias', '2026-10-20', '2026-10-26'],
  ])('%s → %s a %s', (text, startDate, endDate) => {
    expect(resolvePeriod(text, today)).toEqual({ startDate, endDate });
  });
});

describe('detectIntent', () => {
  it.each([
    ['Qual meu saldo atual?', 'get_balances', {}],
    ['Quanto gastei essa semana?', 'get_expenses_summary', { startDate: today, endDate: today }],
    [
      'Quanto gastei com Alimentação no mês passado?',
      'get_expenses_summary',
      { startDate: '2026-09-01', endDate: '2026-09-30', category: 'alimentacao' },
    ],
    [
      'Quais foram meus últimos 5 gastos?',
      'get_recent_transactions',
      { limit: 5, onlyExpenses: true },
    ],
    [
      'me mostra os lançamentos recentes',
      'get_recent_transactions',
      { limit: 10, onlyExpenses: false },
    ],
    ['sincroniza meus bancos', 'sync_bank_data', {}],
  ])('"%s" → %s', (text, name, args) => {
    expect(detectIntent(text, today)).toEqual({ name, args });
  });

  it('retorna undefined para perguntas desconhecidas', () => {
    expect(detectIntent('qual a capital da França?', today)).toBeUndefined();
  });
});

describe('FakeLlmProvider com o Agent', () => {
  const agent = new Agent({
    llm: new FakeLlmProvider(() => FIXED_NOW),
    tools: createDemoTools(),
    logger: silentLogger,
    now: () => FIXED_NOW,
  });

  it('responde saldo ponta a ponta', async () => {
    const reply = await agent.reply([], 'Qual meu saldo atual?');
    expect(reply.text).toContain('*Seus saldos*');
    expect(reply.text).toContain('Disponível em contas: *R$ 4.370,40*');
  });

  it('responde gastos do mês com agrupamento', async () => {
    const reply = await agent.reply([], 'Quanto gastei esse mês?');
    expect(reply.text).toMatch(/\*Gastos de 01\/10\/2026 a 26\/10\/2026\*/);
    expect(reply.text).toMatch(/Total: \*R\$ [\d.,]+\*/);
    expect(reply.text).not.toContain('Pagamento de fatura');
  });

  it('lista últimos gastos', async () => {
    const reply = await agent.reply([], 'Quais foram meus últimos 5 gastos?');
    expect(reply.text.split('\n').filter((line) => line.startsWith('•'))).toHaveLength(5);
  });

  it('mostra ajuda quando não entende', async () => {
    const reply = await agent.reply([], 'bom dia');
    expect(reply.text).toBe(FAKE_LLM_HELP);
  });
});
