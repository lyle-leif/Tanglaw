import "server-only";
import { ApiError, GoogleGenAI, type Content, type GenerateContentResponse, type Part } from "@google/genai";
import { ProviderError, type CompleteRequest, type Provider, type TMsg, type Turn } from "../types";

// Main provider (free tier). Key: GEMINI_API_KEY from Google AI Studio.
const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
let client: GoogleGenAI | null = null;

function toContents(messages: TMsg[]): Content[] {
  return messages.map((m): Content => {
    if (m.role === "user") return { role: "user", parts: [{ text: m.text }] };
    if (m.role === "assistant") {
      // Replay Gemini's own turn unchanged (keeps its thought signatures)
      if (m.raw) return m.raw as Content;
      const parts: Part[] = [];
      if (m.text) parts.push({ text: m.text });
      for (const c of m.toolCalls) parts.push({ functionCall: { id: c.id, name: c.name, args: c.args } });
      return { role: "model", parts };
    }
    return {
      role: "user",
      parts: m.results.map((r) => ({
        functionResponse: { id: r.id, name: r.name, response: r.isError ? { error: r.content } : { output: r.content } },
      })),
    };
  });
}

export const gemini: Provider = {
  id: "gemini",
  label: "Gemini",
  model: MODEL,
  available: () => !!process.env.GEMINI_API_KEY,
  async complete(req: CompleteRequest): Promise<Turn> {
    if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    let res: GenerateContentResponse;
    try {
      res = await client.models.generateContent({
        model: MODEL,
        contents: toContents(req.messages),
        config: {
          systemInstruction: req.system,
          tools: [
            {
              functionDeclarations: req.tools.map((t) => ({
                name: t.name,
                description: t.description,
                parametersJsonSchema: t.parameters,
              })),
            },
          ],
          maxOutputTokens: 8192,
          httpOptions: { timeout: 20_000 },
        },
      });
    } catch (e) {
      const why = e instanceof ApiError ? `HTTP ${e.status}` : (e as Error).message;
      throw new ProviderError(`Gemini failed: ${why}`, "gemini");
    }

    if (res.promptFeedback?.blockReason) return { text: "", toolCalls: [], stop: "refusal" };
    const cand = res.candidates?.[0];
    const finish = String(cand?.finishReason ?? "");
    if (["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII"].includes(finish)) return { text: "", toolCalls: [], stop: "refusal" };

    const calls = (res.functionCalls ?? []).map((fc, i) => ({
      id: fc.id ?? `call_${i}`,
      name: fc.name ?? "",
      args: (fc.args ?? {}) as Record<string, unknown>,
    }));
    const text = (cand?.content?.parts ?? [])
      .filter((p) => p.text && !p.thought)
      .map((p) => p.text)
      .join("")
      .trim();
    return {
      text,
      toolCalls: calls,
      stop: calls.length ? "tool" : finish === "MAX_TOKENS" ? "max_tokens" : "end",
      raw: cand?.content,
    };
  },
};
