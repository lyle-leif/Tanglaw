"use client";

// The family's session lives only in their browser: the case code they typed and the
// language they want Tulong to reply in. No account data is stored on a server.

export type ReplyLang = "taglish" | "english" | "filipino";

export const LANGS: { id: ReplyLang; label: string; sample: string }[] = [
  { id: "taglish", label: "Taglish", sample: "“May mga programang puwedeng tumulong po.”" },
  { id: "english", label: "English", sample: "“There are programs that can help.”" },
  { id: "filipino", label: "Filipino", sample: "“May mga programang maaaring tumulong po.”" },
];

const CODE_KEY = "tanglaw.family.code";
const LANG_KEY = "tanglaw.family.lang";

function get(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function set(k: string, v: string | null) {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {}
}

export const familyCode = {
  get: () => get(CODE_KEY),
  set: (c: string) => set(CODE_KEY, c),
  clear: () => set(CODE_KEY, null),
};

export const replyLang = {
  get: (): ReplyLang => {
    const v = get(LANG_KEY);
    return v === "english" || v === "filipino" ? v : "taglish";
  },
  set: (l: ReplyLang) => set(LANG_KEY, l),
};

/** "tgl k7q4m2" -> "TGL-K7Q-4M2" */
export function formatCode(raw: string): string {
  let s = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!s.startsWith("TGL")) s = "TGL" + s;
  s = s.slice(3, 9);
  return "TGL-" + s.slice(0, 3) + (s.length > 3 ? "-" + s.slice(3) : "");
}

export const chatKey = (code: string) => `tanglaw.chat.${code.toUpperCase().replace(/[^A-Z0-9]/g, "")}`;
