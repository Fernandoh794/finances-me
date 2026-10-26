// Contrato neutro de provedor de LLM: o agente não conhece Gemini, nem o provedor fake.

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  callId: string;
  name: string;
  output: unknown;
}

export type ChatMessage =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text?: string; toolCalls?: ToolCall[] }
  | { role: 'tool'; results: ToolResult[] };

export interface ToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}

export interface LlmRequest {
  system: string;
  messages: readonly ChatMessage[];
  tools: readonly ToolSpec[];
}

export interface LlmResponse {
  text?: string;
  toolCalls: ToolCall[];
}

export interface LlmProvider {
  generate(request: LlmRequest): Promise<LlmResponse>;
}
