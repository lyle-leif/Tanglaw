import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { ProviderError, type CompleteRequest, type Provider, type TMsg, type Turn } from "../types";

// Optional paid provider. Used only if ANTHROPIC_API_KEY is set; otherwise skipped and never billed.
const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";
// Server-side refusal fallback exists only for some models (not Haiku)
const FALLBACK_MODELS = ["claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5", "claude-fable-5-2", "claude-fable-5-1"];
let client: Anthropic | null = null;

function toMessages(messages: TMsg[]): Anthropic.Beta.BetaMessageParam[] {
  return messages.map((m): Anthropic.Beta.BetaMessageParam => {
    if (m.role === "user") return { role: "user", content: m.text };
    if (m.role === "assistant") {
      if (m.raw) return { role: "assistant", content: m.raw as Anthropic.Beta.BetaContentBlock[] };
      const content: Anthropic.Beta.BetaContentBlockParam[] = [];
      if (m.text) content.push({ type: "text", text: m.text });
      for (const c of m.toolCalls) content.push({ type: "tool_use", id: c.id, name: c.name, input: c.args });
      return { role: "assistant", content };
    }
    return {
      role: "user",
      content: m.results.map((r) => ({ type: "tool_result" as const, tool_use_id: r.id, content: r.content, is_error: r.isError })),
    };
  });
}

export const claude: Provider = {
  id: "claude",
  label: "Claude",
  model: MODEL,
  available: () => !!(process.env.ANTHROPIC_API_KEY || process.env.LLM_API_KEY),
  async complete(req: CompleteRequest): Promise<Turn> {
    if (!client) {
      client = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY || process.env.LLM_API_KEY,
        timeout: 30_000,
        maxRetries: 1,
      });
    }
    let res: Anthropic.Beta.BetaMessage;
    try {
      res = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        ...(FALLBACK_MODELS.includes(MODEL)
          ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
          : {}),
        output_config: { effort: req.effort },
        system: req.system,
        tools: req.tools.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.parameters as Anthropic.Beta.BetaTool.InputSchema,
          ...(t.strict ? { strict: true } : {}),
        })),
        messages: toMessages(req.messages),
      });
    } catch (e) {
      const why = e instanceof Anthropic.APIError ? `HTTP ${e.status ?? "?"}` : (e as Error).message;
      throw new ProviderError(`Claude failed: ${why}`, "claude");
    }
    if (res.stop_reason === "refusal") return { text: "", toolCalls: [], stop: "refusal" };
    const calls = res.content
      .filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use")
      .map((b) => ({ id: b.id, name: b.name, args: (b.input ?? {}) as Record<string, unknown> }));
    const text = res.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return {
      text,
      toolCalls: calls,
      stop: res.stop_reason === "max_tokens" ? "max_tokens" : calls.length ? "tool" : "end",
      raw: res.content,
    };
  },
};
