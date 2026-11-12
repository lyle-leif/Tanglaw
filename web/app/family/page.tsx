"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Spin } from "@/components/Icons";
import { familyCode, formatCode } from "@/lib/family";

// Family sign-in: the case code the social worker gave them. No email, no password.
export default function FamilyEntry() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (familyCode.get()) router.replace("/family/chat");
  }, [router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const c = formatCode(code);
    if (c.replace(/[^A-Z0-9]/g, "").length < 9) {
      setErr("The case code has 6 letters or numbers after TGL, like TGL-K7Q-4M2.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/family/case?code=${encodeURIComponent(c)}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      familyCode.set(c);
      router.push("/family/chat");
    } catch (e) {
      setErr((e as Error).message || "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gate">
      <form className="card gate-card" onSubmit={submit}>
        <h1>Enter your case code</h1>
        <p className="muted">The hospital social worker gives you this code when they open your case.</p>
        <label className="field">
          <span>Case code</span>
          <input
            className="code-input"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="TGL-K7Q-4M2"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            maxLength={14}
          />
        </label>
        {err && <div className="err-bar">{err}</div>}
        <button className="btn primary" disabled={busy || !code.trim()}>
          {busy ? (
            <>
              <Spin /> Checking…
            </>
          ) : (
            "Continue"
          )}
        </button>
        <p className="hint">No account or password needed. Your code only shows your own case.</p>
      </form>
    </div>
  );
}
