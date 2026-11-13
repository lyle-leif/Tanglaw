"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Icon, Lock, Spin } from "@/components/Icons";
import { studentCode, studentName, formatCode } from "@/lib/student";

// Student sign-in: the case code the scholarship officer gave them. No email, no password.
export default function StudentEntry() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (studentCode.get()) router.replace("/student/chat");
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
      const r = await fetch(`/api/student/case?code=${encodeURIComponent(c)}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      studentCode.set(c);
      studentName.set(name);
      router.push("/student/chat");
    } catch (e) {
      setErr((e as Error).message || "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gate">
      <form className="card gate-card" onSubmit={submit}>
        <div className="gate-art">
          <div className="glow" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mascot/tulong.png" alt="Tulong, the AI helper" />
        </div>
        <h1>Enter your case code</h1>
        <p className="muted">The scholarship officer gives you this code when they open your case.</p>
        <label className="field">
          <span>Your first name (optional)</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="So Tulong can greet you" autoComplete="given-name" maxLength={40} />
        </label>
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
            <>
              Continue <Icon name="next" size={18} />
            </>
          )}
        </button>
        <p className="hint">
          <Lock /> No account or password. Your name stays on this phone, and the code only shows your own case.
        </p>
      </form>
    </div>
  );
}
