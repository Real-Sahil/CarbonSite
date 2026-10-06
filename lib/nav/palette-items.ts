// Destinations the command palette offers. Each path is a real page (a test
// checks), and a role only sees the ones it may open: the same lists the
// sidebar uses for its groups, so the palette never offers a page the sidebar
// would hide.

export type PaletteItem = { label: string; path: string; keywords?: string; roles?: readonly string[] };

const CORE = ["admin", "editor", "reviewer", "viewer", "auditor"];
const EXTENDED = [...CORE, "sustainability_director", "sustainability_manager", "operations_manager", "contract_manager"];

export const PALETTE_ITEMS: readonly PaletteItem[] = [
  { label: "Dashboard", path: "dashboard", keywords: "home overview footprint" },
  { label: "Records", path: "records", keywords: "activity data bills", roles: CORE },
  { label: "Imports", path: "imports", keywords: "upload csv excel", roles: CORE },
  { label: "Monthly checklist", path: "checklist", keywords: "missing todo what to add data complete month", roles: ["admin", "editor", "sustainability_director", "sustainability_manager"] },
  { label: "Submissions", path: "submissions", keywords: "field review queue", roles: ["admin", "editor", "reviewer"] },
  { label: "Site map", path: "map", keywords: "sites locations scrubber published snapshots", roles: CORE },
  { label: "Suppliers", path: "suppliers", keywords: "supplier health", roles: CORE },
  { label: "Commuting", path: "commuting", keywords: "employee travel survey", roles: CORE },
  { label: "Tasks", path: "tasks" },
  { label: "Fuel", path: "fuel", keywords: "bowser tank diesel hvo deliveries issues dips machines litres plant", roles: CORE },
  { label: "Calculations", path: "calculations", keywords: "runs factors", roles: CORE },
  { label: "Analytics", path: "analytics", keywords: "charts", roles: CORE },
  { label: "Trace a figure", path: "lineage", keywords: "lineage source evidence", roles: CORE },
  { label: "Report summary", path: "reports/narrative", keywords: "narrative executive summary wording write", roles: ["admin", "editor", "reviewer", "sustainability_director", "sustainability_manager"] },
  { label: "Reports", path: "reports", keywords: "pdf publish snapshot", roles: CORE },
  { label: "Targets", path: "targets", keywords: "reduction initiatives", roles: EXTENDED },
  { label: "Pathway", path: "pathway", keywords: "net zero 1.5", roles: EXTENDED },
  { label: "Transition plan", path: "transition-plan", keywords: "esrs e1", roles: EXTENDED },
  { label: "Base year", path: "base-year", roles: EXTENDED },
  { label: "Contracts", path: "contracts", keywords: "projects sites", roles: EXTENDED },
  { label: "Tenders", path: "tenders", keywords: "find a tender bid", roles: EXTENDED },
  { label: "Compliance", path: "compliance", keywords: "esrs csrd deadlines", roles: EXTENDED },
  { label: "Management systems", path: "management-systems", keywords: "iso 14001 9001 45001 audit", roles: EXTENDED },
  { label: "Audit trail", path: "audit", keywords: "log", roles: ["admin", "auditor"] },
  { label: "Settings", path: "settings", keywords: "organisation members billing", roles: ["admin"] },
];

/** Items a role may open, matched against a typed query (every word must appear in the label or keywords). */
export function paletteMatches(items: readonly PaletteItem[], role: string, query: string): PaletteItem[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return items
    .filter((i) => !i.roles || i.roles.includes(role))
    .filter((i) => words.every((w) => `${i.label} ${i.keywords ?? ""}`.toLowerCase().includes(w)));
}
