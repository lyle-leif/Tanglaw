import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { PaymentRow, RefusalRow } from "../chain";
import type { Plan } from "../plan";
import { getConfig } from "./config";

// Off-chain demo data: case salts and memos, Tulong's drafts and every plan keyed by its hash.
// A JSON file is enough for the demo (MIGRATION.md §8). It is gitignored. On a read-only host
// (e.g. Vercel) it falls back to memory.

interface CaseRecord {
  salt: string; // random 32 bytes; caseHash = keccak256(salt ‖ record). Never on-chain.
  caseHash: string;
  memo: string; // document attached to the bill (data for Tulong, never instructions)
  openedAt: number;
  code: string; // student case code, e.g. TGL-K7Q-4M2. Off-chain only.
}

interface StoreShape {
  vault?: string; // the vault these rows belong to; a redeploy archives the old file and starts clean
  cases: Record<string, CaseRecord>;
  drafts: Record<string, { plan: Plan; provider: string }>; // latest validated Tulong draft per caseId
  plans: Record<string, Plan>; // planHash -> plan JSON
  codes: Record<string, string>; // student case code -> caseId
  // Contract events copied from the receipts of transactions the app sent. Lets the app work on
  // public RPCs that refuse eth_getLogs. Each row is decoded from the chain, never typed by a user.
  openedTx: Record<string, { tx: string; block: string }>; // caseId -> openCase tx
  paid: Record<string, PaymentRow>; // "tx:logIndex" -> Paid event
  refused: Record<string, RefusalRow>; // tx -> reverted approveAndPay (decoded from the tx and a replay)
}

const FILE = path.join(process.cwd(), ".data", "store.json");
// One copy per server process, shared by every route bundle
const g = globalThis as unknown as { __tanglawStore?: StoreShape };

const hasRows = (s: StoreShape) =>
  [s.cases, s.drafts, s.plans, s.codes, s.openedTx, s.paid, s.refused].some((x) => x && Object.keys(x).length > 0);

function load(): StoreShape {
  let s = g.__tanglawStore;
  if (!s) {
    try {
      s = JSON.parse(fs.readFileSync(FILE, "utf8")) as StoreShape;
    } catch {
      s = {} as StoreShape;
    }
    // Rows from another vault (e.g. before a redeploy) would mix old cases and payments into
    // this vault's record. Keep them in an archive file and start clean.
    const vault = getConfig().vault?.toLowerCase();
    if (vault && s.vault !== vault) {
      if (hasRows(s)) {
        try {
          const tag = s.vault ? s.vault.slice(0, 10) : "untagged";
          fs.renameSync(FILE, path.join(path.dirname(FILE), `store.${tag}.${Date.now()}.json`));
        } catch {
          // nothing on disk to move
        }
        s = {} as StoreShape;
      }
      s.vault = vault;
      g.__tanglawStore = s;
      save();
    }
    g.__tanglawStore = s;
  }
  // Fill sections added in later versions (also for a copy kept in memory across a hot reload)
  s.cases ??= {};
  s.drafts ??= {};
  s.plans ??= {};
  s.codes ??= {};
  s.openedTx ??= {};
  s.paid ??= {};
  s.refused ??= {};
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
  caseIds: () => Object.entries(load().cases).sort((a, b) => a[1].openedAt - b[1].openedAt).map(([id]) => id),
  getOpenedTx: (caseId: string) => load().openedTx[key(caseId)],
  putOpenedTx(caseId: string, tx: string, block: string) {
    load().openedTx[key(caseId)] = { tx, block };
    save();
  },
  allPaid: () => Object.values(load().paid),
  putPaid(id: string, row: PaymentRow) {
    load().paid[id] = row;
    save();
  },
  allRefused: () => Object.values(load().refused),
  /** true once a refusal is saved with a known error name ("Reverted" means: try again) */
  hasRefused: (tx: string) => {
    const r = load().refused[tx.toLowerCase()];
    return !!r && r.err !== "Reverted";
  },
  putRefused(row: RefusalRow) {
    load().refused[row.tx.toLowerCase()] = row;
    save();
  },
  getPlan: (hash: string) => load().plans[hash.toLowerCase()],
  putPlan(hash: string, plan: Plan) {
    load().plans[hash.toLowerCase()] = plan;
    save();
  },
};
