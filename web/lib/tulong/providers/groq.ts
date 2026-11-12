import "server-only";
import Groq from "groq-sdk";
import type { ChatCompletionMessageParam } from "groq-sdk/resources/chat/completions";
import { ProviderError, type CompleteRequest, type Provider, type TMsg, type Turn } from "../types";

// Fallback provider (free tier). Key: GROQ_API_KEY from console.groq.com.
const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
let client: Groq | null = null;

function toMessages(system: string, messages: TMsg[]): ChatCompletionMessageParam[] {
  const out: ChatCompletionMessageParam[] = [{ role: "system", content: system }];
  for (const m of messages) {
    if (m.role === "user") out.push({ role: "user", content: m.text });
    else if (m.role === "assistant")
      out.push({
        role: "assistant",
        content: m.text || null,
        ...(m.toolCalls.length
          ? {
              tool_calls: m.toolCalls.map((c) => ({
                id: c.id,
                type: "function" as const,
                function: { name: c.name, arguments: JSON.stringify(c.args) },
              })),
            }
          : {}),
      });
    else for (const r of m.results) out.push({ role: "tool", tool_call_id: r.id, content: r.isError ? `ERROR: ${r.content}` : r.content });
  }
  return out;
}

export const groq: Provider = {
  id: "groq",
  label: "Groq",
  model: MODEL,
  available: () => !!process.env.GROQ_API_KEY,
  async complete(req: CompleteRequest): Promise<Turn> {
    if (!client) client = new Groq({ apiKey: process.env.GROQ_API_KEY, timeout: 20_000, maxRetries: 1 });
    let res;
    try {
      res = await client.chat.completions.create({
        model: MODEL,
        messages: toMessages(req.system, req.messages),
        tools: req.tools.map((t) => ({
          type: "function" as const,
          function: { name: t.name, description: t.description, parameters: t.parameters },
        })),
        tool_choice: "auto",
        max_completion_tokens: 8192,
        ...(MODEL.includes("gpt-oss") ? { reasoning_effort: req.effort } : {}),
      });
    } catch (e) {
      const why = e instanceof Groq.APIError ? `HTTP ${e.status ?? "?"}` : (e as Error).message;
      throw new ProviderError(`Groq failed: ${why}`, "groq");
    }
    const choice = res?.choices?.[0];
    if (!choice?.message) throw new ProviderError("Groq returned no message", "groq");
    const calls = (choice?.message?.tool_calls ?? []).map((c) => {
      try {
        return { id: c.id, name: c.function.name, args: JSON.parse(c.function.arguments || "{}") };
      } catch {
        return { id: c.id, name: c.function.name, args: {}, badArgs: true };
      }
    });
    return {
      text: (choice?.message?.content ?? "").trim(),
      toolCalls: calls,
      stop: calls.length ? "tool" : choice?.finish_reason === "length" ? "max_tokens" : "end",
    };
  },
};
