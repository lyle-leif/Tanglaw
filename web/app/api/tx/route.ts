import { NextResponse } from "next/server";
import { z } from "zod";
import { recordTx } from "@/lib/server/indexer";

// After a vault transaction is mined, the staff dashboard sends its hash here. The server reads that
// transaction's receipt from the chain and saves the vault's events from it (or, for a reverted
// approveAndPay, the refused request and the contract's error name), so the app works on public
// RPCs that refuse eth_getLogs.
// Public on purpose: nothing from the request is saved except what the chain confirms for this
// vault, and those facts are already public on BscScan. Anyone may add a missing vault tx.
export const dynamic = "force-dynamic";

const Body = z.object({ hash: z.string().regex(/^0x[0-9a-fA-F]{64}$/) });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const r = await recordTx(parsed.data.hash as `0x${string}`);
  return NextResponse.json(r, { status: r.ok ? 200 : 422 });
}
