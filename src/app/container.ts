import type { Logger } from 'pino';
import { Agent } from '../agent/agent.js';
import { FakeLlmProvider } from '../agent/llm/fake/fake-llm.js';
import type { LlmProvider } from '../agent/llm/types.js';
import { createFinanceTools } from '../agent/tools/finance-tools.js';
import { ConsoleChannel } from '../channels/console/console-channel.js';
import type { Channel } from '../channels/types.js';
import type { Env } from '../config/env.js';
import { buildDemoData } from '../repositories/memory/demo-data.js';
import {
  InMemoryAccountRepository,
  InMemoryTransactionRepository,
} from '../repositories/memory/memory-repositories.js';
import type { AccountRepository, TransactionRepository } from '../repositories/types.js';
import { DemoBankSync } from '../services/sync/demo-bank-sync.js';
import type { BankSync } from '../services/sync/types.js';
import { MessageHandler } from './message-handler.js';

// Composição da aplicação: único lugar que escolhe implementações conforme o env.
// Os modos "reais" entram aqui conforme as fases do PLAN.md forem concluídas.

interface DataLayer {
  accounts: AccountRepository;
  transactions: TransactionRepository;
  bankSync: BankSync;
}

function notImplemented(what: string, phase: string): never {
  throw new Error(`${what} ainda não implementado (${phase} do PLAN.md).`);
}

function buildDataLayer(env: Env): DataLayer {
  if (env.DATA_SOURCE === 'live') return notImplemented('DATA_SOURCE=live', 'Fase 2');

  const demo = buildDemoData();
  const accounts = new InMemoryAccountRepository(demo.accounts);
  return {
    accounts,
    transactions: new InMemoryTransactionRepository(demo.transactions),
    bankSync: new DemoBankSync(accounts),
  };
}

function buildLlm(env: Env): LlmProvider {
  if (env.LLM_PROVIDER === 'gemini') return notImplemented('LLM_PROVIDER=gemini', 'Fase 3');
  return new FakeLlmProvider();
}

function describeModes(env: Env): string {
  const llm = env.LLM_PROVIDER === 'fake' ? 'offline (regras)' : env.LLM_PROVIDER;
  const data = env.DATA_SOURCE === 'demo' ? 'dados fictícios' : 'bancos reais';
  return `💰 Pierre — IA: ${llm} · dados: ${data}`;
}

function buildChannel(env: Env): Channel {
  if (env.CHANNEL === 'whatsapp') return notImplemented('CHANNEL=whatsapp', 'Fase 4');
  return new ConsoleChannel({ banner: describeModes(env) });
}

export function buildApp(env: Env, logger: Logger): { handler: MessageHandler; channel: Channel } {
  const data = buildDataLayer(env);
  const agent = new Agent({ llm: buildLlm(env), tools: createFinanceTools(data), logger });
  return { handler: new MessageHandler({ agent, logger }), channel: buildChannel(env) };
}
