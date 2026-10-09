// Destinations the command palette offers. Each path is a real page (a test
// checks), and a role only sees the ones it may open: the same lists the
// sidebar uses for its groups, so the palette never offers a page the sidebar
// would hide.

/**
 * `task` marks an entry phrased as something a person wants to do ("Add a bill") rather than a page
 * name. It opens the page where that is done, shows as a Task in search, and `blurb` is the one
 * line the dashboard's "What do you want to do?" card shows.
 */
export type PaletteItem = { label: string; path: string; keywords?: string; roles?: readonly string[]; task?: { blurb: string; home?: boolean } };

const CORE = ["admin", "editor", "reviewer", "viewer", "auditor"];
const EXTENDED = [...CORE, "sustainability_director", "sustainability_manager", "operations_manager", "contract_manager"];

const EDITORS = ["admin", "editor", "sustainability_director", "sustainability_manager"];
const LINKERS = [...EDITORS, "project_manager", "site_manager", "contract_manager"];

export const PALETTE_ITEMS: readonly PaletteItem[] = [
  // Things people want to do, in their own words.
  { label: "Add a bill or receipt", path: "records", keywords: "upload invoice electricity gas fuel pdf photo read", roles: EDITORS, task: { blurb: "Upload a PDF or photo. We read it and you check it.", home: true } },
  { label: "Write a site waste management plan", path: "waste/plan", keywords: "swmp site waste plan forecast target diversion project breeam", roles: LINKERS, task: { blurb: "Forecast waste, set a diversion target and track against it.", home: true } },
  { label: "Make a monthly waste pack for a client", path: "waste/pack", keywords: "project month report pdf client waste kpi loads licences", roles: EXTENDED, task: { blurb: "One project, one month: loads, KPIs and licences, ready to send.", home: true } },
  { label: "Log waste", path: "waste", keywords: "add waste record skip tipping tonnes disposal landfill recycling", roles: EXTENDED, task: { blurb: "Record what left site and where it went.", home: true } },
  { label: "Add a waste transfer note or licence", path: "waste/documents", keywords: "wtn carrier permit exemption expiry upload file", roles: LINKERS, task: { blurb: "Keep notes, licences and permits with their expiry dates.", home: true } },
  { label: "Send a subcontractor an upload link", path: "records", keywords: "invoice delivery note order no login external share link", roles: LINKERS, task: { blurb: "A link they open with no account to send you invoices.", home: true } },
  { label: "Send a contractor a waste documents link", path: "waste/documents", keywords: "carrier haulier wtn licence no login external share link", roles: LINKERS, task: { blurb: "A link for carriers to send transfer notes and licences." } },
  { label: "Log fuel", path: "fuel", keywords: "diesel delivery bowser tank dip issue machine", roles: CORE, task: { blurb: "Deliveries, issues to machines and tank levels.", home: true } },
  { label: "See what is missing this month", path: "checklist", keywords: "todo to do gaps incomplete data month", roles: EDITORS, task: { blurb: "A short list of what still needs adding.", home: true } },
  { label: "Review what site teams sent", path: "submissions", keywords: "approve reject field app photos", roles: ["admin", "editor", "reviewer"], task: { blurb: "Approve or send back what the field app sent.", home: true } },
  { label: "Compare projects on waste", path: "kpis", keywords: "kpi report tonnes per 100k diverted landfill business unit", roles: EXTENDED, task: { blurb: "Pick the measures and compare projects side by side.", home: true } },
  { label: "Check licences about to expire", path: "waste/documents", keywords: "carrier permit expiring lapsed", roles: EXTENDED, task: { blurb: "See what has lapsed or lapses within 30 days." } },
  { label: "Add a project or site", path: "contracts", keywords: "new project site contract facility add", roles: EXTENDED, task: { blurb: "Set up where the work happens." } },
  { label: "Add a facility or site address", path: "settings/operations", keywords: "facilities address location office depot yard add", roles: ["admin"], task: { blurb: "Offices, depots and yards, with their address." } },
  { label: "Invite a team member", path: "settings/members", keywords: "add user colleague access role", roles: ["admin"], task: { blurb: "Give a colleague access and choose their role." } },
  { label: "Make a report", path: "reports", keywords: "pdf publish download generate", roles: CORE, task: { blurb: "Create a PDF for a client, tender or the board." } },
  // Pages.
  { label: "KPI report", path: "kpis", keywords: "waste kpis tonnes diverted per 100k floor area compare projects units saved report", roles: EXTENDED },
  { label: "Dashboard", path: "dashboard", keywords: "home overview footprint" },
  { label: "Records", path: "records", keywords: "activity data bills", roles: CORE },
  { label: "Imports", path: "imports", keywords: "upload csv excel", roles: CORE },
  { label: "Monthly checklist", path: "checklist", keywords: "missing todo what to add data complete month", roles: ["admin", "editor", "sustainability_director", "sustainability_manager"] },
  { label: "Submissions", path: "submissions", keywords: "field review queue", roles: ["admin", "editor", "reviewer"] },
  { label: "Site map", path: "map", keywords: "sites locations scrubber published snapshots", roles: CORE },
  { label: "Suppliers", path: "suppliers", keywords: "supplier health", roles: CORE },
  { label: "Commuting", path: "commuting", keywords: "employee travel survey", roles: CORE },
  { label: "Tasks", path: "tasks" },
  { label: "Waste documents", path: "waste/documents", keywords: "waste transfer note carrier licence permit exemption expiry contractor upload", roles: EXTENDED },
  { label: "Material movements", path: "material-movements", keywords: "contaminated soil hazardous waste consignment note classification loads duty of care asbestos knotweed", roles: EXTENDED },
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

/**
 * Items a role may open, matched against a typed query (every word must appear in the label or
 * keywords). Label matches come before keyword-only matches, so typing "rec" finds Records before
 * a task that merely mentions records; ties keep the list order.
 */
// Words that carry no meaning when someone types a sentence ("how do I add last month's bill").
const STOP = new Set("a an and are as at be can do does for from get have how i if in is it me my of on or our please should so that the there to us want we what where which who why will with you your need needs find show open go see look make let".split(" "));
// A few everyday words people use for what the pages call something else.
const SAME: Record<string, string[]> = { rubbish: ["waste"], skip: ["waste"], skips: ["waste"], tip: ["waste"], tipping: ["waste"], invoice: ["bill"], invoices: ["bill"], receipt: ["bill"], lorry: ["carrier"], haulier: ["carrier"], diesel: ["fuel"], co2: ["emissions"], staff: ["team", "member"], user: ["member"], users: ["member"], pdf: ["report"] };

/** Meaningful words of a typed sentence: lower case, no filler, plurals folded, each with any everyday alternatives. */
function terms(query: string): string[][] {
  return query
    .toLowerCase()
    .replace(/['’]s\b/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !STOP.has(w))
    .map((w) => [w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w, ...(SAME[w] ?? [])]);
}

/**
 * Pages and tasks that fit what was typed, best first. Typing a few words keeps working as before (every word must
 * match the label or keywords). Typing a sentence works too: filler words are ignored, and when no page holds every
 * word, the pages holding at least half of them are offered, the closest first.
 */
export function paletteMatches(items: readonly PaletteItem[], role: string, query: string): PaletteItem[] {
  const allowed = items.filter((i) => !i.roles || i.roles.includes(role));
  const words = terms(query);
  if (words.length === 0) return allowed;
  const hay = (i: PaletteItem) => `${i.label} ${i.keywords ?? ""}`.toLowerCase();
  const hit = (i: PaletteItem, alts: string[]) => alts.some((w) => hay(i).includes(w));
  const labelHit = (i: PaletteItem, alts: string[]) => alts.some((w) => i.label.toLowerCase().includes(w));
  const score = (i: PaletteItem) => words.reduce((n, alts) => n + (hit(i, alts) ? 1 : 0), 0) * 10 + words.reduce((n, alts) => n + (labelHit(i, alts) ? 1 : 0), 0);
  const need = (strict: boolean) => (strict ? words.length : Math.ceil(words.length / 2));
  const matched = (strict: boolean) => allowed.filter((i) => words.reduce((n, alts) => n + (hit(i, alts) ? 1 : 0), 0) >= need(strict));
  let found = matched(true);
  // A single stray word never widens the search: "zzz" finds nothing.
  if (found.length === 0 && words.length >= 3) found = matched(false);
  const firstWord = words[0][0];
  return found
    .map((item, index) => ({ item, index, s: score(item), starts: item.label.toLowerCase().startsWith(firstWord) ? 1 : 0 }))
    .sort((a, b) => b.starts - a.starts || b.s - a.s || a.index - b.index)
    .map((x) => x.item);
}
