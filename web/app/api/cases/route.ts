import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getStaff, notStaff } from "@/lib/server/auth";
import { store } from "@/lib/server/store";

// Off-chain part of a case (social worker only): the random salt behind caseHash, the memo
// attached to the bill, and the family's case code. Called just before she signs openCase.
export const dynamic = "force-dynamic";

const hex32 = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const Body = z.object({ caseId: hex32, caseHash: hex32, salt: hex32, memo: z.string().max(4000) });

// No 0/O, 1/I/L: easy to read aloud and type on a phone
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function newCode(): string {
  for (;;) {
    const b = crypto.randomBytes(6);
    const s = Array.from(b, (x) => ALPHABET[x % ALPHABET.length]).join("");
    const code = `TGL-${s.slice(0, 3)}-${s.slice(3)}`;
    if (!store.codeExists(code)) return code;
  }
}

export async function POST(req: Request) {
  if (!(await getStaff())) return notStaff();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const { caseId, caseHash, salt, memo } = parsed.data;
  if (store.getCase(caseId)) return NextResponse.json({ error: "Case exists" }, { status: 409 });
  const code = newCode();
  store.putCase(caseId, { caseHash, salt, memo: memo.trim(), openedAt: Date.now(), code });
  return NextResponse.json({ code });
}

/** caseId -> family code, for the staff dashboard */
export async function GET() {
  if (!(await getStaff())) return notStaff();
  return NextResponse.json({ codes: store.allCodes() });
}
