"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { BaseError, UserRejectedRequestError } from "viem";
import { useConnect, useConnection, useConnectors, useDisconnect, useSignMessage } from "wagmi";
import { Icon, Lock, Spin } from "@/components/Icons";
import { short } from "@/lib/peso";
import { Dashboard } from "./Dashboard";

// Scholarship officer sign-in. She signs a one-time message in MetaMask (free, no transaction);
// the server checks it came from the contract's registered scholarship officer wallet.

function isUserReject(e: unknown): boolean {
  if (e instanceof BaseError) return !!e.walk((x) => x instanceof UserRejectedRequestError);
  return (e as { code?: number })?.code === 4001;
}

export default function StaffPage() {
  const qc = useQueryClient();
  const conn = useConnection();
  const connectors = useConnectors();
  const connect = useConnect();
  const disconnect = useDisconnect();
  const signMessage = useSignMessage();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const me = useQuery<{ address: string | null }>({
    queryKey: ["staffMe"],
    queryFn: async () => (await fetch("/api/staff/me", { cache: "no-store" })).json(),
  });
  const session = me.data?.address ?? null;
  const wallet = conn.address?.toLowerCase();

  async function signIn() {
    if (!wallet) return;
    setBusy(true);
    setErr(null);
    try {
      const n = await fetch(`/api/staff/nonce?address=${wallet}`, { cache: "no-store" });
      const { message, error } = await n.json();
      if (!n.ok) throw new Error(error);
      const signature = await signMessage.mutateAsync({ message });
      const r = await fetch("/api/staff/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: wallet, message, signature }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      await qc.invalidateQueries({ queryKey: ["staffMe"] });
    } catch (e) {
      setErr(isUserReject(e) ? "You cancelled the signature. You are not signed in." : (e as Error).message || "Sign-in failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await fetch("/api/staff/logout", { method: "POST" }).catch(() => {});
    disconnect.mutate();
    qc.removeQueries({ queryKey: ["caseCodes"] });
    await qc.invalidateQueries({ queryKey: ["staffMe"] });
  }

  if (me.isLoading) {
    return (
      <div className="gate">
        <div className="card gate-card">
          <div className="skel" style={{ width: "60%", marginBottom: 10 }} />
          <div className="skel" />
        </div>
      </div>
    );
  }

  // Signed in, and the connected wallet (if any) is the same one
  if (session && (!wallet || wallet === session)) {
    return (
      <>
        <div className="staff-bar">
          <span className="muted">
            Signed in as scholarship officer <b className="mono">{short(session)}</b>
          </span>
          <button className="btn ghost" onClick={signOut}>
            <Icon name="logout" size={16} /> Sign out
          </button>
        </div>
        <Dashboard onUnauthorized={() => qc.invalidateQueries({ queryKey: ["staffMe"] })} />
      </>
    );
  }

  return (
    <div className="gate">
      <div className="card gate-card">
        <h1>Scholarship officer sign-in</h1>
        <p className="muted">
          Sign in with the scholarship officer wallet in MetaMask. Signing the message is free and does not send a transaction.
        </p>

        {session && wallet && wallet !== session && (
          <div className="notice">
            You are signed in as {short(session)}, but MetaMask is now on {short(wallet)}. Sign in again with this wallet, or switch back
            in MetaMask.
          </div>
        )}

        {!wallet ? (
          <button
            className="btn primary"
            onClick={() => connect.mutate({ connector: connectors[0] })}
            disabled={!connectors.length || connect.isPending}
          >
            {connect.isPending ? (
              <>
                <Spin /> Connecting…
              </>
            ) : (
              "Connect MetaMask"
            )}
          </button>
        ) : (
          <>
            <div className="settings-row">
              <span className="muted">Wallet</span>
              <b className="mono">{short(wallet)}</b>
            </div>
            <button className="btn primary" onClick={signIn} disabled={busy}>
              {busy ? (
                <>
                  <Spin /> Confirm in MetaMask…
                </>
              ) : (
                "Sign in"
              )}
            </button>
            <button className="btn ghost" onClick={() => disconnect.mutate()}>
              Use a different wallet
            </button>
          </>
        )}
        {!connectors.length && <div className="notice">MetaMask wasn&apos;t found. Install it, or open this page in the MetaMask app.</div>}
        {connect.error && !isUserReject(connect.error) && <div className="err-bar">{connect.error.message}</div>}
        {err && <div className="err-bar">{err}</div>}
        <p className="hint">
          <Lock /> Only the wallet registered in the contract as the scholarship officer can sign in. The app never sees your private key.
        </p>
      </div>
    </div>
  );
}
