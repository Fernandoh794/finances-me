import type { Logger } from 'pino';
import { z } from 'zod';
import type { ChatMessage, LlmProvider, ToolCall, ToolResult } from './llm/types.js';
import { buildSystemPrompt } from './prompt.js';
import type { AgentTool } from './tools/define-tool.js';

const EMPTY_REPLY = 'Não consegui formular uma resposta. Pode reformular a pergunta?';
const TOO_MANY_STEPS = 'Não consegui concluir essa análise agora. Tente uma pergunta mais direta.';

export interface AgentDeps {
  llm: LlmProvider;
  tools: readonly AgentTool[];
  logger: Logger;
  now?: () => Date;
  maxIterations?: number;
}

export interface AgentReply {
  text: string;
  /** Mensagens geradas neste turno (pergunta, chamadas de tools e resposta), para o histórico. */
  messages: ChatMessage[];
}

export class Agent {
  private readonly toolsByName: Map<string, AgentTool>;
  private readonly now: () => Date;
  private readonly maxIterations: number;

  constructor(private readonly deps: AgentDeps) {
    this.toolsByName = new Map(deps.tools.map((tool) => [tool.spec.name, tool]));
    this.now = deps.now ?? (() => new Date());
    this.maxIterations = deps.maxIterations ?? 5;
  }

  async reply(history: readonly ChatMessage[], userText: string): Promise<AgentReply> {
    const messages: ChatMessage[] = [{ role: 'user', text: userText }];
    const system = buildSystemPrompt(this.now());
    const tools = this.deps.tools.map((tool) => tool.spec);

    for (let iteration = 0; iteration < this.maxIterations; iteration++) {
      const response = await this.deps.llm.generate({
        system,
        messages: [...history, ...messages],
        tools,
      });

      if (response.toolCalls.length === 0) {
        const text = response.text?.trim();
        const finalText = text === undefined || text === '' ? EMPTY_REPLY : text;
        messages.push({ role: 'assistant', text: finalText });
        return { text: finalText, messages };
      }

      messages.push({
        role: 'assistant',
        toolCalls: response.toolCalls,
        ...(response.text !== undefined && { text: response.text }),
      });
      const results = await Promise.all(response.toolCalls.map((call) => this.runTool(call)));
      messages.push({ role: 'tool', results });
    }

    this.deps.logger.warn({ maxIterations: this.maxIterations }, 'Agente excedeu iterações');
    messages.push({ role: 'assistant', text: TOO_MANY_STEPS });
    return { text: TOO_MANY_STEPS, messages };
  }

  private async runTool(call: ToolCall): Promise<ToolResult> {
    const tool = this.toolsByName.get(call.name);
    if (!tool) {
      return {
        callId: call.id,
        name: call.name,
        output: { error: `Tool desconhecida: ${call.name}` },
      };
    }

    const startedAt = Date.now();
    try {
      const output = await tool.run(call.args);
      this.deps.logger.debug({ tool: call.name, ms: Date.now() - startedAt }, 'Tool executada');
      return { callId: call.id, name: call.name, output };
    } catch (error) {
      // O erro volta para o LLM, que pode corrigir os argumentos ou explicar ao usuário.
      const message =
        error instanceof z.ZodError
          ? `Argumentos inválidos: ${z.prettifyError(error)}`
          : error instanceof Error
            ? error.message
            : String(error);
      this.deps.logger.warn({ tool: call.name, err: error }, 'Falha ao executar tool');
      return { callId: call.id, name: call.name, output: { error: message } };
    }
  }
}
