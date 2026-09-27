// Keys a catalogue requirement can name to show live figures from the
// organisation's own records beside it (lib/management-systems/signals.ts).
// Kept apart from the loaders so catalogue files and client components can
// import the list without pulling in Prisma.

export const SIGNAL_KEYS = [
  "legal_register",
  "environmental_aspects",
  "environmental_permits",
  "environmental_incidents",
  "hs_incidents",
  "method_statements",
  "reduction_targets",
  "emissions_monitoring",
  "waste_water_monitoring",
  "suppliers",
  "evidence_files",
  "members",
  "audit_log",
  "ms_policies",
  "ms_documents",
  "ms_training",
  "ms_risks",
  "ms_objectives",
  "ms_changes",
  "ms_audits",
  "ms_management_reviews",
  "ms_corrective_actions",
  "ms_complaints",
  "ms_equipment",
  "ms_supplier_evaluations",
  "ms_inspections",
] as const;

export type SignalKey = (typeof SIGNAL_KEYS)[number];

/**
 * Register figures shown beside the clauses every ISO standard shares, by
 * shared key (a clause under a shared heading takes its heading's key), so
 * catalogue files need not list them one by one.
 */
export const SHARED_SIGNALS: Record<string, SignalKey[]> = {
  "hls:5.2": ["ms_policies"],
  "hls:6.1": ["ms_risks"],
  "hls:6.2": ["ms_objectives"],
  "hls:7.1": ["ms_equipment"],
  "hls:7.2": ["ms_training"],
  "hls:7.3": ["ms_policies"],
  "hls:7.5": ["ms_documents"],
  "hls:8.1": ["ms_inspections", "ms_supplier_evaluations"],
  "hls:9.1": ["ms_inspections", "ms_complaints"],
  "hls:9.2": ["ms_audits"],
  "hls:9.3": ["ms_management_reviews"],
  "hls:10.2": ["ms_corrective_actions", "ms_complaints"],
};

/** Signals for a clause by its code alone, where the clause has no shared key (planning of changes, 6.3). */
export const CODE_SIGNALS: Record<string, SignalKey[]> = { "6.3": ["ms_changes"] };
