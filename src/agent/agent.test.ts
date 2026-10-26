import { describe, expect, it } from 'vitest';
import { createDemoTools, FIXED_NOW, silentLogger } from '../test-support/fixtures.js';
import { Agent } from './agent.js';
import type { LlmProvider, LlmRequest, LlmResponse } from './llm/types.js';

/** LLM roteirizado: devolve as respostas na ordem e grava as requisições recebidas. */
function scriptedLlm(responses: LlmResponse[]) {
  const requests: LlmRequest[] = [];
  const llm: LlmProvider = {
    generate(request) {
      requests.push(structuredClone(request));
      const next = responses.shift();
      if (!next) throw new Error('roteiro esgotado');
      return Promise.resolve(next);
    },
  };
  return { llm, requests };
}

function createAgent(llm: LlmProvider, maxIterations?: number) {
  return new Agent({
    llm,
    tools: createDemoTools(),
    logger: silentLogger,
    now: () => FIXED_NOW,
    ...(maxIterations !== undefined && { maxIterations }),
  });
}

describe('Agent', () => {
  it('responde direto quando o LLM não chama tools', async () => {
    const { llm, requests } = scriptedLlm([{ text: 'Olá!', toolCalls: [] }]);
    const reply = await createAgent(llm).reply([], 'oi');

    expect(reply.text).toBe('Olá!');
    expect(reply.messages).toEqual([
      { role: 'user', text: 'oi' },
      { role: 'assistant', text: 'Olá!' },
    ]);
    expect(requests[0]?.system).toContain('2026-10-26');
    expect(requests[0]?.tools.map((t) => t.name)).toContain('get_balances');
  });

  it('executa a tool e devolve o resultado ao LLM', async () => {
    const { llm, requests } = scriptedLlm([
      { toolCalls: [{ id: 'c1', name: 'get_balances', args: {} }] },
      { text: 'Seu saldo é *R$ 4.370,40*.', toolCalls: [] },
    ]);
    const reply = await createAgent(llm).reply([], 'qual meu saldo?');

    expect(reply.text).toBe('Seu saldo é *R$ 4.370,40*.');
    const toolMessage = requests[1]?.messages.at(-1);
    expect(toolMessage).toMatchObject({
      role: 'tool',
      results: [{ callId: 'c1', name: 'get_balances', output: { totalAvailable: 'R$ 4.370,40' } }],
    });
  });

  it('transforma erros de tool em resultado para o LLM', async () => {
    const { llm, requests } = scriptedLlm([
      {
        toolCalls: [
          { id: 'c1', name: 'get_expenses_summary', args: { startDate: 'x', endDate: 'y' } },
          { id: 'c2', name: 'nao_existe', args: {} },
        ],
      },
      { text: 'Desculpe.', toolCalls: [] },
    ]);
    await createAgent(llm).reply([], 'quanto gastei?');

    const toolMessage = requests[1]?.messages.at(-1);
    if (toolMessage?.role !== 'tool') throw new Error('esperava mensagem de tool');
    const [invalidArgs, unknownTool] = toolMessage.results;
    expect(JSON.stringify(invalidArgs?.output)).toContain('Argumentos inválidos');
    expect(unknownTool).toMatchObject({
      callId: 'c2',
      output: { error: 'Tool desconhecida: nao_existe' },
    });
  });

  it('envia o histórico anterior ao LLM', async () => {
    const { llm, requests } = scriptedLlm([{ text: 'ok', toolCalls: [] }]);
    const history = [
      { role: 'user' as const, text: 'antes' },
      { role: 'assistant' as const, text: 'resposta' },
    ];
    await createAgent(llm).reply(history, 'agora');

    expect(requests[0]?.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
  });

  it('para após o limite de iterações', async () => {
    const loop: LlmResponse = { toolCalls: [{ id: 'c', name: 'get_balances', args: {} }] };
    const { llm } = scriptedLlm([loop, loop, loop]);
    const reply = await createAgent(llm, 2).reply([], 'saldo');

    expect(reply.text).toMatch(/Não consegui concluir/);
  });

  it('usa mensagem padrão quando o LLM devolve texto vazio', async () => {
    const { llm } = scriptedLlm([{ text: '  ', toolCalls: [] }]);
    const reply = await createAgent(llm).reply([], 'oi');
    expect(reply.text).toMatch(/reformular/);
  });
});
