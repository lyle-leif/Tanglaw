import "server-only";
import { claude } from "./providers/claude";
import { gemini } from "./providers/gemini";
import { groq } from "./providers/groq";
import { ProviderError, TulongError, type Provider, type ProviderId, type TMsg, type ToolCall, type ToolSpec } from "./types";

export const MAX_STEPS = 8; // hard cap on the tool loop, never while(true)

const ALL: Record<ProviderId, Provider> = { gemini, groq, claude };

/** Providers in the order to try: TULONG_PROVIDERS (default gemini, groq, claude), keyed ones only. */
export function providerOrder(): Provider[] {
  const ids = (process.env.TULONG_PROVIDERS || "gemini,groq,claude")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is ProviderId => s in ALL);
  return [...new Set(ids)].map((id) => ALL[id]).filter((p) => p.available());
}

/**
 * Runs `fn` on the first provider; on a ProviderError (rate limit, timeout, outage, bad output)
 * restarts the whole request on the next one. A TulongError is shown to the user as-is.
 */
export async function withFallback<T>(
  fn: (p: Provider) => Promise<T>,
  order: Provider[] = providerOrder(),
): Promise<{ result: T; provider: Provider }> {
  if (!order.length) {
    throw new TulongError("Tulong isn't set up: add GEMINI_API_KEY (or GROQ_API_KEY) to the .env file, then restart the app.");
  }
  let last: ProviderError | null = null;
  for (const p of order) {
    try {
      return { result: await fn(p), provider: p };
    } catch (e) {
      if (e instanceof TulongError) throw e; // user-facing (e.g. case not open): no point retrying
      // Anything else (API error, timeout, malformed response) is the provider's fault: try the next one
      const pe = e instanceof ProviderError ? e : new ProviderError(`${p.label} failed: ${(e as Error).message}`, p.id);
      console.warn(`[tulong] ${pe.message}; trying the next provider`);
      last = pe;
    }
  }
  throw new TulongError(
    last?.message.includes("checks")
      ? "Tulong's draft failed our checks, so it wasn't shown. Draft again."
      : "Tulong is unavailable right now (all AI providers failed). Try again in a moment.",
  );
}

export interface ToolOutcome<R> {
  content: string;
  isError?: boolean;
  final?: R; // set when this tool call finishes the run (e.g. an accepted plan)
}

/**
 * The tool loop on one provider. Provider-neutral: the provider only turns messages into a Turn.
 * Returns the final value from a tool, or the model's text when it stops calling tools.
 */
export async function runLoop<R>(
  p: Provider,
  opts: {
    system: string;
    messages: TMsg[];
    tools: ToolSpec[];
    effort: "low" | "medium";
    exec: (call: ToolCall) => Promise<ToolOutcome<R>>;
  },
): Promise<{ final?: R; text: string }> {
  const messages = [...opts.messages];
  for (let step = 0; step < MAX_STEPS; step++) {
    const turn = await p.complete({ system: opts.system, messages, tools: opts.tools, effort: opts.effort });
    if (turn.stop === "refusal") throw new ProviderError(`${p.label} declined the request`, p.id);
    if (turn.stop === "max_tokens") throw new ProviderError(`${p.label} ran out of output tokens`, p.id); // never run truncated input
    if (turn.stop === "end" || !turn.toolCalls.length) return { text: turn.text };

    messages.push({ role: "assistant", text: turn.text, toolCalls: turn.toolCalls, raw: turn.raw });
    const results = [];
    let final: R | undefined;
    for (const call of turn.toolCalls) {
      const out = call.badArgs
        ? { content: "The tool arguments were not valid JSON. Call the tool again with valid arguments.", isError: true }
        : await opts.exec(call);
      results.push({ id: call.id, name: call.name, content: out.content, isError: out.isError });
      if ((out as ToolOutcome<R>).final !== undefined) final = (out as ToolOutcome<R>).final;
    }
    if (final !== undefined) return { final, text: turn.text };
    messages.push({ role: "tool", results });
  }
  throw new ProviderError(`${p.label} took more than ${MAX_STEPS} steps`, p.id);
}
