// Fixed rules table. Tulong explains these rules, it never invents them.
// Simulated demo settings, not real 2026 agency limits. The contract holds the
// caps that actually matter; these numbers must match contracts/script/Deploy.s.sol.

export type ProgramKey = "philhealth" | "doh-maifip" | "pcso-imap";

export interface ProgramRule {
  id: number; // on-chain program id
  key: ProgramKey;
  name: string; // name Tulong uses; code maps it to the id
  short: string;
  capPhp: number;
  budgetPhp: number;
  forAna: string; // one-line explanation for the family (English UI; Tulong translates in chat)
  docs: DocKey[];
}

export type DocKey = "valid-id" | "philhealth-id" | "soa" | "abstract" | "indigency";

export const DOCS: Record<DocKey, string> = {
  "valid-id": "Valid ID of the patient and of the family member",
  "philhealth-id": "PhilHealth ID or Member Data Record",
  soa: "Statement of account from billing",
  abstract: "Medical abstract or clinical summary",
  indigency: "Barangay certificate of indigency",
};

// Priority order: PhilHealth -> DOH MAIFIP -> PCSO (rules.priority-order)
export const PROGRAMS: ProgramRule[] = [
  {
    id: 0,
    key: "philhealth",
    name: "PhilHealth",
    short: "PhilHealth",
    capPhp: 25_000,
    budgetPhp: 500_000,
    forAna: "PhilHealth benefits are deducted from the bill first.",
    docs: ["valid-id", "philhealth-id", "soa"],
  },
  {
    id: 1,
    key: "doh-maifip",
    name: "DOH MAIFIP",
    short: "DOH MAIFIP",
    capPhp: 60_000,
    budgetPhp: 500_000,
    forAna: "DOH help for patients who can't afford the bill.",
    docs: ["valid-id", "soa", "abstract", "indigency"],
  },
  {
    id: 2,
    key: "pcso-imap",
    name: "PCSO IMAP",
    short: "PCSO",
    capPhp: 20_000,
    budgetPhp: 500_000,
    forAna: "For any balance left after the first two.",
    docs: ["valid-id", "soa", "abstract", "indigency"],
  },
];

// Every rule a plan line may cite. A plan citing anything else is rejected.
export const SOURCES: Record<string, string> = {
  "rules.priority-order":
    "Fill programs in this order: PhilHealth, then DOH MAIFIP, then PCSO IMAP, each up to its room, until the balance is 0.",
  "rules.philhealth.case-cap": "PhilHealth pays up to PHP 25,000 per case (simulated demo rule).",
  "rules.doh-maifip.case-cap": "DOH MAIFIP pays up to PHP 60,000 per case (simulated demo rule).",
  "rules.pcso-imap.case-cap": "PCSO IMAP pays up to PHP 20,000 per case (simulated demo rule).",
  "rules.payee.hospital-only": "Payments go only to the case's allowlisted hospital, never to a typed-in address.",
  "rules.approval.social-worker": "Only the hospital social worker can approve and sign a payment.",
};

export function programByName(name: string): ProgramRule | undefined {
  const n = name.trim().toLowerCase();
  return PROGRAMS.find((p) => p.name.toLowerCase() === n || p.short.toLowerCase() === n || p.key === n);
}

export function programById(id: number): ProgramRule | undefined {
  return PROGRAMS.find((p) => p.id === id);
}

/** One consolidated checklist across the given programs, no duplicates, in a stable order. */
export function consolidatedChecklist(programs: ProgramRule[] = PROGRAMS): string[] {
  const keys = new Set<DocKey>();
  for (const p of programs) for (const d of p.docs) keys.add(d);
  return (Object.keys(DOCS) as DocKey[]).filter((k) => keys.has(k)).map((k) => DOCS[k]);
}

/** What lookup_programs returns to Tulong. */
export function rulesForModel() {
  return {
    note: "Simulated demo rules, not real agency limits. Quote the source key when you explain a rule.",
    priorityOrder: PROGRAMS.map((p) => p.name),
    programs: PROGRAMS.map((p) => ({
      name: p.name,
      perCaseCapPhp: p.capPhp,
      explanationForFamily: p.forAna,
      documents: p.docs.map((d) => DOCS[d]),
      capSource: `rules.${p.key}.case-cap`,
    })),
    consolidatedChecklist: consolidatedChecklist(),
    sources: SOURCES,
  };
}
