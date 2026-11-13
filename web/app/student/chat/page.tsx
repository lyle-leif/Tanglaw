"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Avatar, Icon, Send } from "@/components/Icons";
import { Tracker } from "@/components/Tracker";
import { chatKey, studentCode, studentName, LANGS, replyLang, type ReplyLang } from "@/lib/student";
import { peso } from "@/lib/peso";
import { consolidatedChecklist, PROGRAMS } from "@/lib/rules";

// Student screen (phone-first). UI is English; only Tulong's replies use the chosen language.
// No wallet, no crypto words, no refusals: it only changes when a payment succeeds.

type Card = "programs" | "checklist";
interface Msg {
  role: "user" | "assistant";
  text: string;
  cards?: Card[];
  error?: boolean;
}
interface StudentCase {
  label: string;
  billPhp: number;
  coveredPhp: number;
  remainingPhp: number;
  schoolLabel: string;
  payments: { program: string; amountPhp: number; tx: string }[];
}

// Tulong's first message, in the student's chosen language
const GREETING: Record<ReplyLang, string> = {
  taglish: "Hello po! Ako si Tulong. Ikuwento lang po ninyo ang sitwasyon at ang assessment ninyo, at sasabihin ko kung anong tulong ang puwede.",
  english: "Hello po! I'm Tulong. Tell me about the situation and the assessment, and I'll tell you what help is available.",
  filipino: "Magandang araw po! Ako si Tulong. Ikuwento po ninyo ang sitwasyon at ang bayarin sa matrikula, at sasabihin ko kung anong tulong ang maaari.",
};
const CHIPS = ["What should I bring?", "Where is my case?", "Who approves?"];
// Starter questions on the empty chat screen
const QUESTIONS = ["Which scholarships can I use?", "What are the requirements?", "Who approves my request?", "How do I track my request?"];

export default function StudentChat() {
  const router = useRouter();
  const [code, setCode] = useState<string | null>(null);
  const [lang, setLang] = useState<ReplyLang>("taglish");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [online, setOnline] = useState(true);
  const [settings, setSettings] = useState(false);
  const [name, setName] = useState("");
  const [draftLang, setDraftLang] = useState<ReplyLang>("taglish");
  const [draftName, setDraftName] = useState("");
  const [ticked, setTicked] = useState<Record<number, boolean>>({});
  const box = useRef<HTMLDivElement>(null);

  // Session: the case code saved on this phone
  useEffect(() => {
    const c = studentCode.get();
    if (!c) {
      router.replace("/student");
      return;
    }
    setCode(c);
    setLang(replyLang.get());
    setName(studentName.get());
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

  // This student's own case, from the chain (polled)
  const { data: fc, error: caseErr } = useQuery<StudentCase>({
    queryKey: ["studentCase", code],
    enabled: !!code,
    queryFn: async () => {
      const r = await fetch(`/api/student/case?code=${encodeURIComponent(code!)}`, { cache: "no-store" });
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
      setMsgs([...next, { role: "assistant", error: true, text: "Sorry, Tulong couldn't answer right now. Please try again, or ask the scholarship officer." }]);
    } finally {
      setThinking(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  function openSettings() {
    setDraftLang(lang);
    setDraftName(name);
    setSettings(true);
  }

  function saveSettings() {
    setLang(draftLang);
    replyLang.set(draftLang);
    studentName.set(draftName);
    setName(studentName.get());
    setSettings(false);
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
      studentCode.clear();
      studentName.clear();
      router.replace("/student");
    }
  }

  if (!code) return null;

  const pill = paid ? (
    <span className="pill green">
      <Icon name="check" size={13} /> Paid
    </span>
  ) : started ? (
    <span className="pill amber">In review</span>
  ) : null;

  const checklist = consolidatedChecklist();
  // Show each card once, on the first reply that produced it
  const firstCard: Record<string, number> = {};
  msgs.forEach((m, i) => m.cards?.forEach((c) => (firstCard[c] ??= i)));
  const empty = msgs.length === 0 && !thinking;

  return (
    <section className="screen-wrap" aria-label="Student chat">
      <div className="phone">
        <div className="chat-head">
          <Link href="/" className="circle-btn" aria-label="Back to home">
            <Icon name="back" />
          </Link>
          {empty ? (
            <span style={{ marginLeft: "auto" }} />
          ) : (
            <>
              <Avatar />
              <div className="who">
                <b>Tulong</b>
                <span>AI helper</span>
              </div>
              {pill}
            </>
          )}
          <button className="circle-btn" onClick={openSettings} aria-expanded={settings} aria-label="Settings">
            <Icon name="gear" />
          </button>
        </div>

        {settings && (
          <div className="settings" role="dialog" aria-label="AI Chat Settings">
            <div className="set-head">
              <button className="circle-btn" onClick={() => setSettings(false)} aria-label="Close settings">
                <Icon name="back" />
              </button>
              <h2>AI Chat Settings</h2>
            </div>
            <div className="set-body">
              <div className="card set-sec">
                <h3>
                  <span className="ic">
                    <Icon name="chat" />
                  </span>
                  <span>
                    Language
                    <small>Choose how Tulong replies to you</small>
                  </span>
                </h3>
                <div className="lang-opts" role="radiogroup" aria-label="Tulong's language">
                  {LANGS.map((l) => (
                    <label key={l.id} className={"lang-opt" + (draftLang === l.id ? " on" : "")}>
                      <input type="radio" name="lang" checked={draftLang === l.id} onChange={() => setDraftLang(l.id)} />
                      <b>{l.label}</b>
                      <span>{l.sample}</span>
                    </label>
                  ))}
                </div>
                <p className="hint">Buttons and labels stay in English. Only Tulong&apos;s replies change.</p>
              </div>
              <label className="field" style={{ margin: 0 }}>
                <span>Your first name (stays on this phone)</span>
                <input value={draftName} onChange={(e) => setDraftName(e.target.value)} maxLength={40} placeholder="Optional" />
              </label>
              <button className="btn primary" onClick={saveSettings}>
                Save Preference
              </button>
              <div className="card set-sec">
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
            </div>
          </div>
        )}

        {!online && <div className="offline">No internet. Will retry.</div>}

        {empty ? (
          <div className="hello">
            <h1>
              Hello{name ? ", " : " "}
              <span className="underline">{name ? `${name}!` : "po!"}</span>
            </h1>
            <p>How can I help you today?</p>
            <div className="hello-art">
              <div className="glow" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/mascot/tulong.png" alt="Tulong, the AI helper" />
            </div>
            <div className="try">Try asking about:</div>
            <div className="qgrid">
              {QUESTIONS.map((q) => (
                <button key={q} className="q" onClick={() => send(q)}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="msgs" ref={box} aria-live="polite">
            <BotRow>{GREETING[lang]}</BotRow>
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
              <BotRow label="Tulong is typing">
                <span className="typing">
                  <i />
                  <i />
                  <i />
                </span>{" "}
                <span className="muted" style={{ fontSize: 13 }}>
                  Tulong is checking the programs…
                </span>
              </BotRow>
            )}

            {started && fc && !paid && (
              <div className="b t wide status-card">
                <h4>Your case</h4>
                <Tracker paid={false} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 8 }}>
                  <span className="muted">{fc.coveredPhp > 0 ? "Partly paid · Remaining" : "Remaining"}</span>
                  <b className="big num">{peso(fc.remainingPhp)}</b>
                </div>
                <div className="note">Waiting for approval from the scholarship officer.</div>
              </div>
            )}
            {started && caseErr && !fc && <div className="b t wide note">{(caseErr as Error).message}</div>}

            {started && fc && paid && (
              <div className="b t wide paid-b status-card" role="status">
                <div className="paid-top">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/mascot/brand-wave.png" alt="" />
                  <div>
                    <div className="label" style={{ color: "var(--green)" }}>
                      Paid to the school
                    </div>
                    <div className="big num poppins">₱0 left</div>
                  </div>
                </div>
                <div style={{ fontSize: 14, marginBottom: 6 }}>
                  {peso(fc.coveredPhp)} was paid directly to {fc.schoolLabel || "the school"}. You have nothing left to pay on this assessment.
                </div>
                <Tracker paid />
                {fc.payments.map((p, i) => (
                  <div className="row" key={i}>
                    <span>
                      {p.program} <b className="num">{peso(p.amountPhp)}</b>
                    </span>
                    <a className="link" href={`/receipt/${p.tx}`} target="_blank" rel="noreferrer">
                      View receipt
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!empty && (
          <div className="chips">
            {CHIPS.map((c) => (
              <button key={c} className="chip" onClick={() => send(c)} disabled={thinking}>
                {c}
              </button>
            ))}
          </div>
        )}
        <form className="composer" onSubmit={onSubmit}>
          <label className="sr" htmlFor="cin">
            Message
          </label>
          <input
            id="cin"
            placeholder="Ask me anything…"
            autoComplete="off"
            value={input}
            maxLength={1000}
            onChange={(e) => setInput(e.target.value)}
          />
          <button aria-label="Send" disabled={thinking}>
            <Send />
          </button>
        </form>
        <div className="privacy">Please don&apos;t share full names, student numbers or grades.</div>
      </div>
    </section>
  );
}

function BotRow({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <div className="trow" aria-label={label}>
      <Avatar size={30} />
      <div className="b t" style={{ whiteSpace: "pre-wrap" }}>
        {children}
      </div>
    </div>
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
      <BotRow>{m.text}</BotRow>
      {m.cards?.includes("programs") && (
        <div className="b t wide">
          <h4>
            <Icon name="shield" size={18} /> Programs that may help
          </h4>
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
          <h4>
            <Icon name="file" size={18} /> One checklist for all programs
          </h4>
          <ul className="check">
            {checklist.map((t, i) => (
              <li key={i}>
                <input type="checkbox" id={`ck${i}`} checked={!!ticked[i]} onChange={() => setTicked((x) => ({ ...x, [i]: !x[i] }))} />
                <label htmlFor={`ck${i}`}>{t}</label>
              </li>
            ))}
          </ul>
          <div className="note">Only the scholarship officer can approve aid.</div>
        </div>
      )}
    </>
  );
}
