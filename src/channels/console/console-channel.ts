import { createInterface, type Interface } from 'node:readline';
import type { Channel, ConversationHandler } from '../types.js';

export const CONSOLE_SENDER_ID = 'console';

const PROMPT = 'você › ';

export interface ConsoleChannelOptions {
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
  banner?: string;
}

/** Canal de desenvolvimento: conversa com o agente pelo terminal. */
export class ConsoleChannel implements Channel {
  private readline: Interface | undefined;

  constructor(private readonly options: ConsoleChannelOptions = {}) {}

  async start(handler: ConversationHandler): Promise<void> {
    const output = this.options.output ?? process.stdout;
    const readline = createInterface({
      input: this.options.input ?? process.stdin,
      output,
      prompt: PROMPT,
    });
    this.readline = readline;

    const write = (text: string) => output.write(`${text}\n`);
    if (this.options.banner !== undefined) write(this.options.banner);
    write('Comandos: /limpar (esquece a conversa), /sair\n');
    readline.prompt();

    for await (const line of readline) {
      const text = line.trim();
      if (text === '/sair') break;
      if (text === '/limpar') {
        handler.reset(CONSOLE_SENDER_ID);
        write('(conversa reiniciada)\n');
      } else if (text !== '') {
        const reply = await handler.handle(CONSOLE_SENDER_ID, text);
        write(`\npierre › ${reply}\n`);
      }
      readline.prompt();
    }

    readline.close();
  }

  stop(): Promise<void> {
    this.readline?.close();
    return Promise.resolve();
  }
}
