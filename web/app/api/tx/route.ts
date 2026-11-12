import { NextResponse } from "next/server";
import { z } from "zod";
import { getStaff, notStaff } from "@/lib/server/auth";
import { recordTx } from "@/lib/server/indexer";

// After the social worker's openCase or approveAndPay is mined, the dashboard sends the tx hash.
// The server reads that transaction's receipt from the chain and saves the vault's events from it,
// so the app works on public RPCs that refuse eth_getLogs. Nothing from the request body is saved
// except what the receipt confirms.
export const dynamic = "force-dynamic";

const Body = z.object({ hash: z.string().regex(/^0x[0-9a-fA-F]{64}$/) });

export async function POST(req: Request) {
  if (!(await getStaff())) return notStaff();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const r = await recordTx(parsed.data.hash as `0x${string}`);
  return NextResponse.json(r, { status: r.ok ? 200 : 422 });
}
