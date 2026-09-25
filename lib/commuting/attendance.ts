/**
 * Employee commuting (GHG Protocol Scope 3 Category 7), distance-based
 * method, from site attendance: days on site x 2 x road km from the worker's
 * home postcode district to the site, split by travel mode from the site's
 * commute survey.
 *
 * Attendance exports (MSite, Biosite, Sitemetric or a spreadsheet) carry
 * names and full postcodes. Only the date, the employer, a worker key for
 * de-duplicating sign-ins and the postcode district (outward code, e.g. HD9)
 * are read; the file itself is never stored. The evidence kept is the
 * aggregate by district.
 *
 * Only the organisation's own staff are Category 7. Subcontractor operatives
 * travel for their employer, which is the organisation's Category 1
 * (purchased services); their kilometres are reported beside the inventory
 * for project (PAS 2080 A5) views, never added to it.
 */

/** One-way road distance above which a worker is assumed to lodge near site. */
export const LODGING_KM = 150;
/** Survey answers needed before a site's own split replaces the default. */
export const MIN_SURVEY_RESPONSES = 5;
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

export type SurveyAnswer = { mode: SurveyMode; occupancy: number; workforce: Workforce };

export type ModeSplit = {
  /** Kilometres of each record mode per person-kilometre travelled. */
  weights: Partial<Record<RecordMode, number>>;
  /** Plain description for the record's assumption notes. */
  source: string;
  responses: number;
  vans: boolean;
  /** Share of the answers used, per survey mode (what people said, before sharing is divided out). */
  people: Partial<Record<SurveyMode, number>>;
};

/** "1 day", "3 days". */
export const count = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-GB")} ${n === 1 ? one : many}`;

/**
 * The site's mode split: its own staff's answers when there are enough,
 * else everyone's, else the stated default (everyone drives alone, the
 * highest-emitting common case, so the figure is never understated).
 */
export function modeSplit(answers: SurveyAnswer[], workforce: Workforce): ModeSplit {
  const own = answers.filter((a) => a.workforce === workforce);
  const used = own.length >= MIN_SURVEY_RESPONSES ? own : answers.length >= MIN_SURVEY_RESPONSES ? answers : null;
  if (!used) {
    return {
      weights: { car: 1 },
      source: `default: everyone drives alone (fewer than ${MIN_SURVEY_RESPONSES} survey answers for this site)`,
      responses: answers.length,
      vans: false,
      people: {},
    };
  }
  const weights: Partial<Record<RecordMode, number>> = {};
  const people: Partial<Record<SurveyMode, number>> = {};
  for (const a of used) {
    people[a.mode] = (people[a.mode] ?? 0) + 1 / used.length;
    const mode = RECORD_MODE_OF[a.mode];
    const occupancy = Math.max(1, Math.round(a.occupancy) || 1);
    const w = RECORD_MODES[mode].perVehicle ? 1 / occupancy : 1;
    weights[mode] = (weights[mode] ?? 0) + w / used.length;
  }
  const who = used === own ? (workforce === "own" ? "own staff" : "subcontractor staff") : "everyone on site";
  return {
    weights,
    source: `site commute survey: ${used.length} answers from ${who}, shared vehicles divided by the people in them`,
    responses: answers.length,
    vans: used.some((a) => a.mode === "van"),
    people,
  };
}

// ---------------------------------------------------------------------------
// Attendance files
// ---------------------------------------------------------------------------

export type AttendanceRow = { date: string; worker: string | null; employer: string; district: string | null };

export type ParsedAttendance = {
  rows: AttendanceRow[];
  skipped: number;
  columns: { date: string; worker: string | null; employer: string | null; postcode: string | null };
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

/** The outward code (district) of a UK postcode: "HD9 7AB" -> "HD9". Anything else -> null. */
export function postcodeDistrict(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return null;
  const full = s.replace(/ /g, "").match(/^([A-Z]{1,2}\d[A-Z\d]?)(\d[A-Z]{2})$/);
  if (full) return full[1];
  const outward = s.split(" ")[0];
  return /^[A-Z]{1,2}\d[A-Z\d]?$/.test(outward) ? outward : null;
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
  let noPostcode = 0;
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
    const district = postcode ? postcodeDistrict(r[postcode]) : null;
    if (!district) noPostcode++;
    rows.push({ date: day, worker: who, employer: employer ? String(r[employer] ?? "").trim() : "", district });
  }
  if (rows.length === 0) throw new AttendanceError("NO_DATES", `No row had a date the column "${date}" could be read as.`);

  const warnings: string[] = [];
  if (!worker) warnings.push("No worker id or name column: every row is counted as one day on site.");
  if (!employer) warnings.push("No employer column: choose whether everyone is your own staff.");
  if (!postcode) warnings.push("No home postcode column: distances cannot be worked out.");
  else if (noPostcode > 0) warnings.push(`${count(noPostcode, "day")} with no readable home postcode, counted at the site's average distance.`);
  if (duplicates > 0) warnings.push(`${count(duplicates, "repeat sign-in")} on the same day counted once.`);
  if (skipped > 0) warnings.push(`${count(skipped, "row")} with no readable date left out.`);
  return { rows, skipped, columns: { date, worker, employer, postcode }, warnings };
}

export function employerSummary(rows: AttendanceRow[]): { employer: string; days: number }[] {
  const days = new Map<string, number>();
  for (const r of rows) days.set(r.employer, (days.get(r.employer) ?? 0) + 1);
  return [...days].map(([employer, n]) => ({ employer, days: n })).sort((a, b) => b.days - a.days || a.employer.localeCompare(b.employer));
}

export type DistrictDays = { district: string | null; days: number; people: number };
export type MonthAttendance = { month: string; firstDate: string; lastDate: string; own: DistrictDays[]; subcontractor: DistrictDays[] };

/** Groups rows by month, workforce and district. ownEmployers are compared case-insensitively. */
export function groupAttendance(rows: AttendanceRow[], ownEmployers: string[]): MonthAttendance[] {
  const own = new Set(ownEmployers.map((e) => e.trim().toLowerCase()));
  type Acc = { days: number; people: Set<string> };
  const months = new Map<string, { first: string; last: string; own: Map<string, Acc>; subcontractor: Map<string, Acc> }>();
  rows.forEach((r, i) => {
    const key = r.date.slice(0, 7);
    let m = months.get(key);
    if (!m) months.set(key, (m = { first: r.date, last: r.date, own: new Map(), subcontractor: new Map() }));
    if (r.date < m.first) m.first = r.date;
    if (r.date > m.last) m.last = r.date;
    const bucket = own.has(r.employer.toLowerCase()) ? m.own : m.subcontractor;
    const d = r.district ?? "";
    let acc = bucket.get(d);
    if (!acc) bucket.set(d, (acc = { days: 0, people: new Set() }));
    acc.days++;
    acc.people.add(r.worker?.toLowerCase() ?? `row-${i}`);
  });
  const list = (b: Map<string, Acc>) =>
    [...b].map(([d, a]) => ({ district: d || null, days: a.days, people: a.people.size })).sort((x, y) => (x.district ?? "~").localeCompare(y.district ?? "~"));
  return [...months]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, m]) => ({ month, firstDate: m.first, lastDate: m.last, own: list(m.own), subcontractor: list(m.subcontractor) }));
}

export type CommuteTotals = {
  days: number;
  people: number;
  personKm: number;
  /** Days whose district had a distance under LODGING_KM. */
  measuredDays: number;
  /** Days with no postcode (or no routable one), counted at the average distance. */
  averagedDays: number;
  /** Days over LODGING_KM one way: left out as likely lodging near site. */
  lodgingDays: number;
};

/** Person-kilometres for one month and workforce, from one-way road km per district. */
export function commuteTotals(districts: DistrictDays[], oneWayKm: Map<string, number | null>): CommuteTotals {
  let measuredKm = 0;
  let measuredDays = 0;
  let averagedDays = 0;
  let lodgingDays = 0;
  let days = 0;
  let people = 0;
  for (const d of districts) {
    days += d.days;
    people += d.people;
    const km = d.district ? oneWayKm.get(d.district) ?? null : null;
    if (km == null) averagedDays += d.days;
    else if (km > LODGING_KM) lodgingDays += d.days;
    else {
      measuredDays += d.days;
      measuredKm += d.days * 2 * km;
    }
  }
  const averageDayKm = measuredDays > 0 ? measuredKm / measuredDays : 0;
  return { days, people, personKm: measuredKm + averagedDays * averageDayKm, measuredDays, averagedDays, lodgingDays };
}

/** Kilometres per record mode (cycling and walking dropped), to one decimal place. */
export function kmByMode(personKm: number, split: ModeSplit): { mode: Exclude<RecordMode, "active">; km: number }[] {
  return (Object.entries(split.weights) as [RecordMode, number][])
    .filter(([mode]) => mode !== "active")
    .map(([mode, w]) => ({ mode: mode as Exclude<RecordMode, "active">, km: Math.round(personKm * w * 10) / 10 }))
    .filter((m) => m.km > 0);
}

/** The evidence kept for an import: aggregates only, no names or full postcodes. */
export function attendanceEvidenceCsv(month: MonthAttendance, oneWayKm: Map<string, number | null>, methods: Map<string, string>): string {
  const lines = ["month,workforce,postcode_district,days_on_site,people,one_way_road_km,distance_method,treatment"];
  for (const workforce of ["own", "subcontractor"] as const) {
    for (const d of month[workforce]) {
      const km = d.district ? oneWayKm.get(d.district) ?? null : null;
      const treatment =
        workforce === "subcontractor"
          ? "subcontractor: reported beside the inventory (Category 1)"
          : km == null
            ? "no distance: counted at the average"
            : km > LODGING_KM
              ? `over ${LODGING_KM} km: likely lodging, left out`
              : "counted";
      lines.push(
        [month.month, workforce, d.district ?? "(none)", d.days, d.people, km == null ? "" : km.toFixed(1), d.district ? methods.get(d.district) ?? "" : "", treatment]
          .map((v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v)))
          .join(","),
      );
    }
  }
  return lines.join("\n") + "\n";
}
