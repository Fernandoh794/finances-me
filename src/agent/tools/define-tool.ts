import { z } from 'zod';
import type { ToolSpec } from '../llm/types.js';

export interface AgentTool {
  spec: ToolSpec;
  /** Valida os argumentos vindos do LLM e executa a tool. Lança erro se inválidos. */
  run(rawArgs: unknown): Promise<unknown>;
}

export function defineTool<Schema extends z.ZodObject>(definition: {
  name: string;
  description: string;
  schema: Schema;
  execute(args: z.output<Schema>): Promise<unknown>;
}): AgentTool {
  // io: 'input' deixa campos com default como opcionais no schema enviado ao LLM.
  const parameters = z.toJSONSchema(definition.schema, { io: 'input' }) as Record<string, unknown>;
  delete parameters.$schema;

  return {
    spec: { name: definition.name, description: definition.description, parameters },
    // async: erros de validação viram promise rejeitada, como os erros de execução.
    run: async (rawArgs) => definition.execute(definition.schema.parse(rawArgs ?? {})),
  };
}
