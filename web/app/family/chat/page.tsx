"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Avatar, Check, Send } from "@/components/Icons";
import { chatKey, familyCode, LANGS, replyLang, type ReplyLang } from "@/lib/family";
import { peso } from "@/lib/peso";
import { consolidatedChecklist, PROGRAMS } from "@/lib/rules";

// Family screen (phone-first). UI is English; only Tulong's replies use the chosen language.
// No wallet, no crypto words, no refusals: it only changes when a payment succeeds.

type Card = "programs" | "checklist";
interface Msg {
  role: "user" | "assistant";
  text: string;
  cards?: Card[];
  error?: boolean;
}
interface FamilyCase {
  label: string;
  billPhp: number;
  coveredPhp: number;
  remainingPhp: number;
  hospitalLabel: string;
  payments: { program: string; amountPhp: number; tx: string }[];
}

// Tulong's first message, in the family's chosen language
const GREETING: Record<ReplyLang, string> = {
  taglish: "Hello po! Ako si Tulong. Ikuwento lang po ninyo ang sitwasyon at ang bill, at sasabihin ko kung anong tulong ang puwede.",
  english: "Hello po! I'm Tulong. Tell me about the situation and the hospital bill, and I'll tell you what help is available.",
  filipino: "Magandang araw po! Ako si Tulong. Ikuwento po ninyo ang sitwasyon at ang bayarin sa ospital, at sasabihin ko kung anong tulong ang maaari.",
};
const CHIPS = ["What should I bring?", "Where is my case?", "Who approves?"];

export default function FamilyChat() {
  const router = useRouter();
  const [code, setCode] = useState<string | null>(null);
  const [lang, setLang] = useState<ReplyLang>("taglish");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [online, setOnline] = useState(true);
  const [settings, setSettings] = useState(false);
  const [ticked, setTicked] = useState<Record<number, boolean>>({});
  const box = useRef<HTMLDivElement>(null);

  // Session: the case code saved on this phone
  useEffect(() => {
    const c = familyCode.get();
    if (!c) {
      router.replace("/family");
      return;
    }
    setCode(c);
    setLang(replyLang.get());
    try {
      const saved = JSON.parse(localStorage.getItem(chatKey(c)) || "[]");
      if (Array.isArray(saved)) setMsgs(saved);
    } catch {}
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [router]);

  useEffect(() => {
    if (!code) return;
    try {
      localStorage.setItem(chatKey(code), JSON.stringify(msgs.filter((m) => !m.error)));
    } catch {}
  }, [msgs, code]);

  // This family's own case, from the chain (polled)
  const { data: fc, error: caseErr } = useQuery<FamilyCase>({
    queryKey: ["familyCase", code],
    enabled: !!code,
    queryFn: async () => {
      const r = await fetch(`/api/family/case?code=${encodeURIComponent(code!)}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      return j;
    },
    refetchInterval: 5000,
  });

  const paid = !!fc && fc.billPhp > 0 && fc.remainingPhp === 0;
  const started = msgs.some((m) => m.role === "assistant" && !m.error);

  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight });
  }, [msgs, thinking, paid]);

  async function send(text: string) {
    const t = text.trim();
    if (!t || thinking || !code) return;
    const next: Msg[] = [...msgs.filter((m) => !m.error), { role: "user", text: t }];
    setMsgs(next);
    setInput("");
    setThinking(true);
    try {
      const r = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "chat", code, lang, history: next.map((m) => ({ role: m.role, text: m.text })) }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setMsgs([...next, { role: "assistant", text: j.reply, cards: j.cards }]);
    } catch {
      setMsgs([...next, { role: "assistant", error: true, text: "Sorry, Tulong couldn't answer right now. Please try again, or ask the social worker." }]);
    } finally {
      setThinking(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  function chooseLang(l: ReplyLang) {
    setLang(l);
    replyLang.set(l);
  }

  function clearChat() {
    if (confirm("Clear this conversation on this phone?")) {
      setMsgs([]);
      setTicked({});
      setSettings(false);
    }
  }

  function leaveCase() {
    if (confirm("Leave this case on this phone? You will need the case code to come back.")) {
      familyCode.clear();
      router.replace("/family");
    }
  }

  if (!code) return null;

  const pill = paid ? (
    <span className="pill green">✓ Paid</span>
  ) : started ? (
    <span className="pill amber">Waiting for approval</span>
  ) : (
    <span className="pill gray">New conversation</span>
  );

  const checklist = consolidatedChecklist();
  // Show each card once, on the first reply that produced it
  const firstCard: Record<string, number> = {};
  msgs.forEach((m, i) => m.cards?.forEach((c) => (firstCard[c] ??= i)));

  return (
    <section className="screen-wrap" aria-label="Family chat">
      <div className="phone">
        <div className="chat-head">
          <Avatar />
          <div className="who">
            <b>Tulong</b>
            <span>Medical aid helper</span>
          </div>
          {pill}
          <button className="icon-btn" onClick={() => setSettings((s) => !s)} aria-expanded={settings} aria-label="Settings">
            ⚙
          </button>
        </div>

        {settings && (
          <div className="settings" role="dialog" aria-label="Settings">
            <div className="settings-t">Tulong&apos;s language</div>
            <div className="lang-opts" role="radiogroup" aria-label="Tulong's language">
              {LANGS.map((l) => (
                <label key={l.id} className={"lang-opt" + (lang === l.id ? " on" : "")}>
                  <input type="radio" name="lang" checked={lang === l.id} onChange={() => chooseLang(l.id)} />
                  <b>{l.label}</b>
                  <span>{l.sample}</span>
                </label>
              ))}
            </div>
            <p className="hint" style={{ marginTop: 6 }}>
              Buttons and labels stay in English. Only Tulong&apos;s replies change.
            </p>
            <div className="settings-row">
              <span className="muted">Case code</span>
              <b className="mono">{code}</b>
            </div>
            <div className="settings-actions">
              <button className="btn secondary" onClick={clearChat}>
                Clear conversation
              </button>
              <button className="btn secondary" onClick={leaveCase}>
                Leave case
              </button>
            </div>
          </div>
        )}

        {!online && <div className="offline">No internet. Will retry.</div>}

        <div className="msgs" ref={box} aria-live="polite">
          <div className="b t">{GREETING[lang]}</div>
          {msgs.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="b a">
                {m.text}
              </div>
            ) : (
              <AssistantBlock
                key={i}
                m={{ ...m, cards: m.cards?.filter((c) => firstCard[c] === i) }}
                checklist={checklist}
                ticked={ticked}
                setTicked={setTicked}
              />
            ),
          )}
          {thinking && (
            <div className="b t" aria-label="Tulong is typing">
              <span className="typing">
                <i />
                <i />
                <i />
              </span>{" "}
              <span className="muted" style={{ fontSize: 14 }}>
                Tulong is checking the programs…
              </span>
            </div>
          )}

          {started && fc && !paid && (
            <div className="b t wide status-card">
              <div className="muted" style={{ fontSize: 14 }}>
                Your case · {fc.coveredPhp > 0 ? "Partly paid" : "Open"}
              </div>
              <div className="big num">Remaining: {peso(fc.remainingPhp)}</div>
              <div className="bar" style={{ margin: "8px 0" }}>
                <i style={{ width: `${(fc.coveredPhp / fc.billPhp) * 100}%` }} />
              </div>
              <div style={{ fontSize: 15 }}>Waiting for approval from the hospital social worker.</div>
            </div>
          )}
          {started && caseErr && !fc && <div className="b t wide note">{(caseErr as Error).message}</div>}

          {started && fc && paid && (
            <div className="b t wide paid-b status-card" role="status">
              <div className="ok">
                <Check />
                Paid!
              </div>
              <div style={{ margin: "6px 0 8px" }}>
                {peso(fc.coveredPhp)} was paid directly to the hospital. You have nothing left to pay on this bill.
              </div>
              <div className="big num" style={{ fontSize: 26 }}>
                Remaining: ₱0
              </div>
              <div className="bar" style={{ margin: "8px 0" }}>
                <i style={{ width: "100%" }} />
              </div>
              {fc.payments.map((p, i) => (
                <div className="row" key={i}>
                  <span>
                    {p.program} <b className="num">{peso(p.amountPhp)}</b>
                  </span>
                  <a className="link" href={`/receipt/${p.tx}`} target="_blank" rel="noreferrer">
                    View receipt ↗
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="chips">
          {CHIPS.map((c) => (
            <button key={c} className="chip" onClick={() => send(c)} disabled={thinking}>
              {c}
            </button>
          ))}
        </div>
        <form className="composer" onSubmit={onSubmit}>
          <label className="sr" htmlFor="cin">
            Message
          </label>
          <input
            id="cin"
            placeholder="Type a message…"
            autoComplete="off"
            value={input}
            maxLength={1000}
            onChange={(e) => setInput(e.target.value)}
          />
          <button aria-label="Send" disabled={thinking}>
            <Send />
          </button>
        </form>
        <div className="privacy">Please don&apos;t share full names or diagnoses.</div>
      </div>
    </section>
  );
}

function AssistantBlock({
  m,
  checklist,
  ticked,
  setTicked,
}: {
  m: Msg;
  checklist: string[];
  ticked: Record<number, boolean>;
  setTicked: (f: (t: Record<number, boolean>) => Record<number, boolean>) => void;
}) {
  return (
    <>
      <div className="b t" style={{ whiteSpace: "pre-wrap" }}>
        {m.text}
      </div>
      {m.cards?.includes("programs") && (
        <div className="b t wide">
          <h4>Programs that may help</h4>
          {PROGRAMS.map((p, i) => (
            <div className="prog" key={p.key}>
              <span className="n">{i + 1}</span>
              <div>
                <b>{p.name}</b>
                <span>{p.forAna}</span>
              </div>
            </div>
          ))}
          <div className="note">Simulated program rules for this demo.</div>
        </div>
      )}
      {m.cards?.includes("checklist") && (
        <div className="b t wide">
          <h4>One checklist for all programs</h4>
          <ul className="check">
            {checklist.map((t, i) => (
              <li key={i}>
                <input type="checkbox" id={`ck${i}`} checked={!!ticked[i]} onChange={() => setTicked((x) => ({ ...x, [i]: !x[i] }))} />
                <label htmlFor={`ck${i}`}>{t}</label>
              </li>
            ))}
          </ul>
          <div className="note">Only the hospital social worker can approve aid.</div>
        </div>
      )}
    </>
  );
}
