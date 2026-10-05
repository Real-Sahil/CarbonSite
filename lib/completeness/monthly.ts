// The monthly "what is missing" checklist. Every item names what to do, where it
// lives in the app (a plain path, "Records → Add from a bill") and carries links
// straight to the page that fixes it, so nobody has to hunt. The builder is pure;
// the loader reads one organisation's data and nothing else.

import { prisma } from "@/lib/db";

export interface Fix {
  label: string;
  /** Relative to the organisation: "records", "imports/from-accounting". */
  path: string;
}

export interface ChecklistItem {
  id: string;
  kind: "setup" | "waiting_on_you" | "missing_data" | "calculate";
  /** "action" blocks a complete month; "info" is worth doing. */
  severity: "action" | "info";
  title: string;
  detail: string;
  /** The route through the app in words, shown beside the links. */
  where: string;
  fixes: Fix[];
}

export interface MissingSource {
  facility: string;
  category: string;
  /** Months (YYYY-MM) in the look-back window in which it was recorded. */
  seenIn: string[];
}

export interface ChecklistInput {
  month: string; // YYYY-MM
  hasPeriod: boolean;
  missingSources: MissingSource[];
  fieldSubmissionsWaiting: number;
  recordsInReview: number;
  importsWaiting: number;
  billsInInbox: number;
  ledgerLinesWaiting: number;
  recordsWithoutEvidence: number;
  approvedChangedSinceRun: number;
  hasRun: boolean;
  hasApprovedRecords: boolean;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function buildChecklist(i: ChecklistInput): ChecklistItem[] {
  const out: ChecklistItem[] = [];
  const label = monthLabel(i.month);

  if (!i.hasPeriod) {
    out.push({
      id: "period",
      kind: "setup",
      severity: "action",
      title: `No reporting period covers ${label}`,
      detail: "Records need a reporting period to count towards a report.",
      where: "Settings → Reporting periods → Next financial year",
      fixes: [{ label: "Add a reporting period", path: "settings/periods" }],
    });
  }

  if (i.fieldSubmissionsWaiting > 0) {
    out.push({
      id: "submissions",
      kind: "waiting_on_you",
      severity: "action",
      title: `${plural(i.fieldSubmissionsWaiting, "field submission")} waiting for review`,
      detail: "Photos and tickets from site stay out of the figures until someone approves them.",
      where: "Submissions → open a submission → Approve",
      fixes: [{ label: "Open the review queue", path: "submissions" }],
    });
  }
  if (i.recordsInReview > 0) {
    out.push({
      id: "records-review",
      kind: "waiting_on_you",
      severity: "action",
      title: `${plural(i.recordsInReview, "record")} waiting for approval`,
      detail: "Only approved records are calculated.",
      where: "Records → filter Status: In review",
      fixes: [{ label: "Review records", path: "records?reviewStatus=in_review" }],
    });
  }
  if (i.importsWaiting > 0) {
    out.push({
      id: "imports",
      kind: "waiting_on_you",
      severity: "action",
      title: `${plural(i.importsWaiting, "import")} waiting to be committed or fixed`,
      detail: "Imported rows are staged until a person commits them.",
      where: "Imports → open the batch → fix errors or Commit",
      fixes: [{ label: "Open imports", path: "imports" }],
    });
  }
  if (i.ledgerLinesWaiting > 0) {
    out.push({
      id: "ledger",
      kind: "waiting_on_you",
      severity: "info",
      title: `${plural(i.ledgerLinesWaiting, "accounting line")} not yet looked at`,
      detail: "Synced invoice lines have suggested categories. Confirm the right ones; fuel and energy lines need the quantity from the bill.",
      where: "Imports → Stage lines from your accounting system",
      fixes: [{ label: "Review accounting lines", path: "imports/from-accounting" }],
    });
  }
  if (i.billsInInbox > 0) {
    out.push({
      id: "bills",
      kind: "waiting_on_you",
      severity: "info",
      title: `${plural(i.billsInInbox, "bill")} in your bill inbox not yet attached`,
      detail: "Bills sent to your inbox address wait to be matched to a record or turned into one.",
      where: "Records → Bill inbox",
      fixes: [{ label: "Open the bill inbox", path: "records" }],
    });
  }

  for (const s of i.missingSources.slice(0, 8)) {
    out.push({
      id: `missing:${s.facility}:${s.category}`,
      kind: "missing_data",
      severity: "action",
      title: `${s.category} for ${s.facility} has nothing for ${label}`,
      detail: `It was recorded in ${s.seenIn.map(monthLabel).join(", ")}. If there was no use this month, no action is needed beyond noting it.`,
      where: "Records → Add from a bill (or Imports → upload a file)",
      fixes: [
        { label: "Add from a bill", path: "records" },
        { label: "Import a file", path: "imports" },
      ],
    });
  }
  if (i.missingSources.length > 8) {
    out.push({
      id: "missing:more",
      kind: "missing_data",
      severity: "info",
      title: `${i.missingSources.length - 8} more regular sources have nothing for ${label}`,
      detail: "Open Records and filter by month to see them.",
      where: "Records → filter by period",
      fixes: [{ label: "Open records", path: "records" }],
    });
  }

  if (i.recordsWithoutEvidence > 0) {
    out.push({
      id: "evidence",
      kind: "missing_data",
      severity: "info",
      title: `${plural(i.recordsWithoutEvidence, "record")} in ${label} without evidence`,
      detail: "A bill, meter photo or ticket attached to each record raises it to a verified figure.",
      where: "Records → open a record → Evidence, or Records → Attach bills",
      fixes: [{ label: "Attach evidence", path: "records" }],
    });
  }

  if (!i.hasRun && i.hasApprovedRecords) {
    out.push({
      id: "calc-first",
      kind: "calculate",
      severity: "action",
      title: "No calculation has been run for the period",
      detail: "Figures appear on the dashboard and in reports after a calculation run.",
      where: "Calculations → Run a calculation",
      fixes: [{ label: "Run a calculation", path: "calculations" }],
    });
  } else if (i.approvedChangedSinceRun > 0) {
    out.push({
      id: "calc-stale",
      kind: "calculate",
      severity: "action",
      title: `${plural(i.approvedChangedSinceRun, "approved record")} added or changed since the last calculation`,
      detail: "The dashboard and reports do not include them until you run the calculation again.",
      where: "Calculations → Run a calculation → review → Publish",
      fixes: [
        { label: "Run a calculation", path: "calculations" },
        { label: "Review unpublished changes", path: "dashboard" },
      ],
    });
  }
  return out;
}

// ─── Loader ──────────────────────────────────────────────────────────────────

const ym = (d: Date) => d.toISOString().slice(0, 7);

/** The calendar months (YYYY-MM) a record covers: its billing range, else its single date. */
export function monthsCovered(r: { startDate: Date | null; endDate: Date | null; activityDate: Date | null }): string[] {
  const from = r.startDate ?? r.activityDate ?? r.endDate;
  const to = r.endDate ?? r.activityDate ?? r.startDate;
  if (!from || !to || to < from) return from ? [ym(from)] : [];
  const out: string[] = [];
  const cur = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  const last = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
  while (cur <= last && out.length < 24) {
    out.push(ym(cur));
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  return out;
}

export function monthsBefore(month: string, n: number): string[] {
  const [y, m] = month.split("-").map(Number);
  return Array.from({ length: n }, (_, k) => ym(new Date(Date.UTC(y, m - 1 - (k + 1), 1)))).reverse();
}

/** A facility and category recorded in at least two of the three months before `month`, but not in `month`. */
export function findMissingSources(
  records: Array<{ facilityId: string | null; categoryId: string; months: string[] }>,
  month: string,
): Array<{ facilityId: string; categoryId: string; seenIn: string[] }> {
  const window = monthsBefore(month, 3);
  const bySource = new Map<string, Set<string>>();
  for (const r of records) {
    if (!r.facilityId) continue; // a source with no facility cannot be told apart month to month
    const key = `${r.facilityId}|${r.categoryId}`;
    const set = bySource.get(key) ?? new Set<string>();
    for (const m of r.months) set.add(m);
    bySource.set(key, set);
  }
  const out: Array<{ facilityId: string; categoryId: string; seenIn: string[] }> = [];
  for (const [key, set] of bySource) {
    if (set.has(month)) continue;
    const seenIn = window.filter((m) => set.has(m));
    if (seenIn.length < 2) continue;
    const [facilityId, categoryId] = key.split("|");
    out.push({ facilityId, categoryId, seenIn });
  }
  return out.sort((a, b) => a.facilityId.localeCompare(b.facilityId) || a.categoryId.localeCompare(b.categoryId));
}

/** The month before `now`, as YYYY-MM. */
export function defaultMonth(now = new Date()): string {
  return ym(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));
}

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function loadChecklist(orgId: string, month: string): Promise<ChecklistItem[]> {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0));
  const windowStart = new Date(Date.UTC(y, m - 4, 1));

  const period = await prisma.reportingPeriod.findFirst({
    where: { organizationId: orgId, startDate: { lte: end }, endDate: { gte: start } },
    select: { id: true },
  });

  const recent = await prisma.activityRecord.findMany({
    where: {
      organizationId: orgId,
      reviewStatus: { not: "rejected" },
      OR: [
        { activityDate: { gte: windowStart, lte: end } },
        { endDate: { gte: windowStart, lte: end } },
      ],
    },
    select: { facilityId: true, emissionCategoryId: true, activityDate: true, startDate: true, endDate: true, evidenceStatus: true },
    take: 50_000,
  });

  const missing = findMissingSources(
    recent.map((r) => ({ facilityId: r.facilityId, categoryId: r.emissionCategoryId, months: monthsCovered(r) })),
    month,
  );
  const [facilities, categories] = missing.length
    ? await Promise.all([
        prisma.facility.findMany({ where: { organizationId: orgId, id: { in: [...new Set(missing.map((x) => x.facilityId))] } }, select: { id: true, name: true } }),
        prisma.emissionCategory.findMany({ where: { id: { in: [...new Set(missing.map((x) => x.categoryId))] } }, select: { id: true, name: true } }),
      ])
    : [[], []];
  const facilityName = new Map(facilities.map((f) => [f.id, f.name]));
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));

  const inMonth = recent.filter((r) => monthsCovered(r).includes(month));

  const [submissions, inReview, imports, bills, ledger, lastRun, approvedCount] = await Promise.all([
    prisma.fieldSubmission.count({ where: { organizationId: orgId, status: { in: ["pending", "submitted", "under_review", "needs_info"] } } }),
    prisma.activityRecord.count({ where: { organizationId: orgId, reviewStatus: "in_review" } }),
    prisma.importBatch.count({ where: { organizationId: orgId, state: { in: ["needs_attention", "ready_to_commit"] } } }),
    prisma.billInboxItem.count({ where: { organizationId: orgId, status: "pending" } }),
    prisma.xeroSyncLog.count({ where: { organizationId: orgId, status: "processed" } }),
    period
      ? prisma.calculationRun.findFirst({
          where: { organizationId: orgId, reportingPeriodId: period.id, status: "succeeded" },
          orderBy: { finishedAt: "desc" },
          select: { finishedAt: true },
        })
      : Promise.resolve(null),
    period ? prisma.activityRecord.count({ where: { organizationId: orgId, reportingPeriodId: period.id, reviewStatus: "approved" } }) : Promise.resolve(0),
  ]);

  const changed =
    period && lastRun?.finishedAt
      ? await prisma.activityRecord.count({
          where: { organizationId: orgId, reportingPeriodId: period.id, reviewStatus: "approved", updatedAt: { gt: lastRun.finishedAt } },
        })
      : 0;

  return buildChecklist({
    month,
    hasPeriod: !!period,
    missingSources: missing.map((x) => ({
      facility: facilityName.get(x.facilityId) ?? "a site",
      category: categoryName.get(x.categoryId) ?? "A source",
      seenIn: x.seenIn,
    })),
    fieldSubmissionsWaiting: submissions,
    recordsInReview: inReview,
    importsWaiting: imports,
    billsInInbox: bills,
    ledgerLinesWaiting: ledger,
    recordsWithoutEvidence: inMonth.filter((r) => r.evidenceStatus === "missing").length,
    approvedChangedSinceRun: changed,
    hasRun: !!lastRun,
    hasApprovedRecords: approvedCount > 0,
  });
}
