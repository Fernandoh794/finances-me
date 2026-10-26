/** O que um canal precisa do restante da aplicação. */
export interface ConversationHandler {
  handle(senderId: string, text: string): Promise<string>;
  reset(senderId: string): void;
}

/** Uma ponta de entrada/saída de mensagens: console hoje, WhatsApp depois. */
export interface Channel {
  /** Resolve quando o canal é encerrado. */
  start(handler: ConversationHandler): Promise<void>;
  stop(): Promise<void>;
}
