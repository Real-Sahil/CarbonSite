/**
 * Employee commuting (GHG Protocol Scope 3 Category 7), distance-based
 * method, from site attendance and the site's commute survey: days on site
 * x each surveyed person's own round trip, by the way they travel.
 *
 * No home postcode is read or asked for. The survey asks, anonymously, how
 * someone travels, how many people share the vehicle, who employs them and
 * how many miles their journey from home to site and back is. The average
 * of those answers, per mode, prices each day on site.
 *
 * Attendance exports (MSite, Biosite, Sitemetric or a spreadsheet) carry
 * names and often home postcodes. Only the date, the employer and a worker
 * key for de-duplicating sign-ins are read; the file itself is never stored.
 *
 * Only the organisation's own staff are Category 7. Subcontractor operatives
 * travel for their employer, which is the organisation's Category 1
 * (purchased services); their kilometres are reported beside the inventory
 * for project (PAS 2080 A5) views, never added to it.
 */

/** Survey answers with a distance needed before a site's commuting can be worked out. */
export const MIN_SURVEY_RESPONSES = 5;
/** Largest round trip a survey answer may give, in miles. */
export const MAX_ROUND_TRIP_MILES = 300;
export const KM_PER_MILE = 1.609344;
/** Largest attendance file read, in data rows. */
export const MAX_ATTENDANCE_ROWS = 50_000;

export const SURVEY_MODES = {
  car: { label: "Car" },
  van: { label: "Van" },
  bev: { label: "Electric car" },
  motorbike: { label: "Motorbike" },
  bus: { label: "Bus or coach" },
  rail: { label: "Train" },
  active: { label: "Cycle or walk" },
} as const;
export type SurveyMode = keyof typeof SURVEY_MODES;
export const SURVEY_MODE_KEYS = Object.keys(SURVEY_MODES) as SurveyMode[];
export const VEHICLE_MODES: SurveyMode[] = ["car", "van", "bev", "motorbike"];

/**
 * How each mode becomes a record. transportMode is the detail the factor
 * selector matches against DEFRA's commuting factors (see
 * lib/calculation/__tests__/factor-hint.test.ts): "Car" picks the average
 * car, "BEV" the battery electric car. Vans have no commuting factor in the
 * library, so they are priced as an average car and the record says so.
 * Car, van, BEV and motorbike factors are per vehicle.km, so shared journeys
 * are divided by the number of people in the vehicle; bus and rail are per
 * passenger.km. Cycling and walking have no emissions and make no record.
 */
export const RECORD_MODES = {
  car: { label: "Car or van", transportMode: "Car", perVehicle: true },
  bev: { label: "Electric car", transportMode: "BEV", perVehicle: true },
  motorbike: { label: "Motorbike", transportMode: "Motorbike", perVehicle: true },
  bus: { label: "Bus or coach", transportMode: "Bus", perVehicle: false },
  rail: { label: "Train", transportMode: "Rail", perVehicle: false },
  active: { label: "Cycle or walk", transportMode: null, perVehicle: false },
} as const;
export type RecordMode = keyof typeof RECORD_MODES;

const RECORD_MODE_OF: Record<SurveyMode, RecordMode> = {
  car: "car", van: "car", bev: "bev", motorbike: "motorbike", bus: "bus", rail: "rail", active: "active",
};

export type Workforce = "own" | "subcontractor";

/** roundTripKm is null on answers given before the survey asked for distance. */
export type SurveyAnswer = { mode: SurveyMode; occupancy: number; workforce: Workforce; roundTripKm: number | null };

export type SurveyDistances = {
  /** Kilometres of each record mode per day on site (vehicle km for car, van, BEV and motorbike). */
  kmPerDay: Partial<Record<RecordMode, number>>;
  /** Plain description for the record's assumption notes. */
  source: string;
  /** Answers used. */
  used: number;
  vans: boolean;
  /** Share of the answers used, per survey mode (what people said, before sharing is divided out). */
  people: Partial<Record<SurveyMode, number>>;
  /** Average round trip per person, km. */
  averageRoundTripKm: number;
  /** Per survey mode: answers and their average round trip, for the evidence. */
  byMode: Partial<Record<SurveyMode, { answers: number; averageRoundTripKm: number }>>;
};

/** "1 day", "3 days". */
export const count = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-GB")} ${n === 1 ? one : many}`;

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * What a day on site means in kilometres per mode: the average over the
 * survey answers that give a distance, each person's round trip at their
 * own mode, shared vehicles divided by the people in them. Uses the
 * workforce's own answers when there are enough, else everyone's; with
 * fewer than MIN_SURVEY_RESPONSES answers there is no figure (null), since
 * no distance can honestly be assumed.
 */
export function surveyDistances(answers: SurveyAnswer[], workforce: Workforce): SurveyDistances | null {
  const withKm = answers.filter((a): a is SurveyAnswer & { roundTripKm: number } => a.roundTripKm != null && a.roundTripKm >= 0);
  const mine = withKm.filter((a) => a.workforce === workforce);
  const used = mine.length >= MIN_SURVEY_RESPONSES ? mine : withKm.length >= MIN_SURVEY_RESPONSES ? withKm : null;
  if (!used) return null;
  const kmPerDay: Partial<Record<RecordMode, number>> = {};
  const people: Partial<Record<SurveyMode, number>> = {};
  const sums: Partial<Record<SurveyMode, { answers: number; km: number }>> = {};
  let total = 0;
  for (const a of used) {
    people[a.mode] = (people[a.mode] ?? 0) + 1 / used.length;
    const s = (sums[a.mode] ??= { answers: 0, km: 0 });
    s.answers++;
    s.km += a.roundTripKm;
    total += a.roundTripKm;
    const mode = RECORD_MODE_OF[a.mode];
    const occupancy = Math.max(1, Math.round(a.occupancy) || 1);
    const km = RECORD_MODES[mode].perVehicle ? a.roundTripKm / occupancy : a.roundTripKm;
    kmPerDay[mode] = (kmPerDay[mode] ?? 0) + km / used.length;
  }
  const byMode: SurveyDistances["byMode"] = {};
  for (const [m, s] of Object.entries(sums) as [SurveyMode, { answers: number; km: number }][]) {
    byMode[m] = { answers: s.answers, averageRoundTripKm: round1(s.km / s.answers) };
  }
  const who = used === mine ? (workforce === "own" ? "own staff" : "subcontractor staff") : "everyone on site";
  return {
    kmPerDay,
    source: `site commute survey: ${used.length} answers from ${who} giving their mode and round trip, shared vehicles divided by the people in them`,
    used: used.length,
    vans: used.some((a) => a.mode === "van"),
    people,
    averageRoundTripKm: round1(total / used.length),
    byMode,
  };
}

/** Kilometres per record mode for a number of days on site (cycling and walking dropped), to one decimal place. */
export function kmByMode(days: number, distances: SurveyDistances): { mode: Exclude<RecordMode, "active">; km: number }[] {
  return (Object.entries(distances.kmPerDay) as [RecordMode, number][])
    .filter(([mode]) => mode !== "active")
    .map(([mode, perDay]) => ({ mode: mode as Exclude<RecordMode, "active">, km: round1(days * perDay) }))
    .filter((m) => m.km > 0);
}

/** Total person-kilometres (each person's round trip, before sharing) for a number of days. */
export const personKm = (days: number, distances: SurveyDistances | null) => (distances ? round1(days * distances.averageRoundTripKm) : 0);

// ---------------------------------------------------------------------------
// Attendance files
// ---------------------------------------------------------------------------

export type AttendanceRow = { date: string; worker: string | null; employer: string };

export type ParsedAttendance = {
  rows: AttendanceRow[];
  skipped: number;
  columns: { date: string; worker: string | null; employer: string | null };
  /** A home postcode column the file had and that was not read. */
  ignoredPostcode: string | null;
  warnings: string[];
};

export class AttendanceError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function findColumn(headers: string[], patterns: RegExp[], avoid: RegExp[] = []): string | null {
  for (const p of patterns) {
    const hit = headers.find((h) => p.test(norm(h)) && !avoid.some((a) => a.test(norm(h))));
    if (hit) return hit;
  }
  return null;
}

/** ISO date (YYYY-MM-DD) from a Date, an Excel serial or a UK/ISO string. */
export function attendanceDate(value: unknown): string | null {
  const iso = (y: number, m: number, d: number) => {
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? dt.toISOString().slice(0, 10) : null;
  };
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : iso(value.getFullYear(), value.getMonth() + 1, value.getDate());
  if (typeof value === "number" && value > 20000 && value < 80000) {
    const dt = new Date(Math.round((value - 25569) * 86400000));
    return iso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  }
  const s = String(value ?? "").trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})\b/);
  if (m) return iso(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  return null;
}

/** Reads attendance rows (objects keyed by header) from any site access export. */
export function parseAttendance(records: Record<string, unknown>[]): ParsedAttendance {
  if (records.length === 0) throw new AttendanceError("EMPTY_FILE", "The file has no rows.");
  if (records.length > MAX_ATTENDANCE_ROWS) {
    throw new AttendanceError("TOO_MANY_ROWS", `The file has ${records.length} rows; split it into months of up to ${MAX_ATTENDANCE_ROWS}.`);
  }
  const headers = [...new Set(records.flatMap((r) => Object.keys(r)))];
  const date = findColumn(headers, [/^date$/, /\bdate\b/, /\b(clock|sign(ed)?|time) ?in\b/, /\bday\b/, /\bin\b/], [/\bbirth\b|\bdob\b|\bexpir/]);
  if (!date) throw new AttendanceError("NO_DATE_COLUMN", "No date column found. Name one Date, Sign in or Clock in.");
  const worker = findColumn(
    headers,
    [/\b(worker|operative|employee|person|user|badge|card|cscs) ?(id|ref|no|number)\b/, /^(id|ref|reference)$/, /\b(worker|operative|employee|full ?name|name)\b/],
    [/\b(employer|company|contractor|site|project)\b/],
  );
  const employer = findColumn(headers, [/\bemployer\b/, /\b(company|contractor|subcontractor|organisation|organization|firm)\b/], [/\bsite\b/]);
  const postcode = findColumn(headers, [/\b(home )?post ?code\b/, /\bzip\b/], [/\bsite\b/]);

  const rows: AttendanceRow[] = [];
  let skipped = 0;
  const seen = new Set<string>();
  let duplicates = 0;
  for (const r of records) {
    const day = attendanceDate(r[date]);
    if (!day) {
      skipped++;
      continue;
    }
    const who = worker ? String(r[worker] ?? "").trim() || null : null;
    // Several sign-ins by one person on one day are one day on site.
    if (who) {
      const key = `${who.toLowerCase()}|${day}`;
      if (seen.has(key)) {
        duplicates++;
        continue;
      }
      seen.add(key);
    }
    rows.push({ date: day, worker: who, employer: employer ? String(r[employer] ?? "").trim() : "" });
  }
  if (rows.length === 0) throw new AttendanceError("NO_DATES", `No row had a date the column "${date}" could be read as.`);

  const warnings: string[] = [];
  if (!worker) warnings.push("No worker id or name column: every row is counted as one day on site.");
  if (!employer) warnings.push("No employer column: choose whether everyone is your own staff.");
  if (postcode) warnings.push(`The "${postcode}" column was not read: distances come from the site's commute survey, not home postcodes.`);
  if (duplicates > 0) warnings.push(`${count(duplicates, "repeat sign-in")} on the same day counted once.`);
  if (skipped > 0) warnings.push(`${count(skipped, "row")} with no readable date left out.`);
  return { rows, skipped, columns: { date, worker, employer }, ignoredPostcode: postcode, warnings };
}

export function employerSummary(rows: AttendanceRow[]): { employer: string; days: number }[] {
  const days = new Map<string, number>();
  for (const r of rows) days.set(r.employer, (days.get(r.employer) ?? 0) + 1);
  return [...days].map(([employer, n]) => ({ employer, days: n })).sort((a, b) => b.days - a.days || a.employer.localeCompare(b.employer));
}

export type WorkforceDays = { days: number; people: number };
export type MonthAttendance = { month: string; firstDate: string; lastDate: string; own: WorkforceDays; subcontractor: WorkforceDays };

/** Groups rows by month and workforce. ownEmployers are compared case-insensitively. */
export function groupAttendance(rows: AttendanceRow[], ownEmployers: string[]): MonthAttendance[] {
  const own = new Set(ownEmployers.map((e) => e.trim().toLowerCase()));
  type Acc = { days: number; people: Set<string> };
  const months = new Map<string, { first: string; last: string; own: Acc; subcontractor: Acc }>();
  rows.forEach((r, i) => {
    const key = r.date.slice(0, 7);
    let m = months.get(key);
    if (!m) months.set(key, (m = { first: r.date, last: r.date, own: { days: 0, people: new Set() }, subcontractor: { days: 0, people: new Set() } }));
    if (r.date < m.first) m.first = r.date;
    if (r.date > m.last) m.last = r.date;
    const acc = own.has(r.employer.toLowerCase()) ? m.own : m.subcontractor;
    acc.days++;
    acc.people.add(r.worker?.toLowerCase() ?? `row-${i}`);
  });
  const out = (a: Acc): WorkforceDays => ({ days: a.days, people: a.people.size });
  return [...months]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, m]) => ({ month, firstDate: m.first, lastDate: m.last, own: out(m.own), subcontractor: out(m.subcontractor) }));
}

const csvCell = (v: unknown) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

/**
 * The evidence kept for an import: days per workforce and the survey
 * averages by mode that priced them. No names, no answers one by one.
 */
export function commuteEvidenceCsv(
  month: MonthAttendance,
  distances: { own: SurveyDistances; subcontractor: SurveyDistances | null },
): string {
  const lines = ["month,workforce,days_on_site,people,travel_mode,survey_answers,average_round_trip_km,vehicle_or_passenger_km_per_day,treatment"];
  for (const workforce of ["own", "subcontractor"] as const) {
    const d = distances[workforce];
    const treatment = workforce === "own" ? "counted (Category 7)" : "reported beside the inventory (Category 1)";
    const days = month[workforce];
    if (!d) {
      lines.push([month.month, workforce, days.days, days.people, "", 0, "", "", "no survey distances: not worked out"].map(csvCell).join(","));
      continue;
    }
    for (const [mode, m] of Object.entries(d.byMode) as [SurveyMode, { answers: number; averageRoundTripKm: number }][]) {
      const recordMode = RECORD_MODE_OF[mode];
      const perDay = d.kmPerDay[recordMode] ?? 0;
      lines.push([month.month, workforce, days.days, days.people, SURVEY_MODES[mode].label, m.answers, m.averageRoundTripKm.toFixed(1), perDay.toFixed(2), recordMode === "active" ? "no emissions" : treatment].map(csvCell).join(","));
    }
  }
  return lines.join("\n") + "\n";
}
