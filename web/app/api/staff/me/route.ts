import { NextResponse } from "next/server";
import { getStaff } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const address = await getStaff();
  return NextResponse.json({ address }, { headers: { "Cache-Control": "no-store" } });
}
