import { todayIso } from '../../../lib/dates.js';
import type { LlmProvider, LlmRequest, LlmResponse } from '../types.js';
import { detectIntent } from './intents.js';
import { renderToolResult } from './render.js';

export const FAKE_LLM_HELP = `🤖 *Modo offline* (sem IA). Entendo perguntas como:
• Qual meu saldo?
• Quanto gastei essa semana? / no mês passado? / com alimentação?
• Quais foram meus últimos 5 gastos?
• Sincronizar`;

/** Provedor determinístico para desenvolver sem chave do Gemini. */
export class FakeLlmProvider implements LlmProvider {
  private callCounter = 0;

  constructor(private readonly now: () => Date = () => new Date()) {}

  generate({ messages }: LlmRequest): Promise<LlmResponse> {
    const last = messages.at(-1);

    if (last?.role === 'tool') {
      const text = last.results.map(renderToolResult).join('\n\n');
      return Promise.resolve({ text, toolCalls: [] });
    }

    if (last?.role === 'user') {
      const intent = detectIntent(last.text, todayIso(this.now()));
      if (intent) {
        this.callCounter += 1;
        return Promise.resolve({
          toolCalls: [{ id: `fake-${this.callCounter}`, name: intent.name, args: intent.args }],
        });
      }
    }

    return Promise.resolve({ text: FAKE_LLM_HELP, toolCalls: [] });
  }
}
