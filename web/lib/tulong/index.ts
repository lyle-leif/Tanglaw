import "server-only";
import { z } from "zod";
import { planHash, validateDraft, type Plan } from "../plan";
import { rulesForModel } from "../rules";
import { getCaseState } from "../server/indexer";
import { store } from "../server/store";
import { runLoop, withFallback } from "./core";
import { chatSystem, DRAFT_SYSTEM, type ReplyLang } from "./prompts";
import { caseForModel, DRAFT_PAYMENT_PLAN, GET_CASE_CHAT, GET_CASE_DRAFT, GET_PROGRAM_ROOM, LOOKUP_PROGRAMS, roomsForModel } from "./tools";
import { ProviderError, TulongError, type TMsg } from "./types";

// Tulong's public entry points. The app calls only these (through /api/assistant).
// Provider order and fallback: core.ts. Providers: providers/*.ts.

export { TulongError };

// ---------------------------------------------------------------- chat (student)

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

export interface ChatResult {
  reply: string;
  cards: ("programs" | "checklist")[];
  provider: string;
}

export async function chat(history: ChatTurn[], code: string, lang: ReplyLang = "taglish"): Promise<ChatResult> {
  const caseId = store.caseIdForCode(code);
  if (!caseId) throw new TulongError("We couldn't find that case code.");

  const messages: TMsg[] = history
    .filter((t) => t.text.trim())
    .slice(-12)
    .map((t) => (t.role === "user" ? { role: "user", text: t.text } : { role: "assistant", text: t.text, toolCalls: [] }));
  if (!messages.length || messages[0].role !== "user") messages.unshift({ role: "user", text: "Hello po." });

  const { result, provider } = await withFallback(async (p) => {
    const cards = new Set<"programs" | "checklist">();
    const out = await runLoop<never>(p, {
      system: chatSystem(lang),
      messages,
      tools: [LOOKUP_PROGRAMS, GET_CASE_CHAT],
      effort: "low",
      exec: async (call) => {
        if (call.name === "lookup_programs") {
          cards.add("programs");
          cards.add("checklist");
          return { content: JSON.stringify(rulesForModel()) };
        }
        if (call.name === "get_case") {
          const { snap, c } = await getCaseState(caseId); // only this student's own case
          return {
            content: JSON.stringify(
              c ? caseForModel(c, snap, false) : { status: "No case opened yet. The scholarship officer opens the case after reviewing the assessment." },
            ),
          };
        }
        return { content: "Unknown tool", isError: true };
      },
    });
    if (!out.text) throw new ProviderError(`${p.label} returned an empty reply`, p.id);
    return { reply: out.text, cards: [...cards] };
  });
  return { ...result, provider: provider.label };
}

// ---------------------------------------------------------------- draft (review screen)

const DraftInput = z.object({
  lines: z
    .array(
      z.object({
        program: z.string(),
        amountPhp: z.coerce.number(),
        reason: z.string(),
        source: z.string(),
      }),
    )
    .min(1),
  totalPhp: z.coerce.number(),
  warnings: z.array(z.string()).default([]),
});

export interface DraftResult {
  plan: Plan;
  hash: `0x${string}`;
  provider: string;
}

export async function draft(caseId: string): Promise<DraftResult> {
  const first = await getCaseState(caseId);
  if (!first.c) throw new TulongError("This case isn't open on-chain yet.");
  if (first.c.remainingPhp <= 0) throw new TulongError("This case is already fully paid.");
  const label = first.c.label;

  const { result, provider } = await withFallback(async (p) => {
    let failedChecks = 0;
    const out = await runLoop<{ plan: Plan; hash: `0x${string}` }>(p, {
      system: DRAFT_SYSTEM,
      messages: [{ role: "user", text: `Draft the payment plan for ${label} (caseId ${caseId}).` }],
      tools: [GET_CASE_DRAFT, GET_PROGRAM_ROOM, LOOKUP_PROGRAMS, DRAFT_PAYMENT_PLAN],
      effort: "medium",
      exec: async (call) => {
        const { snap, c } = await getCaseState(caseId); // fresh chain values every step
        if (!c) throw new TulongError("This case isn't open on-chain yet.");
        if (call.name === "get_case") return { content: JSON.stringify(caseForModel(c, snap, true)) };
        if (call.name === "get_program_room") return { content: JSON.stringify(roomsForModel(c, snap)) };
        if (call.name === "lookup_programs") return { content: JSON.stringify(rulesForModel()) };
        if (call.name !== "draft_payment_plan") return { content: "Unknown tool", isError: true };

        // Validate in code before anyone sees it. Two failed attempts -> try the next provider.
        const parsed = DraftInput.safeParse(call.args);
        const plan: Plan | null = parsed.success
          ? {
              caseId: c.caseId,
              lines: parsed.data.lines.map((l) => ({ program: l.program, amountPhp: l.amountPhp, reason: l.reason, source: l.source })),
              totalPhp: parsed.data.totalPhp,
              warnings: parsed.data.warnings,
            }
          : null;
        const errs = plan ? validateDraft(plan, c, snap.programs) : ["The arguments don't match the draft_payment_plan schema."];
        if (errs.length) {
          if (++failedChecks >= 2) throw new ProviderError(`${p.label}'s draft failed our checks twice: ${errs[0]}`, p.id);
          return { content: `The plan failed validation: ${errs.join(" ")} Fix it and call draft_payment_plan again.`, isError: true };
        }
        return { content: "Accepted. The scholarship officer will review it.", final: { plan: plan!, hash: planHash(plan!) } };
      },
    });
    if (!out.final) throw new ProviderError(`${p.label} didn't produce a plan`, p.id);
    return out.final;
  });

  store.putDraft(caseId, result.plan, result.hash, provider.label);
  return { ...result, provider: provider.label };
}
