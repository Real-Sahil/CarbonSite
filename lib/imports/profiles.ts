// ERP export profiles: a saved column mapping for one source system plus a
// rule table that turns ledger account / cost codes into emission categories.
// A purchase ledger export holds every cost line (payroll, rent, fuel,
// concrete), so rows no rule covers are left out of the import rather than
// guessed, and each one says why. Pure: the worker and the preview route run
// the same function over the parsed file.

import { z } from "zod";
import type { ParsedRow } from "./parser";

export const SOURCE_SYSTEMS = ["sap", "causeway", "coins", "sage", "generic"] as const;
export type SourceSystem = (typeof SOURCE_SYSTEMS)[number];

/** Columns a ledger export can supply. Each maps to one header in the file. */
export const PROFILE_COLUMNS = [
  { key: "date", label: "Posting date", required: true },
  { key: "account", label: "Ledger account", required: false },
  { key: "costCode", label: "Cost code or cost centre", required: false },
  { key: "netAmount", label: "Net amount", required: false },
  { key: "currency", label: "Currency", required: false },
  { key: "quantity", label: "Quantity", required: false },
  { key: "unit", label: "Unit", required: false },
  { key: "description", label: "Description", required: false },
  { key: "supplier", label: "Supplier", required: false },
  { key: "facility", label: "Site or facility", required: false },
  { key: "reference", label: "Document reference", required: false },
] as const;
export type ProfileColumnKey = (typeof PROFILE_COLUMNS)[number]["key"];

const code = z.string().trim().min(1).max(60);

export const profileRuleSchema = z
  .object({
    account: code.optional(),
    costCode: code.optional(),
    action: z.enum(["include", "ignore"]),
    categoryCode: z.string().trim().min(1).max(60).optional(),
    /** spend: the net amount is the activity; quantity: the quantity column is. */
    basis: z.enum(["spend", "quantity"]).default("spend"),
    unit: z.string().trim().min(1).max(20).optional(),
    industryCode: z.string().trim().min(1).max(20).optional(),
    fuelType: z.string().trim().min(1).max(80).optional(),
    facilityName: z.string().trim().min(1).max(200).optional(),
    note: z.string().trim().max(200).optional(),
  })
  .refine((r) => r.account || r.costCode, { message: "A rule needs an account or a cost code to match." })
  .refine((r) => r.action === "ignore" || r.categoryCode, { message: "An include rule needs an emission category.", path: ["categoryCode"] });
export type ProfileRule = z.infer<typeof profileRuleSchema>;

export const profileSpecSchema = z
  .object({
    sourceSystem: z.enum(SOURCE_SYSTEMS),
    columns: z.record(z.enum(PROFILE_COLUMNS.map((c) => c.key) as [ProfileColumnKey, ...ProfileColumnKey[]]), z.string().trim().min(1).max(200)),
    dateFormat: z.enum(["dmy", "mdy", "ymd"]).default("dmy"),
    numberFormat: z.enum(["uk", "eu"]).default("uk"),
    defaultCurrency: z.string().trim().length(3).toUpperCase().default("GBP"),
    rules: z.array(profileRuleSchema).max(1000),
  })
  .refine((p) => p.columns.date, { message: "Map the posting date column.", path: ["columns", "date"] })
  .refine((p) => p.columns.account || p.columns.costCode, { message: "Map the ledger account or cost code column.", path: ["columns"] })
  .refine((p) => p.columns.netAmount || p.columns.quantity, { message: "Map the net amount or quantity column.", path: ["columns"] });
export type ProfileSpec = z.infer<typeof profileSpecSchema>;

/** Body of POST/PUT /api/orgs/{orgId}/import-profiles. */
export const profileBodySchema = z.object({ name: z.string().trim().min(1).max(100), spec: profileSpecSchema });

// ── Code patterns ────────────────────────────────────────────────────────────
// "5100" matches exactly, "51*" by prefix, "5000-5099" as a numeric range.
// Codes are compared trimmed and case-insensitively.

type Pattern = { kind: "exact"; value: string } | { kind: "prefix"; value: string } | { kind: "range"; from: number; to: number };

export function parsePattern(raw: string): Pattern {
  const s = raw.trim().toLowerCase();
  if (s.length > 1 && s.endsWith("*")) return { kind: "prefix", value: s.slice(0, -1) };
  const range = /^(\d+)\s*-\s*(\d+)$/.exec(s);
  if (range) {
    const [a, b] = [Number(range[1]), Number(range[2])];
    return { kind: "range", from: Math.min(a, b), to: Math.max(a, b) };
  }
  return { kind: "exact", value: s };
}

/** Match score: 0 means no match. Exact beats any range, a range beats any prefix; narrower ranges and longer prefixes win. */
export function patternScore(pattern: Pattern, value: string | undefined): number {
  const v = value?.trim().toLowerCase();
  if (!v) return 0;
  switch (pattern.kind) {
    case "exact":
      return v === pattern.value ? 3_000_000 : 0;
    case "range": {
      if (!/^\d+$/.test(v)) return 0;
      const n = Number(v);
      return n >= pattern.from && n <= pattern.to ? 2_000_000 - Math.min(pattern.to - pattern.from, 999_999) : 0;
    }
    case "prefix":
      return v.startsWith(pattern.value) ? 1_000_000 + pattern.value.length : 0;
  }
}

/**
 * The rule that applies to a line: every pattern a rule names must match, the
 * scores add (so account plus cost code beats account alone), ties go to the
 * rule listed first.
 */
export function matchRule(rules: ProfileRule[], account: string | undefined, costCode: string | undefined): { rule: ProfileRule; index: number } | null {
  let best: { rule: ProfileRule; index: number } | null = null;
  let bestScore = 0;
  rules.forEach((rule, index) => {
    let score = 0;
    for (const [pattern, value] of [
      [rule.account, account],
      [rule.costCode, costCode],
    ] as const) {
      if (!pattern) continue;
      const s = patternScore(parsePattern(pattern), value);
      if (s === 0) return;
      score += s;
    }
    if (score > bestScore) {
      best = { rule, index };
      bestScore = score;
    }
  });
  return best;
}

// ── Value parsing ────────────────────────────────────────────────────────────

/**
 * Ledger amounts: "1,234.56", "1.234,56" (numberFormat eu), "(120.00)" and SAP's
 * trailing minus "120.00-" are all read. Currency symbols and spaces are dropped.
 */
export function parseLedgerNumber(raw: string | undefined, format: "uk" | "eu"): number | null {
  if (raw == null) return null;
  let s = raw.trim().replace(/[£$€\s]/g, "").replace(/^[A-Za-z]{3}(?=[-\d(])/, "");
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.endsWith("-")) {
    negative = true;
    s = s.slice(0, -1);
  }
  if (s.startsWith("-")) {
    negative = !negative;
    s = s.slice(1);
  }
  s = format === "eu" ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return negative ? -n : n;
}

/** A ledger date as YYYY-MM-DD, or null. Accepts / . - separators and Excel's ISO output. */
export function parseLedgerDate(raw: string | undefined, format: "dmy" | "mdy" | "ymd"): string | null {
  const s = raw?.trim();
  if (!s) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return valid(+iso[1], +iso[2], +iso[3]);
  const parts = s.split(/[/.\-]/).map((p) => p.trim());
  if (parts.length !== 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  const [a, b, c] = parts.map(Number);
  const year = (y: number) => (y < 100 ? 2000 + y : y);
  if (format === "ymd") return valid(year(a), b, c);
  if (format === "mdy") return valid(year(c), a, b);
  return valid(year(c), b, a);
}

function valid(y: number, m: number, d: number): string | null {
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
}

// ── Applying a profile ───────────────────────────────────────────────────────

export type ProfiledRow =
  /** Canonical row (headers are CANONICAL_FIELDS names), validated by validateRow() next. */
  | { kind: "row"; row: ParsedRow; ruleIndex: number }
  /** Left out of the import. `actionable` lines need a rule; the others were meant to be skipped. */
  | { kind: "excluded"; reason: string; actionable: boolean };

const SYSTEM_LABEL: Record<SourceSystem, string> = { sap: "SAP", causeway: "Causeway", coins: "COINS", sage: "Sage", generic: "Ledger" };

function codeLabel(account: string | undefined, costCode: string | undefined): string {
  return [account && `account ${account}`, costCode && `cost code ${costCode}`].filter(Boolean).join(", ");
}

export function applyProfile(rows: ParsedRow[], spec: ProfileSpec): ProfiledRow[] {
  const col = (row: ParsedRow, key: ProfileColumnKey) => {
    const header = spec.columns[key];
    const v = header ? row[header] : undefined;
    return v?.trim() ? v.trim() : undefined;
  };

  return rows.map((row): ProfiledRow => {
    const account = col(row, "account");
    const costCode = col(row, "costCode");
    if (!account && !costCode) return { kind: "excluded", reason: "No ledger account or cost code on this line.", actionable: true };

    const match = matchRule(spec.rules, account, costCode);
    const where = codeLabel(account, costCode);
    const description = col(row, "description");
    if (!match) {
      return {
        kind: "excluded",
        reason: `No rule for ${where}${description ? ` (${description.slice(0, 60)})` : ""}; left out. Add a rule to include or ignore it.`,
        actionable: true,
      };
    }
    const { rule, index } = match;
    if (rule.action === "ignore") return { kind: "excluded", reason: `Ignored by the rule for ${where}.`, actionable: false };

    const spend = parseLedgerNumber(col(row, "netAmount"), spec.numberFormat);
    const quantity = parseLedgerNumber(col(row, "quantity"), spec.numberFormat);
    const signed = rule.basis === "quantity" ? quantity : spend;
    if (signed != null && signed < 0) {
      return { kind: "excluded", reason: `Credit line (${where}); left out. Net credit notes against the invoice line if they reduce the activity.`, actionable: true };
    }
    if (signed === 0) return { kind: "excluded", reason: `Zero-value line (${where}).`, actionable: false };

    const currency = (col(row, "currency") ?? spec.defaultCurrency).toUpperCase();
    const rawDate = col(row, "date");
    const out: ParsedRow = {
      emissionCategoryCode: rule.categoryCode ?? "",
      activityDate: parseLedgerDate(rawDate, spec.dateFormat) ?? rawDate ?? "",
      dataOrigin: "invoiced",
    };

    if (rule.basis === "quantity") {
      if (quantity != null) out.amount = String(quantity);
      const unit = col(row, "unit") ?? rule.unit;
      if (unit) out.unit = unit;
    } else if (spend != null) {
      out.amount = String(spend);
      out.unit = currency;
    }
    if (spend != null && spend > 0) {
      out.spendAmount = String(spend);
      out.spendCurrency = currency;
    }

    const reference = col(row, "reference");
    out.sourceDescription = [SYSTEM_LABEL[spec.sourceSystem], reference, description].filter(Boolean).join(" ");
    const supplier = col(row, "supplier");
    if (supplier) out.supplierName = supplier;
    const facility = col(row, "facility") ?? rule.facilityName;
    if (facility) out.facilityName = facility;
    if (rule.industryCode) out.industryCode = rule.industryCode;
    if (rule.fuelType) out.fuelType = rule.fuelType;
    out.assumptionNotes = `From ${where} by the import profile rule for ${[rule.account && `account ${rule.account}`, rule.costCode && `cost code ${rule.costCode}`].filter(Boolean).join(", ")}${rule.note ? ` (${rule.note})` : ""}.`;

    return { kind: "row", row: out, ruleIndex: index };
  });
}

export type ProfileSummary = {
  lines: number;
  included: number;
  ignored: number;
  needsAttention: number;
  /** Codes with lines no rule covers, largest net amount first: the rules still to write. */
  unmatched: { account?: string; costCode?: string; lines: number; netAmount: number; example?: string }[];
  /** Net amount per category over included lines. */
  byCategory: { categoryCode: string; lines: number; netAmount: number }[];
};

export function summariseProfile(rows: ParsedRow[], spec: ProfileSpec, profiled = applyProfile(rows, spec), limit = 200): ProfileSummary {
  const col = (row: ParsedRow, key: ProfileColumnKey) => {
    const h = spec.columns[key];
    return h && row[h]?.trim() ? row[h].trim() : undefined;
  };
  const unmatched = new Map<string, ProfileSummary["unmatched"][number]>();
  const byCategory = new Map<string, ProfileSummary["byCategory"][number]>();
  const summary: ProfileSummary = { lines: rows.length, included: 0, ignored: 0, needsAttention: 0, unmatched: [], byCategory: [] };

  profiled.forEach((p, i) => {
    const net = parseLedgerNumber(col(rows[i], "netAmount"), spec.numberFormat) ?? 0;
    if (p.kind === "row") {
      summary.included++;
      const code = p.row.emissionCategoryCode;
      const c = byCategory.get(code) ?? { categoryCode: code, lines: 0, netAmount: 0 };
      c.lines++;
      c.netAmount += net;
      byCategory.set(code, c);
      return;
    }
    if (!p.actionable) {
      summary.ignored++;
      return;
    }
    summary.needsAttention++;
    const account = col(rows[i], "account");
    const costCode = col(rows[i], "costCode");
    // Credit lines have a rule already; only lines with no rule go in the to-do list.
    if (matchRule(spec.rules, account, costCode)) return;
    const key = `${account ?? ""}\u0000${costCode ?? ""}`;
    const u = unmatched.get(key) ?? { account, costCode, lines: 0, netAmount: 0, example: col(rows[i], "description") };
    u.lines++;
    u.netAmount += net;
    unmatched.set(key, u);
  });

  const round = (n: number) => Math.round(n * 100) / 100;
  summary.unmatched = [...unmatched.values()]
    .sort((a, b) => Math.abs(b.netAmount) - Math.abs(a.netAmount))
    .slice(0, limit)
    .map((u) => ({ ...u, netAmount: round(u.netAmount) }));
  summary.byCategory = [...byCategory.values()].sort((a, b) => b.netAmount - a.netAmount).map((c) => ({ ...c, netAmount: round(c.netAmount) }));
  return summary;
}

/** Column map for validateRow() over applyProfile() output: canonical names map to themselves. */
export const PROFILED_COLUMN_MAP = new Map(
  [
    "emissionCategoryCode", "activityDate", "amount", "unit", "spendAmount", "spendCurrency", "sourceDescription",
    "supplierName", "facilityName", "industryCode", "fuelType", "assumptionNotes", "dataOrigin",
  ].map((k) => [k, k]),
);

/** Resolve a template's candidate headers against the headers actually in a file (case and spacing ignored). */
export function resolveColumns(candidates: Partial<Record<ProfileColumnKey, string[]>>, headers: string[]): Partial<Record<ProfileColumnKey, string>> {
  const norm = (h: string) => h.trim().toLowerCase().replace(/[\s_./-]+/g, " ");
  const byNorm = new Map(headers.map((h) => [norm(h), h]));
  const used = new Set<string>();
  const out: Partial<Record<ProfileColumnKey, string>> = {};
  for (const { key } of PROFILE_COLUMNS) {
    for (const c of candidates[key] ?? []) {
      const h = byNorm.get(norm(c));
      if (h && !used.has(h)) {
        out[key] = h;
        used.add(h);
        break;
      }
    }
  }
  return out;
}
