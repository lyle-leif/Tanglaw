"use client";

import Link from "next/link";
import { Icon } from "@/components/Icons";
import { addrUrl, refusalReason, txUrl } from "@/lib/chain";
import { peso, short } from "@/lib/peso";
import { useSnapshot } from "@/lib/useSnapshot";

// Public record: every Paid event from the vault, and every payment the contract refused.
// Program, amount, school, receipt. No names.

export default function ActivityPage() {
  const { data: snap, isLoading, error } = useSnapshot(6000);
  const pays = snap?.payments ?? [];
  const refusals = snap?.refusals ?? [];
  const progName = (id: number) => snap?.programs.find((x) => x.id === id)?.name;
  const total = pays.reduce((a, p) => a + p.amountPhp, 0);
  const nCases = new Set(pays.map((p) => p.caseId)).size;
  const loading = isLoading && !snap;
  // If the chain read failed, show a dash instead of a zero that looks real
  const noData = loading || (!!snap?.error && !pays.length && !refusals.length);

  return (
    <div className="act">
      <div className="act-hero">
        <div>
          <span className="pill green">● Read live from BNB Smart Chain testnet</span>
          <h1>Every peso, in public.</h1>
          <p>Each payment from the Tanglaw vault, paid straight to a school, and every payment the rules refused. No names. Case IDs are random.</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mascot/brand-wink.png" alt="" />
      </div>

      <div className="kpis num" aria-live="polite">
        <div className="card kpi">
          <div className="label">Paid to schools</div>
          <div className="v" style={{ color: "var(--green)" }}>
            {noData ? "—" : peso(total)}
          </div>
        </div>
        <div className="card kpi">
          <div className="label">Cases paid</div>
          <div className="v">{noData ? "—" : nCases}</div>
        </div>
        <div className="card kpi">
          <div className="label">Refused by the rules</div>
          <div className="v" style={{ color: "var(--red)" }}>
            {noData ? "—" : refusals.length}
          </div>
        </div>
        <div className="card kpi">
          <div className="label">Names on the record</div>
          <div className="v">0</div>
        </div>
      </div>

      {(error || snap?.error) && <div className="err-bar">{snap?.error ?? "Couldn't load the public record. Retrying…"}</div>}

      <div className="progs">
        {loading
          ? [0, 1, 2].map((i) => (
              <div className="card pc" key={i}>
                <div className="skel" style={{ width: "40%", marginBottom: 16 }} />
                <div className="skel" style={{ width: "80%", marginBottom: 10 }} />
                <div className="skel" />
              </div>
            ))
          : (snap?.programs ?? []).map((p) => {
              const paid = pays.filter((x) => x.programId === p.id).reduce((a, x) => a + x.amountPhp, 0);
              const budget = p.budgetLeftPhp + paid;
              const pct = budget ? (paid / budget) * 100 : 0;
              return (
                <div className="card pc" key={p.id}>
                  <h3>
                    {p.name}
                    <span className="muted" style={{ font: "500 13px Inter" }}>
                      cap {peso(p.capPhp)}/case
                    </span>
                  </h3>
                  <div className="grid num">
                    <div>
                      <div className="k">Paid so far</div>
                      <div className="paidv">{peso(paid)}</div>
                    </div>
                    <div>
                      <div className="k">Budget left</div>
                      <div className="left">{peso(p.budgetLeftPhp)}</div>
                    </div>
                  </div>
                  <div className="bar" role="img" aria-label={`${Math.round(pct)}% of budget paid`}>
                    <i style={{ width: `${pct}%` }} />
                  </div>
                  <div className="foot-note">of {peso(budget)} demo budget</div>
                </div>
              );
            })}
      </div>

      <section className="card receipts">
        <div className="sec-t" style={{ padding: "14px 16px 0" }}>
          Receipts
        </div>
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Case</th>
              <th>Program</th>
              <th>Amount</th>
              <th>School</th>
              <th>Receipt</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6}>
                  <div className="skel" style={{ margin: "6px 0" }} />
                  <div className="skel" style={{ margin: "12px 0 6px", width: "80%" }} />
                </td>
              </tr>
            ) : !pays.length ? (
              <tr>
                <td colSpan={6} className="empty">
                  No payments yet. Every approved payment will appear here, with no names.
                </td>
              </tr>
            ) : (
              pays.map((p, i) => (
                <tr key={p.tx + i}>
                  <td className="num">{p.time ? new Date(p.time * 1000).toTimeString().slice(0, 5) : "—"}</td>
                  <td className="mono">{short(p.caseId)}</td>
                  <td>{snap?.programs.find((x) => x.id === p.programId)?.name}</td>
                  <td className="num">
                    <b>{peso(p.amountPhp)}</b>
                  </td>
                  <td>{snap?.schoolLabel}</td>
                  <td>
                    <Link className="link" href={`/receipt/${p.tx}`}>
                      Receipt
                    </Link>
                    {" · "}
                    <a className="link" href={txUrl(p.tx)} target="_blank" rel="noreferrer">
                      BscScan <Icon name="ext" size={13} />
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
      <section className="card receipts refusals">
        <div className="sec-t" style={{ padding: "14px 16px 0" }}>
          Refused by the rules
        </div>
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Case</th>
              <th>Asked for</th>
              <th>Why the contract said no</th>
              <th>Proof</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5}>
                  <div className="skel" style={{ margin: "6px 0" }} />
                </td>
              </tr>
            ) : !refusals.length ? (
              <tr>
                <td colSpan={5} className="empty">
                  Nothing refused yet. If a plan breaks a rule, the contract stops it and it shows here. No money moves.
                </td>
              </tr>
            ) : (
              refusals.map((x) => {
                const bad = x.lines.find((l) => l.amountPhp > (snap?.programs.find((p) => p.id === l.programId)?.capPhp ?? Infinity));
                return (
                  <tr key={x.tx}>
                    <td className="num">{x.time ? new Date(x.time * 1000).toTimeString().slice(0, 5) : "—"}</td>
                    <td className="mono">{short(x.caseId)}</td>
                    <td className="num">
                      {x.lines.map((l, i) => (
                        <div key={i}>
                          {progName(l.programId)} <b>{peso(l.amountPhp)}</b>
                        </div>
                      ))}
                    </td>
                    <td>
                      <span className="pill red">✕ Refused</span> {refusalReason(x.err, progName((bad ?? x.lines[0])?.programId))}{" "}
                      <span className="mono muted">{x.err}</span>
                    </td>
                    <td>
                      <a className="link" href={txUrl(x.tx)} target="_blank" rel="noreferrer">
                        Failed tx ↗
                      </a>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      <p className="foot-note">
        A refused payment leaves no event on the chain, only a failed transaction. Refusals sent through this app are
        listed above; each links to its failed transaction on BscScan, where no money moved.
        {snap?.vault && (
          <>
            {" "}
            Vault contract:{" "}
            <a className="link" href={addrUrl(snap.vault)} target="_blank" rel="noreferrer">
              {short(snap.vault)} ↗
            </a>
          </>
        )}
      </p>

      <h2 style={{ fontSize: 26, marginTop: 28 }}>What this record proves</h2>
      <div className="proves-grid">
        <div className="card" style={{ borderColor: "#BFE3CB" }}>
          <h3 style={{ color: "var(--green-ink)" }}>
            <Icon name="check" size={18} /> The chain proves
          </h3>
          {[
            "Only the registered scholarship officer wallet approved",
            "Each program's per-case cap and budget were respected",
            "Money went only to the case's allowlisted school",
            "The total never exceeded the assessment (no double-funding)",
            "Which AI plan was approved (plan fingerprint)",
          ].map((t) => (
            <div className="ck" key={t}>
              <span className="c ok">
                <Icon name="check" size={13} />
              </span>
              {t}
            </div>
          ))}
        </div>
        <div className="card" style={{ borderColor: "#F2D9A0" }}>
          <h3 style={{ color: "var(--amber-ink)" }}>
            <Icon name="alert" size={18} /> It doesn&apos;t prove
          </h3>
          {[
            "That the assessment is authentic",
            "That the student is eligible",
            "That the program rules match real agency rules (they are simulated)",
            "That a real agency disbursed real money (testnet funds)",
          ].map((t) => (
            <div className="ck" key={t}>
              <span className="c w">
                <Icon name="x" size={13} />
              </span>
              {t}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
