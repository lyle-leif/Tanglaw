// Provider-neutral shapes. Each AI provider (Gemini, Groq, Claude) translates these
// to and from its own API, so the rest of Tulong never depends on one vendor.

export type ProviderId = "gemini" | "groq" | "claude";

export interface ToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema (object)
  strict?: boolean; // used by providers that support strict schemas
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  badArgs?: boolean; // the provider sent arguments that weren't valid JSON
}

export interface ToolResult {
  id: string;
  name: string;
  content: string;
  isError?: boolean;
}

export type TMsg =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; toolCalls: ToolCall[]; raw?: unknown } // raw: provider-native turn, replayed as-is to the same provider
  | { role: "tool"; results: ToolResult[] };

export interface Turn {
  text: string;
  toolCalls: ToolCall[];
  stop: "end" | "tool" | "max_tokens" | "refusal";
  raw?: unknown;
}

export interface CompleteRequest {
  system: string;
  messages: TMsg[];
  tools: ToolSpec[];
  effort: "low" | "medium";
}

export interface Provider {
  id: ProviderId;
  label: string; // shown on the review screen, e.g. "Gemini"
  model: string;
  available(): boolean; // true when its API key is set
  complete(req: CompleteRequest): Promise<Turn>;
}

/** A provider failed (rate limit, timeout, outage, bad output). The next provider is tried. */
export class ProviderError extends Error {
  constructor(message: string, readonly provider: ProviderId) {
    super(message);
  }
}

/** A problem the user should see (case not open, nothing configured...). No fallback. */
export class TulongError extends Error {}
