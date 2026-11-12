import "server-only";
import { createPublicClient, http, type Log, type PublicClient } from "viem";
import { CHAIN, VAULT_ABI, type CaseState, type ChainSnapshot, type PaymentRow, type ProgramState } from "../chain";
import { weiToPeso } from "../peso";
import { PROGRAMS } from "../rules";
import { getConfig } from "./config";
import { store } from "./store";

// Reads the vault's events (incrementally, in block chunks) and its current state.
// Everything shown in the app comes from the chain; nothing here can write to it.

const EVENTS = VAULT_ABI.filter(
  (x) => x.type === "event" && ["CaseOpened", "Paid", "HospitalSet", "SocialWorkerSet"].includes(x.name),
);
const LOOKBACK_IF_UNKNOWN = 50_000n; // used only if the deploy block is unknown

interface IndexState {
  vault: string;
  next: bigint; // next block to scan
  opened: { caseId: `0x${string}`; hospital: `0x${string}`; tx: string }[];
  paid: PaymentRow[];
  hospitals: Map<string, boolean>;
  blockTimes: Map<string, number>;
}

let client: PublicClient | null = null;
// Index shared by every route bundle in this server process
const g = globalThis as unknown as { __tanglawIdx?: IndexState | null; __tanglawScan?: Promise<void> | null };
let idx: IndexState | null = g.__tanglawIdx ?? null;

function getClient(rpc: string) {
  if (!client) client = createPublicClient({ chain: CHAIN, transport: http(rpc, { retryCount: 2 }) }) as PublicClient;
  return client;
}

async function scan(c: PublicClient, s: IndexState) {
  const latest = await c.getBlockNumber();
  let chunk = 5_000n;
  while (s.next <= latest) {
    const to = s.next + chunk - 1n > latest ? latest : s.next + chunk - 1n;
    let logs: Log[];
    try {
      logs = await c.getLogs({ address: s.vault as `0x${string}`, events: EVENTS, fromBlock: s.next, toBlock: to });
    } catch (e) {
      if (chunk > 200n) {
        chunk /= 2n; // the public RPC limits the range; retry smaller
        continue;
      }
      throw e;
    }
    for (const raw of logs) {
      const log = raw as Log & { eventName: string; args: Record<string, unknown> };
      const tx = log.transactionHash ?? "";
      if (log.eventName === "CaseOpened") {
        s.opened.push({ caseId: log.args.caseId as `0x${string}`, hospital: log.args.hospital as `0x${string}`, tx });
      } else if (log.eventName === "Paid") {
        s.paid.push({
          caseId: log.args.caseId as `0x${string}`,
          programId: Number(log.args.programId),
          amountPhp: weiToPeso(log.args.amount as bigint),
          planHash: log.args.planHash as string,
          tx,
          block: String(log.blockNumber),
          time: null,
        });
      } else if (log.eventName === "HospitalSet") {
        s.hospitals.set((log.args.hospital as string).toLowerCase(), Boolean(log.args.ok));
      }
    }
    s.next = to + 1n;
  }
  // Block times for receipts (few rows, cached)
  for (const p of s.paid) {
    if (p.time !== null) continue;
    let t = s.blockTimes.get(p.block);
    if (t === undefined) {
      const b = await c.getBlock({ blockNumber: BigInt(p.block) });
      t = Number(b.timestamp);
      s.blockTimes.set(p.block, t);
    }
    p.time = t;
  }
}

export async function snapshot(): Promise<ChainSnapshot> {
  const cfg = getConfig();
  const empty: ChainSnapshot = {
    configured: false,
    vault: cfg.vault,
    socialWorker: null,
    hospital: null,
    hospitalLabel: cfg.hospitalLabel,
    paused: false,
    programs: PROGRAMS.map((p) => ({ id: p.id, name: p.name, capPhp: p.capPhp, budgetLeftPhp: p.budgetPhp, active: true })),
    cases: [],
    payments: [],
  };
  if (!cfg.vault) return { ...empty, error: "No vault address yet. Deploy the contract, then restart the app." };

  const c = getClient(cfg.rpc);
  try {
    idx = g.__tanglawIdx ?? null;
    if (!idx || idx.vault !== cfg.vault) {
      const start = cfg.deployBlock ?? (await c.getBlockNumber()) - LOOKBACK_IF_UNKNOWN;
      idx = { vault: cfg.vault, next: start, opened: [], paid: [], hospitals: new Map(), blockTimes: new Map() };
      g.__tanglawIdx = idx;
    }
    const s = idx;
    // one scan at a time across all route bundles, so logs are never added twice
    if (!g.__tanglawScan) g.__tanglawScan = scan(c, s).finally(() => (g.__tanglawScan = null));
    await g.__tanglawScan;

    const v = cfg.vault;
    const read = <T>(functionName: string, args: readonly unknown[] = []) =>
      c.readContract({ address: v, abi: VAULT_ABI, functionName, args } as never) as Promise<T>;

    const [sw, paused, progRaw] = await Promise.all([
      read<`0x${string}`>("socialWorker"),
      read<boolean>("paused"),
      Promise.all(PROGRAMS.map((p) => read<readonly [string, bigint, bigint, boolean]>("programs", [p.id]))),
    ]);
    const programs: ProgramState[] = progRaw.map((r, i) => ({
      id: PROGRAMS[i].id,
      name: r[0] || PROGRAMS[i].name,
      capPhp: weiToPeso(r[1]),
      budgetLeftPhp: weiToPeso(r[2]),
      active: r[3],
    }));

    const cases: CaseState[] = await Promise.all(
      s.opened.map(async (o, i) => {
        const [cs, ...paid] = await Promise.all([
          read<readonly [string, `0x${string}`, bigint, bigint, boolean]>("cases", [o.caseId]),
          ...PROGRAMS.map((p) => read<bigint>("paidByProgram", [o.caseId, p.id])),
        ]);
        const bill = weiToPeso(cs[2]);
        const covered = weiToPeso(cs[3]);
        return {
          caseId: o.caseId,
          label: "Case " + (i < 26 ? String.fromCharCode(65 + i) : i + 1),
          hospital: cs[1],
          billPhp: bill,
          coveredPhp: covered,
          remainingPhp: bill - covered,
          paidByProgram: Object.fromEntries(PROGRAMS.map((p, j) => [p.id, weiToPeso(paid[j])])),
          hasMemo: Boolean(store.getCase(o.caseId)?.memo),
          openedTx: o.tx,
        };
      }),
    );

    const hospital =
      ([...s.hospitals.entries()].filter(([, ok]) => ok).map(([a]) => a).pop() as `0x${string}` | undefined) ??
      ((process.env.HOSPITAL_ADDRESS as `0x${string}` | undefined) || null);

    return {
      configured: true,
      vault: v,
      socialWorker: sw,
      hospital,
      hospitalLabel: cfg.hospitalLabel,
      paused,
      programs,
      cases,
      payments: [...s.paid].reverse(), // newest first
    };
  } catch (e) {
    return { ...empty, vault: cfg.vault, error: "Couldn't read BSC testnet: " + (e as Error).message.split("\n")[0] };
  }
}

export async function getCaseState(caseId: string): Promise<{ snap: ChainSnapshot; c: CaseState | undefined }> {
  const snap = await snapshot();
  return { snap, c: snap.cases.find((x) => x.caseId.toLowerCase() === caseId.toLowerCase()) };
}
