import { NextResponse } from "next/server";
import { verifyMessage } from "viem";
import { z } from "zod";
import { consumeNonce, setSessionCookie } from "@/lib/server/auth";
import { snapshot } from "@/lib/server/indexer";

// Step 2: check the signature, then check the wallet is the contract's registered social worker.
export const dynamic = "force-dynamic";

const Body = z.object({
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  message: z.string().max(1000),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const { address, message, signature } = parsed.data;

  const nonce = message.match(/^Nonce: ([0-9a-f]{32})$/m)?.[1];
  const wallet = message.match(/^Wallet: (0x[0-9a-f]{40})$/m)?.[1];
  if (!nonce || wallet !== address.toLowerCase() || !consumeNonce(nonce)) {
    return NextResponse.json({ error: "The sign-in request expired. Try again." }, { status: 400 });
  }
  const ok = await verifyMessage({ address: address as `0x${string}`, message, signature: signature as `0x${string}` }).catch(
    () => false,
  );
  if (!ok) return NextResponse.json({ error: "The signature doesn't match this wallet." }, { status: 401 });

  const snap = await snapshot();
  if (!snap.socialWorker) return NextResponse.json({ error: snap.error ?? "The contract isn't set up yet." }, { status: 503 });
  if (snap.socialWorker.toLowerCase() !== address.toLowerCase()) {
    return NextResponse.json(
      { error: "This wallet isn't the registered social worker. Switch to the Approver account in MetaMask." },
      { status: 403 },
    );
  }
  const res = NextResponse.json({ address: address.toLowerCase() });
  setSessionCookie(res, address);
  return res;
}
