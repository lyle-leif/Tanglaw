import { NextResponse } from "next/server";
import { z } from "zod";
import { getStaff, notStaff } from "@/lib/server/auth";
import { chat, draft, TulongError } from "@/lib/tulong";

// Tulong's only door. Server-side; the API key never reaches the browser.
// Tulong can read and draft. Nothing here can sign or send a transaction.

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const Body = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("chat"),
    code: z.string().max(20), // the family's case code
    lang: z.enum(["taglish", "english", "filipino"]).default("taglish"), // Tulong's reply language
    history: z
      .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(2000) }))
      .min(1)
      .max(40),
  }),
  z.object({ mode: z.literal("draft"), caseId: z.string().regex(/^0x[0-9a-fA-F]{64}$/) }),
]);

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  try {
    if (parsed.data.mode === "chat") {
      const { history, code, lang } = parsed.data;
      return NextResponse.json(await chat(history, code, lang));
    }
    if (!(await getStaff())) return notStaff(); // only the social worker can ask for a plan
    return NextResponse.json(await draft(parsed.data.caseId));
  } catch (e) {
    const msg = e instanceof TulongError ? e.message : "Something went wrong with Tulong.";
    if (!(e instanceof TulongError)) console.error(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
