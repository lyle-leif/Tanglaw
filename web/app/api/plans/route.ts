import { NextResponse } from "next/server";
import { z } from "zod";
import { planHash, type Plan } from "@/lib/plan";
import { getStaff, notStaff } from "@/lib/server/auth";
import { store } from "@/lib/server/store";

// GET ?caseId=  -> Tulong's latest validated draft for the case (social worker only)
// GET ?hash=    -> the plan JSON behind an on-chain planHash (public: it is the proof)
// POST {plan}   -> store an edited plan before it is signed; returns its hash (social worker only)
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const caseId = u.searchParams.get("caseId");
  const hash = u.searchParams.get("hash");
  if (caseId) {
    if (!(await getStaff())) return notStaff();
    const d = store.getDraft(caseId);
    return NextResponse.json(d ? { plan: d.plan, hash: planHash(d.plan), provider: d.provider } : { plan: null });
  }
  if (hash) return NextResponse.json({ plan: store.getPlan(hash) ?? null });
  return NextResponse.json({ error: "caseId or hash required" }, { status: 400 });
}

const Line = z.object({
  program: z.string().max(40),
  amountPhp: z.number().int().nonnegative().max(1e12),
  reason: z.string().max(500),
  source: z.string().max(80),
});
const PlanZ = z.object({
  caseId: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  lines: z.array(Line).min(1).max(10),
  totalPhp: z.number().int().nonnegative(),
  warnings: z.array(z.string().max(500)).max(10),
  edited: z.boolean().optional(),
});

export async function POST(req: Request) {
  if (!(await getStaff())) return notStaff();
  const parsed = z.object({ plan: PlanZ }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const plan = parsed.data.plan as Plan;
  const hash = planHash(plan);
  store.putPlan(hash, plan);
  return NextResponse.json({ hash });
}
