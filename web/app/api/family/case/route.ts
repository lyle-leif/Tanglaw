import { NextResponse } from "next/server";
import { getCaseState } from "@/lib/server/indexer";
import { store } from "@/lib/server/store";

// A family sees only its own case, found by the case code the social worker gave them.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get("code") ?? "";
  const caseId = code ? store.caseIdForCode(code) : undefined;
  if (!caseId) return NextResponse.json({ error: "We couldn't find that case code. Check it with the social worker." }, { status: 404 });
  const { snap, c } = await getCaseState(caseId);
  if (!c) {
    return NextResponse.json(
      { error: snap.error ?? "This case isn't open yet. Ask the social worker to finish opening it." },
      { status: snap.error ? 503 : 404 },
    );
  }
  return NextResponse.json(
    {
      label: c.label,
      billPhp: c.billPhp,
      coveredPhp: c.coveredPhp,
      remainingPhp: c.remainingPhp,
      hospitalLabel: snap.hospitalLabel,
      payments: snap.payments
        .filter((p) => p.caseId.toLowerCase() === c.caseId.toLowerCase())
        .map((p) => ({ program: snap.programs.find((x) => x.id === p.programId)?.name ?? "", amountPhp: p.amountPhp, tx: p.tx })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
