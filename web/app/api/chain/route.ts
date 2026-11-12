import { NextResponse } from "next/server";
import { snapshot } from "@/lib/server/indexer";

// Public, read-only view of the vault: programs, cases (by random ID only) and Paid receipts.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await snapshot(), { headers: { "Cache-Control": "no-store" } });
}
