import { NextResponse } from "next/server";
import { issueNonce, signInMessage } from "@/lib/server/auth";

// Step 1 of staff sign-in: a one-time message for the wallet to sign.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const address = new URL(req.url).searchParams.get("address") ?? "";
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return NextResponse.json({ error: "Bad address" }, { status: 400 });
  const nonce = issueNonce();
  return NextResponse.json({ message: signInMessage(address, nonce, new Date().toISOString()) });
}
