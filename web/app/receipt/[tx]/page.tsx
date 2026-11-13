"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { parseEventLogs } from "viem";
import { usePublicClient } from "wagmi";
import { Icon } from "@/components/Icons";
import { CHAIN, VAULT_ABI, addrUrl, txUrl } from "@/lib/chain";
import { peso, short, weiToPeso } from "@/lib/peso";
import { planHash, type Plan } from "@/lib/plan";
import { useSnapshot } from "@/lib/useSnapshot";

// Public receipt for one payment transaction. The "plan matches" check runs in the visitor's
// browser: it reads the transaction receipt straight from BSC testnet (not from our server),
// takes the planHash the contract stored, and compares it with the fingerprint of the plan
// the social worker approved. Same plan → same fingerprint. Any change → no match.

type Check =
  | { state: "ok"; onchainHash: string; lines: { programId: number; amountPhp: number }[]; hospital: string; block: bigint }
  | { state: "error"; message: string };

export default function ReceiptPage() {
  const { tx } = useParams<{ tx: string }>();
  const valid = /^0x[0-9a-fA-F]{64}$/.test(tx ?? "");
  const pc = usePublicClient({ chainId: CHAIN.id });
  const { data: snap } = useSnapshot(15000);

  // 1. Straight from the chain, in this browser
  const chain = useQuery<Check>({
    queryKey: ["receipt", tx],
    enabled: valid && !!pc && !!snap?.vault,
    retry: 2,
    queryFn: async () => {
      const r = await pc!.getTransactionReceipt({ hash: tx as `0x${string}` });
      if (r.status !== "success") return { state: "error", message: "This transaction was refused by the contract, so nothing was paid." };
      const vault = snap!.vault!.toLowerCase();
      const paid = parseEventLogs({ abi: VAULT_ABI, eventName: "Paid", logs: r.logs.filter((l) => l.address.toLowerCase() === vault) });
      if (!paid.length) return { state: "error", message: "This transaction isn't a payment from the Tanglaw vault." };
      return {
        state: "ok",
        onchainHash: paid[0].args.planHash,
        lines: paid.map((e) => ({ programId: Number(e.args.programId), amountPhp: weiToPeso(e.args.amount) })),
        hospital: paid[0].args.hospital,
        block: r.blockNumber,
      };
    },
  });
  const onchain = chain.data?.state === "ok" ? chain.data : null;

  // 2. The approved plan, by its fingerprint (public: it is the proof)
  const plan = useQuery<Plan | null>({
    queryKey: ["plan", onchain?.onchainHash],
    enabled: !!onchain,
    queryFn: async () => (await (await fetch(`/api/plans?hash=${onchain!.onchainHash}`)).json()).plan,
  });

  const time = useQuery<number | null>({
    queryKey: ["blocktime", onchain?.block.toString()],
    enabled: !!onchain && !!pc,
    queryFn: async () => Number((await pc!.getBlock({ blockNumber: onchain!.block })).timestamp),
  });

  const progName = (id: number) => snap?.programs.find((p) => p.id === id)?.name ?? `Program ${id}`;
  const total = onchain?.lines.reduce((a, l) => a + l.amountPhp, 0) ?? 0;
  const recomputed = plan.data ? planHash(plan.data) : null;
  const matches = !!recomputed && !!onchain && recomputed.toLowerCase() === onchain.onchainHash.toLowerCase();

  if (!valid) {
    return (
      <div className="rcpt">
        <div className="card rcpt-card">
          <h1>Receipt not found</h1>
          <p className="muted">This link doesn&apos;t point to a transaction.</p>
          <Link className="link" href="/activity">
            Go to the public record
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rcpt">
      <div className="card rcpt-card">
        <div className="rcpt-band">
          <div>
            <div className="label">Paid to the hospital</div>
            <h1 className="num">{onchain ? peso(total) : "…"}</h1>
            <div style={{ fontSize: 14 }}>
              {snap?.hospitalLabel ?? "The hospital"} · BSC testnet
              {time.data ? ` · ${new Date(time.data * 1000).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}` : ""}
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mascot/brand-wave.png" alt="" />
        </div>
        <div className="rcpt-body">
        {chain.isLoading || (!chain.data && !chain.error) ? (
          <>
            <div className="skel" style={{ margin: "18px 0 10px" }} />
            <div className="skel" style={{ width: "70%" }} />
          </>
        ) : chain.data?.state === "error" || chain.error ? (
          <div className="err-bar" style={{ marginTop: 16 }}>
            {chain.data?.state === "error" ? chain.data.message : "Couldn't read this transaction from BSC testnet. Try again in a moment."}
          </div>
        ) : (
          onchain && (
            <>
              <table className="rcpt-lines">
                <tbody>
                  {onchain.lines.map((l, i) => {
                    const pl = plan.data?.lines.find((x) => x.program === progName(l.programId));
                    return (
                      <tr key={i}>
                        <td>
                          <b>{progName(l.programId)}</b>
                          {pl?.reason && <div className="muted rcpt-reason">{pl.reason}</div>}
                        </td>
                        <td className="num amt">{peso(l.amountPhp)}</td>
                      </tr>
                    );
                  })}
                  <tr className="tot">
                    <td>Total paid to the hospital</td>
                    <td className="num amt">{peso(total)}</td>
                  </tr>
                </tbody>
              </table>

              <div className={`verify ${plan.isLoading ? "" : matches ? "ok" : "bad"}`} role="status">
                {plan.isLoading ? (
                  <span className="muted">Checking the approved plan against the blockchain…</span>
                ) : matches ? (
                  <>
                    <div className="vh">Plan matches the blockchain</div>
                    <div>
                      The plan the social worker approved gives the same fingerprint the contract stored with this payment. Nobody
                      changed it after approval.
                    </div>
                  </>
                ) : !plan.data ? (
                  <>
                    <div className="vh">Plan not found in this app</div>
                    <div>The payment is real on the blockchain, but this app doesn&apos;t have the plan text to compare.</div>
                  </>
                ) : (
                  <>
                    <div className="vh">✕ Plan doesn&apos;t match</div>
                    <div>The stored plan gives a different fingerprint from the one on the blockchain.</div>
                  </>
                )}
                <dl className="hashes mono">
                  <dt>On the blockchain</dt>
                  <dd>{onchain.onchainHash}</dd>
                  {recomputed && (
                    <>
                      <dt>Fingerprint of the plan</dt>
                      <dd>{recomputed}</dd>
                    </>
                  )}
                </dl>
                <p className="muted how">
                  How it works: the fingerprint (keccak256 of the plan) is checked in your browser, and the on-chain value is read
                  directly from BSC testnet, not from our server.
                </p>
              </div>

              <dl className="rcpt-meta">
                <dt>Transaction</dt>
                <dd>
                  <a className="link mono" href={txUrl(tx)} target="_blank" rel="noreferrer">
                    {short(tx)} ↗
                  </a>
                </dd>
                <dt>Hospital wallet</dt>
                <dd>
                  <a className="link mono" href={addrUrl(onchain.hospital)} target="_blank" rel="noreferrer">
                    {short(onchain.hospital)} ↗
                  </a>
                </dd>
                <dt>Network</dt>
                <dd>BSC Testnet · test funds, not a real disbursement</dd>
              </dl>
              <div className="rcpt-actions no-print">
                <button className="btn secondary" onClick={() => window.print()}>
                  <Icon name="print" size={16} /> Print
                </button>
                <button className="btn secondary" onClick={() => navigator.clipboard?.writeText(window.location.href)}>
                  <Icon name="link" size={16} /> Copy link
                </button>
                <a className="btn outline" href={txUrl(tx)} target="_blank" rel="noreferrer">
                  View on BscScan <Icon name="ext" size={14} />
                </a>
              </div>
            </>
          )
        )}
        </div>
      </div>
      <p className="foot-note no-print">
        <Link className="link" href="/activity">
          ← Public record
        </Link>
      </p>
    </div>
  );
}
