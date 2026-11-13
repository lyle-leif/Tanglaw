import { parseAbi } from "viem";
import { bscTestnet } from "viem/chains";
import { peso } from "./peso";
import { programById } from "./rules";

export const CHAIN = bscTestnet; // chain 97 only

// Backup public RPC, used when the main one (from .env, or viem's default) fails or times out.
export const FALLBACK_RPC = "https://bsc-testnet-rpc.publicnode.com";
export const EXPLORER = "https://testnet.bscscan.com";

export const VAULT_ABI = parseAbi([
  "function openCase(bytes32 caseId, bytes32 caseHash, address hospital, uint256 bill)",
  "function approveAndPay(bytes32 caseId, uint8[] programIds, uint256[] amounts, bytes32 planHash)",
  "function socialWorker() view returns (address)",
  "function paused() view returns (bool)",
  "function isHospital(address) view returns (bool)",
  "function programs(uint8) view returns (string name, uint256 perCaseCap, uint256 budgetLeft, bool active)",
  "function cases(bytes32) view returns (bytes32 caseHash, address hospital, uint256 bill, uint256 covered, bool exists)",
  "function paidByProgram(bytes32, uint8) view returns (uint256)",
  "function remaining(bytes32 caseId) view returns (uint256)",
  "function programRoom(bytes32 caseId, uint8 id) view returns (uint256)",
  "error NotSocialWorker()",
  "error OverProgramCap()",
  "error OverBudget()",
  "error OverBill()",
  "error UnknownHospital()",
  "error CaseNotFound()",
  "error Paused()",
  "error InactiveProgram()",
  "error ZeroAmount()",
  "error BadArrays()",
  "error CaseExists()",
  "error TransferFailed()",
  "event CaseOpened(bytes32 indexed caseId, address indexed hospital, uint256 bill)",
  "event PlanApproved(bytes32 indexed caseId, bytes32 planHash)",
  "event Paid(bytes32 indexed caseId, uint8 indexed programId, address indexed hospital, uint256 amount, bytes32 planHash)",
  "event HospitalSet(address indexed hospital, bool ok)",
  "event SocialWorkerSet(address indexed socialWorker)",
]);

// approveAndPay is sent with a fixed gas limit so MetaMask doesn't stop a transaction that
// will revert at gas estimation. The refusal then shows on-chain (MIGRATION.md §10).
export const APPROVE_GAS = 400_000n;

export const txUrl = (h: string) => `${EXPLORER}/tx/${h}`;
export const addrUrl = (a: string) => `${EXPLORER}/address/${a}`;

// ---------- shared data shapes (server -> client JSON; amounts in pesos) ----------

export interface ProgramState {
  id: number;
  name: string;
  capPhp: number;
  budgetLeftPhp: number;
  active: boolean;
}

export interface CaseState {
  caseId: `0x${string}`;
  label: string; // "Case A", "Case B", ... by opening order
  hospital: `0x${string}`;
  billPhp: number;
  coveredPhp: number;
  remainingPhp: number;
  paidByProgram: Record<number, number>;
  hasMemo: boolean;
  openedTx: string;
}

export interface PaymentRow {
  caseId: `0x${string}`;
  programId: number;
  amountPhp: number;
  planHash: string;
  tx: string;
  block: string;
  time: number | null; // unix seconds
}

export interface ChainSnapshot {
  configured: boolean;
  vault: `0x${string}` | null;
  socialWorker: `0x${string}` | null;
  hospital: `0x${string}` | null;
  hospitalLabel: string;
  paused: boolean;
  programs: ProgramState[];
  cases: CaseState[];
  payments: PaymentRow[];
  refusals: RefusalRow[];
  error?: string;
}

/** An approveAndPay that reached the chain and was reverted by the contract's rules. */
export interface RefusalRow {
  caseId: `0x${string}`;
  lines: { programId: number; amountPhp: number }[];
  err: string; // contract error name, e.g. OverProgramCap
  tx: string;
  block: string;
  time: number | null;
}

/** Short public wording for a refusal (activity page). No amounts the reader can't check on BscScan. */
export function refusalReason(err: string, program?: string): string {
  const p = program ?? "a program";
  switch (err) {
    case "OverProgramCap":
      return `Over ${p}'s per-case cap`;
    case "OverBudget":
      return `${p} has no budget left for this`;
    case "OverBill":
      return "More than the hospital bill";
    case "InactiveProgram":
      return `${p} isn't active`;
    case "ZeroAmount":
      return "A line had no amount";
    case "Paused":
      return "Payments were paused";
    case "NotSocialWorker":
      return "Not signed by the social worker";
    case "CaseNotFound":
      return "Case not open";
    default:
      return "Refused by the contract";
  }
}

// ---------- contract error -> plain words (staff screen only; Ana never sees refusals) ----------

export type LineLike = { programId: number; amountPhp: number };

export interface SimResult {
  ok: boolean;
  err?: string;
  line?: LineLike;
  room?: number;
}

/** Same check order as TanglawVault.approveAndPay, run on chain values, to say which line fails. */
export function simulatePlan(c: CaseState, programs: ProgramState[], lines: LineLike[], paused: boolean): SimResult {
  if (paused) return { ok: false, err: "Paused" };
  if (!lines.length) return { ok: false, err: "BadArrays" };
  let covered = c.coveredPhp;
  const paid: Record<number, number> = { ...c.paidByProgram };
  const budget: Record<number, number> = Object.fromEntries(programs.map((p) => [p.id, p.budgetLeftPhp]));
  for (const l of lines) {
    const p = programs.find((x) => x.id === l.programId);
    const a = l.amountPhp;
    if (!p || !p.active) return { ok: false, err: "InactiveProgram", line: l };
    if (!(a > 0)) return { ok: false, err: "ZeroAmount", line: l };
    const paidSoFar = paid[l.programId] ?? 0;
    if (paidSoFar + a > p.capPhp) return { ok: false, err: "OverProgramCap", line: l, room: p.capPhp - paidSoFar };
    if (a > budget[l.programId]) return { ok: false, err: "OverBudget", line: l, room: budget[l.programId] };
    if (covered + a > c.billPhp) return { ok: false, err: "OverBill", line: l, room: c.billPhp - covered };
    paid[l.programId] = paidSoFar + a;
    budget[l.programId] -= a;
    covered += a;
  }
  return { ok: true };
}

export function roomFor(c: CaseState, programs: ProgramState[], programId: number): number {
  const p = programs.find((x) => x.id === programId);
  if (!p) return 0;
  const capLeft = Math.max(0, p.capPhp - (c.paidByProgram[programId] ?? 0));
  return Math.min(capLeft, p.budgetLeftPhp);
}

export function errorMessage(err: string, sim?: SimResult): string {
  const name = sim?.line ? programById(sim.line.programId)?.name ?? "This program" : "This program";
  switch (err) {
    case "NotSocialWorker":
      return "Only the registered social worker wallet can do this. Switch to the Approver account.";
    case "OverProgramCap":
      return sim?.line
        ? `${name} can pay at most ${peso(sim.room ?? 0)} more for this case. This line asked for ${peso(sim.line.amountPhp)}.`
        : "A line is above its program's per-case cap.";
    case "OverBudget":
      return sim?.line ? `${name} has only ${peso(sim.room ?? 0)} budget left.` : "A program has run out of budget.";
    case "OverBill":
      return sim ? `This would pay more than the bill. Only ${peso(sim.room ?? 0)} is left.` : "This would pay more than the bill.";
    case "UnknownHospital":
      return "This hospital isn't on the approved list. Ask the admin to add it.";
    case "CaseNotFound":
      return "This case isn't open on-chain yet. Open the case first.";
    case "Paused":
      return "Payments are paused by the admin. Try again later.";
    case "InactiveProgram":
      return `${name} isn't active right now. Remove that line.`;
    case "ZeroAmount":
      return "Every line needs an amount above ₱0.";
    case "BadArrays":
      return "The plan is malformed (lines don't match). Draft it again.";
    case "CaseExists":
      return "A case with this ID is already open.";
    case "TransferFailed":
      return "The vault couldn't send the payment. Check the vault has enough testnet funds.";
    default:
      return "The contract refused this transaction.";
  }
}
