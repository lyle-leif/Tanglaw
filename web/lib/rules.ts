// Fixed rules table. Tulong explains these rules, it never invents them.
// Simulated demo settings, not real 2026 agency limits. The contract holds the
// caps that actually matter; these numbers must match contracts/script/Deploy.s.sol.

export type ProgramKey = "ched-tes" | "city-scholarship" | "alumni-grant";

export interface ProgramRule {
  id: number; // on-chain program id
  key: ProgramKey;
  name: string; // name Tulong uses; code maps it to the id
  short: string;
  capPhp: number; // per student, per term
  budgetPhp: number;
  forAna: string; // one-line explanation for the student (English UI; Tulong translates in chat)
  docs: DocKey[];
}

export type DocKey = "school-id" | "cor" | "soa" | "grades" | "indigency";

export const DOCS: Record<DocKey, string> = {
  "school-id": "School ID or any valid ID of the student",
  cor: "Certificate of Registration (COR) for this term",
  soa: "Statement of account / tuition assessment from the cashier",
  grades: "Latest grades (copy of the report or portal printout)",
  indigency: "Barangay certificate of indigency or parents' latest ITR",
};

// Priority order: CHED TES -> City Scholarship -> Alumni Grant (rules.priority-order)
export const PROGRAMS: ProgramRule[] = [
  {
    id: 0,
    key: "ched-tes",
    name: "CHED TES",
    short: "TES",
    capPhp: 20_000,
    budgetPhp: 500_000,
    forAna: "The national Tertiary Education Subsidy is applied to your assessment first.",
    docs: ["school-id", "cor", "soa", "indigency"],
  },
  {
    id: 1,
    key: "city-scholarship",
    name: "City Scholarship",
    short: "City",
    capPhp: 10_000,
    budgetPhp: 500_000,
    forAna: "Your city's scholarship covers part of what TES does not.",
    docs: ["school-id", "cor", "soa", "grades"],
  },
  {
    id: 2,
    key: "alumni-grant",
    name: "Alumni Grant",
    short: "Alumni",
    capPhp: 15_000,
    budgetPhp: 500_000,
    forAna: "The alumni fund covers any balance left after the first two.",
    docs: ["school-id", "soa", "grades"],
  },
];

// Every rule a plan line may cite. A plan citing anything else is rejected.
export const SOURCES: Record<string, string> = {
  "rules.priority-order":
    "Fill programs in this order: CHED TES, then City Scholarship, then Alumni Grant, each up to its room, until the balance is 0.",
  "rules.ched-tes.case-cap": "CHED TES pays up to PHP 20,000 per student per term (simulated demo rule).",
  "rules.city-scholarship.case-cap": "City Scholarship pays up to PHP 10,000 per student per term (simulated demo rule).",
  "rules.alumni-grant.case-cap": "Alumni Grant pays up to PHP 15,000 per student per term (simulated demo rule).",
  "rules.total.not-over-assessment":
    "All programs together can never pay more than the student's assessment, so stacked grants cannot double-fund.",
  "rules.payee.school-only": "Payments go only to the case's allowlisted school cashier, never to a typed-in address.",
  "rules.approval.officer": "Only the scholarship officer can approve and sign a payment.",
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
      explanationForStudent: p.forAna,
      documents: p.docs.map((d) => DOCS[d]),
      capSource: `rules.${p.key}.case-cap`,
    })),
    consolidatedChecklist: consolidatedChecklist(),
    sources: SOURCES,
  };
}
