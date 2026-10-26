import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../agent/llm/types.js';
import { silentLogger } from '../test-support/fixtures.js';
import { FRIENDLY_ERROR, MessageHandler, type ReplyGenerator } from './message-handler.js';

/** Agente eco que registra o histórico recebido em cada chamada. */
function echoAgent(delayMs = 0) {
  const histories: ChatMessage[][] = [];
  const agent: ReplyGenerator = {
    async reply(history, userText) {
      histories.push([...history]);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      if (userText === 'falha') throw new Error('boom');
      const text = `eco: ${userText}`;
      return {
        text,
        messages: [
          { role: 'user', text: userText },
          { role: 'assistant', text },
        ],
      };
    },
  };
  return { agent, histories };
}

describe('MessageHandler', () => {
  it('mantém histórico por remetente', async () => {
    const { agent, histories } = echoAgent();
    const handler = new MessageHandler({ agent, logger: silentLogger });

    await handler.handle('a', 'um');
    await handler.handle('b', 'outro');
    await handler.handle('a', 'dois');

    expect(histories[2]).toEqual([
      { role: 'user', text: 'um' },
      { role: 'assistant', text: 'eco: um' },
    ]);
    expect(histories[1]).toEqual([]);
  });

  it('limita o histórico às últimas N trocas', async () => {
    const { agent, histories } = echoAgent();
    const handler = new MessageHandler({ agent, logger: silentLogger, historyTurns: 2 });

    for (const text of ['1', '2', '3', '4']) await handler.handle('a', text);

    const userTexts = histories[3]?.flatMap((m) => (m.role === 'user' ? [m.text] : []));
    expect(userTexts).toEqual(['2', '3']);
  });

  it('processa mensagens do mesmo remetente em ordem', async () => {
    const { agent } = echoAgent(5);
    const handler = new MessageHandler({ agent, logger: silentLogger });
    const order: string[] = [];

    await Promise.all(
      ['a', 'b', 'c'].map((text) => handler.handle('x', text).then((reply) => order.push(reply))),
    );

    expect(order).toEqual(['eco: a', 'eco: b', 'eco: c']);
  });

  it('responde mensagem amigável em erro e continua funcionando', async () => {
    const { agent } = echoAgent();
    const handler = new MessageHandler({ agent, logger: silentLogger });

    expect(await handler.handle('a', 'falha')).toBe(FRIENDLY_ERROR);
    expect(await handler.handle('a', 'ok')).toBe('eco: ok');
  });

  it('reset esquece a conversa', async () => {
    const { agent, histories } = echoAgent();
    const handler = new MessageHandler({ agent, logger: silentLogger });

    await handler.handle('a', 'um');
    handler.reset('a');
    await handler.handle('a', 'dois');

    expect(histories[1]).toEqual([]);
  });
});
