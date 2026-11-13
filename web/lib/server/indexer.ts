import "server-only";
import {
  BaseError,
  ContractFunctionRevertedError,
  createPublicClient,
  fallback,
  decodeFunctionData,
  http,
  parseEventLogs,
  type Log,
  type PublicClient,
} from "viem";
import {
  CHAIN,
  FALLBACK_RPC,
  VAULT_ABI,
  type CaseState,
  type ChainSnapshot,
  type PaymentRow,
  type ProgramState,
  type RefusalRow,
} from "../chain";
import { weiToPeso } from "../peso";
import { PROGRAMS } from "../rules";
import { getConfig } from "./config";
import { store } from "./store";

// Reads the vault's state and events. Nothing here can write to the chain.
//
// Events come from two places, merged:
// 1. Receipts of the transactions the app sent (recordTx). Works on every RPC.
// 2. An eth_getLogs scan, when the RPC allows it. The free BSC testnet RPCs refuse it
//    ("limit exceeded"), so a refusal switches the scan off for a while instead of failing the page.
// Case IDs also come from the off-chain store, and every number shown (bill, covered, remaining,
// budgets) is read live from the contract.

const EVENTS = VAULT_ABI.filter(
  (x) => x.type === "event" && ["CaseOpened", "Paid", "SchoolSet", "OfficerSet"].includes(x.name),
);
const LOOKBACK_IF_UNKNOWN = 50_000n; // used only if the deploy block is unknown
const LOGS_RETRY_MS = 10 * 60_000;

interface IndexState {
  vault: string;
  next: bigint; // next block to scan
  opened: { caseId: `0x${string}`; tx: string; block: bigint }[];
  paid: (PaymentRow & { key: string })[];
  schools: Map<string, boolean>;
  logsOffUntil: number;
}

let client: PublicClient | null = null;
// Shared by every route bundle in this server process
const g = globalThis as unknown as {
  __tanglawIdx?: IndexState | null;
  __tanglawScan?: Promise<void> | null;
  __tanglawTimes?: Map<string, number>;
};
const blockTimes = (g.__tanglawTimes ??= new Map());

function getClient(rpc: string) {
  if (!client) client = createPublicClient({ chain: CHAIN, transport: fallback([http(rpc, { retryCount: 1, timeout: 8_000 }), http(FALLBACK_RPC, { retryCount: 1, timeout: 8_000 })]) }) as PublicClient;
  return client;
}

async function blockTime(c: PublicClient, block: string): Promise<number | null> {
  const t = blockTimes.get(block);
  if (t !== undefined) return t;
  try {
    const b = await c.getBlock({ blockNumber: BigInt(block) });
    blockTimes.set(block, Number(b.timestamp));
    return Number(b.timestamp);
  } catch {
    return null;
  }
}

async function scan(c: PublicClient, s: IndexState) {
  if (Date.now() < s.logsOffUntil) return;
  const latest = await c.getBlockNumber();
  let chunk = 5_000n;
  while (s.next <= latest) {
    const to = s.next + chunk - 1n > latest ? latest : s.next + chunk - 1n;
    let logs: Log[];
    try {
      logs = await c.getLogs({ address: s.vault as `0x${string}`, events: EVENTS, fromBlock: s.next, toBlock: to });
    } catch {
      if (chunk > 500n) {
        chunk /= 4n; // some RPCs limit the range; retry smaller
        continue;
      }
      s.logsOffUntil = Date.now() + LOGS_RETRY_MS; // this RPC refuses logs; rely on receipts
      return;
    }
    for (const raw of logs) {
      const log = raw as Log & { eventName: string; args: Record<string, unknown> };
      const tx = log.transactionHash ?? "";
      if (log.eventName === "CaseOpened") {
        s.opened.push({ caseId: log.args.caseId as `0x${string}`, tx, block: log.blockNumber ?? 0n });
      } else if (log.eventName === "Paid") {
        s.paid.push({
          key: `${tx}:${log.logIndex}`,
          caseId: log.args.caseId as `0x${string}`,
          programId: Number(log.args.programId),
          amountPhp: weiToPeso(log.args.amount as bigint),
          planHash: log.args.planHash as string,
          tx,
          block: String(log.blockNumber),
          time: null,
        });
      } else if (log.eventName === "SchoolSet") {
        s.schools.set((log.args.school as string).toLowerCase(), Boolean(log.args.ok));
      }
    }
    s.next = to + 1n;
  }
}

/**
 * Copies the vault's events from one transaction's receipt into the store. The hash comes from
 * the browser, but everything saved is decoded from the chain: a receipt that isn't a successful
 * call to this vault saves nothing.
 */
export async function recordTx(hash: `0x${string}`): Promise<{ ok: boolean; error?: string }> {
  const cfg = getConfig();
  if (!cfg.vault) return { ok: false, error: "No vault address yet." };
  const c = getClient(cfg.rpc);
  let receipt;
  try {
    receipt = await c.waitForTransactionReceipt({ hash, timeout: 30_000 });
  } catch {
    return { ok: false, error: "Couldn't get the receipt for this transaction." };
  }
  if (receipt.to?.toLowerCase() !== cfg.vault.toLowerCase()) return { ok: false, error: "Not a vault transaction." };
  if (receipt.status !== "success") {
    await recordRefusal(c, hash, receipt.blockNumber);
    return { ok: true };
  }
  const vaultLogs = receipt.logs.filter((l) => l.address.toLowerCase() === cfg.vault!.toLowerCase());
  const block = String(receipt.blockNumber);
  const time = await blockTime(c, block);
  for (const ev of parseEventLogs({ abi: VAULT_ABI, logs: vaultLogs })) {
    const e = ev as unknown as { eventName: string; args: Record<string, unknown>; logIndex: number };
    if (e.eventName === "CaseOpened") {
      store.putOpenedTx(e.args.caseId as string, hash, block);
    } else if (e.eventName === "Paid") {
      store.putPaid(`${hash}:${e.logIndex}`, {
        caseId: e.args.caseId as `0x${string}`,
        programId: Number(e.args.programId),
        amountPhp: weiToPeso(e.args.amount as bigint),
        planHash: e.args.planHash as string,
        tx: hash,
        block,
        time,
      });
    }
  }
  return { ok: true };
}

/**
 * A reverted approveAndPay leaves no event, only a failed receipt. Decode what was asked from the
 * transaction input, and get the contract's error name by replaying the same call on the state just
 * before that block. Both come from the chain.
 */
async function recordRefusal(c: PublicClient, hash: `0x${string}`, blockNumber: bigint) {
  if (store.hasRefused(hash)) return;
  const tx = await c.getTransaction({ hash });
  let decoded;
  try {
    decoded = decodeFunctionData({ abi: VAULT_ABI, data: tx.input });
  } catch {
    return;
  }
  if (decoded.functionName !== "approveAndPay") return;
  const [caseId, programIds, amounts] = decoded.args as readonly [`0x${string}`, readonly number[], readonly bigint[], `0x${string}`];
  // Replay on the state just before the block. Public nodes keep only recent state ("missing trie
  // node"), so for an older tx fall back to the current state, which gives the same answer unless
  // the case or budgets changed since.
  const replay = async (at?: bigint) => {
    try {
      await c.simulateContract({
        address: tx.to!,
        abi: VAULT_ABI,
        functionName: "approveAndPay",
        args: decoded.args as never,
        account: tx.from,
        ...(at !== undefined ? { blockNumber: at } : {}),
      });
      return null;
    } catch (e) {
      const rev = e instanceof BaseError ? e.walk((x) => x instanceof ContractFunctionRevertedError) : null;
      return (rev as ContractFunctionRevertedError | null)?.data?.errorName ?? null;
    }
  };
  const err = (await replay(blockNumber - 1n)) ?? (await replay()) ?? "Reverted";
  const block = String(blockNumber);
  store.putRefused({
    caseId,
    lines: programIds.map((id, i) => ({ programId: Number(id), amountPhp: weiToPeso(amounts[i]) })),
    err,
    tx: hash,
    block,
    time: await blockTime(c, block),
  });
}

export async function snapshot(): Promise<ChainSnapshot> {
  const cfg = getConfig();
  const empty: ChainSnapshot = {
    configured: false,
    vault: cfg.vault,
    officer: null,
    school: null,
    schoolLabel: cfg.schoolLabel,
    paused: false,
    programs: PROGRAMS.map((p) => ({ id: p.id, name: p.name, capPhp: p.capPhp, budgetLeftPhp: p.budgetPhp, active: true })),
    cases: [],
    payments: [],
    refusals: [],
  };
  if (!cfg.vault) return { ...empty, error: "No vault address yet. Deploy the contract, then restart the app." };

  const c = getClient(cfg.rpc);
  try {
    let s = g.__tanglawIdx ?? null;
    if (!s || s.vault !== cfg.vault) {
      const start = cfg.deployBlock ?? (await c.getBlockNumber()) - LOOKBACK_IF_UNKNOWN;
      s = { vault: cfg.vault, next: start, opened: [], paid: [], schools: new Map(), logsOffUntil: 0 };
      g.__tanglawIdx = s;
    }
    const st = s;
    // one scan at a time across all route bundles, so logs are never added twice
    if (!g.__tanglawScan) g.__tanglawScan = scan(c, st).catch(() => {}).finally(() => (g.__tanglawScan = null));
    await g.__tanglawScan;

    const v = cfg.vault;
    const read = <T>(functionName: string, args: readonly unknown[] = []) =>
      c.readContract({ address: v, abi: VAULT_ABI, functionName, args } as never) as Promise<T>;

    const [sw, paused, progRaw] = await Promise.all([
      read<`0x${string}`>("officer"),
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

    // Candidate cases: opened through this app (store), then any others seen in logs.
    const fromLogs = new Map(st.opened.map((o) => [o.caseId.toLowerCase(), o]));
    const ids = [...new Set([...store.caseIds(), ...[...fromLogs.keys()]])];
    const rows = await Promise.all(
      ids.map(async (id) => {
        const [cs, ...paid] = await Promise.all([
          read<readonly [string, `0x${string}`, bigint, bigint, boolean]>("cases", [id]),
          ...PROGRAMS.map((p) => read<bigint>("paidByProgram", [id, p.id])),
        ]);
        return { id, cs, paid };
      }),
    );
    // A case saved off-chain whose openCase was cancelled or failed doesn't exist on-chain: skip it.
    const cases: CaseState[] = rows
      .filter((r) => r.cs[4])
      .map((r, i) => {
        const bill = weiToPeso(r.cs[2]);
        const covered = weiToPeso(r.cs[3]);
        return {
          caseId: (fromLogs.get(r.id)?.caseId ?? r.id) as `0x${string}`,
          label: "Case " + (i < 26 ? String.fromCharCode(65 + i) : i + 1),
          school: r.cs[1],
          billPhp: bill,
          coveredPhp: covered,
          remainingPhp: bill - covered,
          paidByProgram: Object.fromEntries(PROGRAMS.map((p, j) => [p.id, weiToPeso(r.paid[j])])),
          hasMemo: Boolean(store.getCase(r.id)?.memo),
          openedTx: store.getOpenedTx(r.id)?.tx ?? fromLogs.get(r.id)?.tx ?? "",
        };
      });

    // Payments: receipts recorded by the app, plus any from logs, without duplicates.
    const byKey = new Map<string, PaymentRow>();
    for (const p of st.paid) byKey.set(`${p.tx.toLowerCase()}:${p.programId}:${p.caseId.toLowerCase()}`, p);
    for (const p of store.allPaid()) byKey.set(`${p.tx.toLowerCase()}:${p.programId}:${p.caseId.toLowerCase()}`, p);
    const payments = await Promise.all(
      [...byKey.values()].map(async ({ caseId, programId, amountPhp, planHash, tx, block, time }) => ({
        caseId,
        programId,
        amountPhp,
        planHash,
        tx,
        block,
        time: time ?? (await blockTime(c, block)),
      })),
    );
    payments.sort((a, b) => Number(BigInt(b.block) - BigInt(a.block))); // newest first

    const envSchool = process.env.SCHOOL_ADDRESS as `0x${string}` | undefined;
    const school =
      ([...st.schools.entries()].filter(([, ok]) => ok).map(([a]) => a).pop() as `0x${string}` | undefined) ??
      (envSchool && (await read<boolean>("isSchool", [envSchool])) ? envSchool : null);

    const refusals: RefusalRow[] = store
      .allRefused()
      .filter((x) => cases.some((cs) => cs.caseId.toLowerCase() === x.caseId.toLowerCase()))
      .sort((a, b) => Number(BigInt(b.block) - BigInt(a.block)));

    return {
      configured: true,
      vault: v,
      officer: sw,
      school,
      schoolLabel: cfg.schoolLabel,
      paused,
      programs,
      cases,
      payments,
      refusals,
    };
  } catch (e) {
    return { ...empty, vault: cfg.vault, error: "Couldn't read BSC testnet: " + (e as Error).message.split("\n")[0] };
  }
}

export async function getCaseState(caseId: string): Promise<{ snap: ChainSnapshot; c: CaseState | undefined }> {
  const snap = await snapshot();
  return { snap, c: snap.cases.find((x) => x.caseId.toLowerCase() === caseId.toLowerCase()) };
}
