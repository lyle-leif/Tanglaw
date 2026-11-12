import { keccak256, toBytes } from "viem";
import { programByName, SOURCES } from "./rules";
import { roomFor, type CaseState, type ProgramState } from "./chain";

export interface PlanLine {
  program: string;
  amountPhp: number;
  reason: string;
  source: string;
}

export interface Plan {
  caseId: string;
  lines: PlanLine[];
  totalPhp: number;
  warnings: string[];
  edited?: boolean; // true once the social worker changes an amount
}

/** JSON with sorted keys, so the same plan always gives the same hash. */
export function canonicalJson(v: unknown): string {
  if (Array.isArray(v)) return "[" + v.map(canonicalJson).join(",") + "]";
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return (
      "{" +
      Object.keys(o)
        .filter((k) => o[k] !== undefined)
        .sort()
        .map((k) => JSON.stringify(k) + ":" + canonicalJson(o[k]))
        .join(",") +
      "}"
    );
  }
  return JSON.stringify(v);
}

/** planHash = keccak256(canonical JSON of the plan). Stored on-chain with every payment. */
export function planHash(plan: Plan): `0x${string}` {
  return keccak256(toBytes(canonicalJson(plan)));
}

export function planTotal(lines: { amountPhp: number }[]): number {
  return lines.reduce((a, l) => a + (Number(l.amountPhp) || 0), 0);
}

// No names, diagnoses or medical details anywhere in the plan (MIGRATION.md §5 decision 6).
// The demo stores no patient name, so this is a denylist of the demo story's names and
// common diagnosis words, plus "no wallet addresses in the reasons".
const PERSONAL = [
  "rosa", "lola", "ana", "mama", "nanay",
  "cancer", "stroke", "dengue", "pneumonia", "diabetes", "tuberculosis", "tb", "kidney",
  "dialysis", "leukemia", "hypertension", "heart attack", "covid", "fracture", "sepsis",
];

export function containsPersonalData(text: string): string | null {
  for (const w of PERSONAL) if (new RegExp(`\\b${w}\\b`, "i").test(text)) return w;
  if (/\bdiagnos/i.test(text)) return "diagnosis";
  return null;
}

/**
 * Validates Tulong's draft in code before anyone sees it (Workshop 2 rule).
 * Applies only to the AI draft. Staff edits are warned about, never blocked (§6).
 */
export function validateDraft(plan: Plan, c: CaseState, programs: ProgramState[]): string[] {
  const errs: string[] = [];
  if (!plan || !Array.isArray(plan.lines) || plan.lines.length === 0) return ["The plan has no lines."];
  if (plan.caseId.toLowerCase() !== c.caseId.toLowerCase()) errs.push("The plan is for a different case.");
  const seen = new Set<string>();
  for (const l of plan.lines) {
    const p = programByName(l.program);
    if (!p) {
      errs.push(`Unknown program "${l.program}".`);
      continue;
    }
    if (seen.has(p.key)) errs.push(`${p.name} appears twice.`);
    seen.add(p.key);
    if (!Number.isInteger(l.amountPhp) || l.amountPhp <= 0) errs.push(`${p.name}: amount must be a whole number above 0.`);
    const room = roomFor(c, programs, p.id);
    if (l.amountPhp > room) errs.push(`${p.name}: ${l.amountPhp} is above its room of ${room}.`);
    if (!(l.source in SOURCES)) errs.push(`${p.name}: unknown rule source "${l.source}".`);
    if (/0x[0-9a-fA-F]{6,}/.test(l.reason)) errs.push(`${p.name}: the reason contains an address.`);
    const pd = containsPersonalData(l.reason);
    if (pd) errs.push(`${p.name}: the reason contains personal or medical details ("${pd}").`);
  }
  const total = planTotal(plan.lines);
  if (total !== plan.totalPhp) errs.push(`totalPhp ${plan.totalPhp} doesn't match the lines (${total}).`);
  if (total > c.remainingPhp) errs.push(`Total ${total} is above the remaining balance of ${c.remainingPhp}.`);
  for (const w of plan.warnings ?? []) {
    const pd = containsPersonalData(w);
    if (pd) errs.push(`A warning contains personal or medical details ("${pd}").`);
  }
  return errs;
}
