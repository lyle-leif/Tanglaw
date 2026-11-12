import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { Plan } from "../plan";

// Off-chain demo data: case salts and memos, Tulong's drafts and every plan keyed by its hash.
// A JSON file is enough for the demo (MIGRATION.md §8). It is gitignored. On a read-only host
// (e.g. Vercel) it falls back to memory.

interface CaseRecord {
  salt: string; // random 32 bytes; caseHash = keccak256(salt ‖ record). Never on-chain.
  caseHash: string;
  memo: string; // document attached to the bill (data for Tulong, never instructions)
  openedAt: number;
  code: string; // family case code, e.g. TGL-K7Q-4M2. Off-chain only.
}

interface StoreShape {
  cases: Record<string, CaseRecord>;
  drafts: Record<string, { plan: Plan; provider: string }>; // latest validated Tulong draft per caseId
  plans: Record<string, Plan>; // planHash -> plan JSON
  codes: Record<string, string>; // family case code -> caseId
}

const FILE = path.join(process.cwd(), ".data", "store.json");
// One copy per server process, shared by every route bundle
const g = globalThis as unknown as { __tanglawStore?: StoreShape };

function load(): StoreShape {
  if (g.__tanglawStore) return g.__tanglawStore;
  let s: StoreShape;
  try {
    s = JSON.parse(fs.readFileSync(FILE, "utf8")) as StoreShape;
  } catch {
    s = { cases: {}, drafts: {}, plans: {}, codes: {} };
  }
  s.codes ??= {};
  g.__tanglawStore = s;
  return s;
}

function save() {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(g.__tanglawStore, null, 2));
  } catch {
    // read-only filesystem: keep it in memory
  }
}

const key = (id: string) => id.toLowerCase();
/** "tgl k7q 4m2" -> "TGLK7Q4M2" (codes are compared without dashes or spaces) */
export const normCode = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, "");

export const store = {
  getCase: (caseId: string) => load().cases[key(caseId)],
  putCase(caseId: string, rec: CaseRecord) {
    const s = load();
    s.cases[key(caseId)] = rec;
    s.codes[normCode(rec.code)] = key(caseId);
    save();
  },
  caseIdForCode: (code: string) => load().codes[normCode(code)],
  codeExists: (code: string) => normCode(code) in load().codes,
  allCodes: () => Object.fromEntries(Object.entries(load().cases).map(([id, c]) => [id, c.code])),
  getDraft: (caseId: string) => load().drafts[key(caseId)],
  putDraft(caseId: string, plan: Plan, hash: string, provider: string) {
    const s = load();
    s.drafts[key(caseId)] = { plan, provider };
    s.plans[hash.toLowerCase()] = plan;
    save();
  },
  getPlan: (hash: string) => load().plans[hash.toLowerCase()],
  putPlan(hash: string, plan: Plan) {
    load().plans[hash.toLowerCase()] = plan;
    save();
  },
};
