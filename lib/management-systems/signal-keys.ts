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
] as const;

export type SignalKey = (typeof SIGNAL_KEYS)[number];
