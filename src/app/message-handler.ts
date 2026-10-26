import type { Logger } from 'pino';
import type { AgentReply } from '../agent/agent.js';
import type { ChatMessage } from '../agent/llm/types.js';
import type { ConversationHandler } from '../channels/types.js';

export const FRIENDLY_ERROR =
  'Tive um problema para responder agora. Tente novamente em instantes.';

export interface ReplyGenerator {
  reply(history: readonly ChatMessage[], userText: string): Promise<AgentReply>;
}

export interface MessageHandlerDeps {
  agent: ReplyGenerator;
  logger: Logger;
  /** Quantas trocas (pergunta + resposta) anteriores mantém como contexto. */
  historyTurns?: number;
}

/** Ponte entre qualquer canal (console, WhatsApp) e o agente. */
export class MessageHandler implements ConversationHandler {
  private readonly histories = new Map<string, ChatMessage[][]>();
  private readonly queues = new Map<string, Promise<unknown>>();
  private readonly historyTurns: number;

  constructor(private readonly deps: MessageHandlerDeps) {
    this.historyTurns = deps.historyTurns ?? 10;
  }

  /** Mensagens do mesmo remetente são processadas em ordem, uma por vez. */
  handle(senderId: string, text: string): Promise<string> {
    const previous = this.queues.get(senderId) ?? Promise.resolve();
    const next = previous.then(() => this.process(senderId, text));
    this.queues.set(
      senderId,
      next.catch(() => undefined),
    );
    return next;
  }

  reset(senderId: string): void {
    this.histories.delete(senderId);
  }

  private async process(senderId: string, text: string): Promise<string> {
    const turns = this.histories.get(senderId) ?? [];
    try {
      const reply = await this.deps.agent.reply(turns.flat(), text);
      this.histories.set(senderId, [...turns, reply.messages].slice(-this.historyTurns));
      return reply.text;
    } catch (error) {
      this.deps.logger.error({ err: error }, 'Falha ao gerar resposta');
      return FRIENDLY_ERROR;
    }
  }
}
