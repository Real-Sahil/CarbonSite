/**
 * Find a Tender (UK public procurement notices, find-tender.service.gov.uk).
 *
 * The service publishes every notice as an OCDS release through a public API
 * with no key: one notice by id, or a page of releases changed in a period.
 * Reading notices needs no account and sends nothing about the organisation.
 * Responses were checked against the live API on 26 September 2026
 * (fixtures in __tests__).
 */

const BASE = "https://www.find-tender.service.gov.uk";

/** Who may see matched tenders: the inventory readers plus contract and operations managers. */
export const TENDER_READERS = [
  "admin", "sustainability_director", "sustainability_manager", "editor", "reviewer", "viewer", "auditor",
  "contract_manager", "operations_manager",
] as import("@prisma/client").OrgRole[];
/** Who may change the watch and triage tenders. */
export const TENDER_EDITORS = ["admin", "sustainability_director", "sustainability_manager", "editor", "contract_manager"] as import("@prisma/client").OrgRole[];
const UA = { "User-Agent": "MetricOra (+https://www.metricora.co.uk)", Accept: "application/json" };

type Value = { amount?: number; currency?: string };
type Classification = { scheme?: string; id?: string; description?: string };
type Period = { startDate?: string; endDate?: string; durationInDays?: number };

export type OcdsRelease = {
  ocid: string;
  id: string;
  date?: string;
  tag?: string[];
  tender?: {
    id?: string;
    title?: string;
    status?: string;
    value?: Value;
    classification?: Classification;
    items?: { additionalClassifications?: Classification[]; deliveryAddresses?: { region?: string }[] }[];
    tenderPeriod?: Period;
    contractPeriod?: Period;
    lots?: { value?: Value; contractPeriod?: Period }[];
  };
  parties?: { id?: string; name?: string; roles?: string[]; details?: { classifications?: Classification[] } }[];
  buyer?: { id?: string; name?: string };
  awards?: { value?: Value; suppliers?: { id?: string; name?: string }[]; contractPeriod?: Period }[];
  contracts?: { value?: Value; period?: Period; dateSigned?: string }[];
};

/** "091200-2026", or a Find a Tender notice URL containing it. */
export function parseNoticeId(input: string): string | null {
  const m = String(input ?? "").match(/\b(\d{6}-\d{4})\b/);
  return m ? m[1] : null;
}

export const noticeUrl = (noticeId: string) => `${BASE}/Notice/${noticeId}`;

export type NoticeSummary = {
  noticeId: string;
  ocid: string;
  stage: "tender" | "award" | "other";
  title: string;
  buyerName: string | null;
  buyerType: string | null;
  value: number | null;
  currency: string | null;
  cpvCodes: string[];
  regions: string[];
  deadline: Date | null;
  publishedAt: Date;
  contractStart: Date | null;
  contractEnd: Date | null;
  tenderReference: string | null;
  suppliers: string[];
};

const date = (s?: string) => {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};
const uniq = (a: string[]) => [...new Set(a.filter(Boolean))];

export function summariseRelease(r: OcdsRelease): NoticeSummary {
  const t = r.tender ?? {};
  const tags = r.tag ?? [];
  const stage =
    tags.includes("award") || tags.includes("contract")
      ? "award"
      : tags.includes("tender") || tags.includes("tenderUpdate")
        ? "tender"
        : "other";
  const buyer = (r.parties ?? []).find((p) => p.roles?.includes("buyer"));
  // Procurement Act 2023 notices classify the buyer under UK_CA_TYPE; older
  // (PCR 2015) notices under TED_CA_TYPE.
  const cls = buyer?.details?.classifications ?? [];
  const buyerType = cls.find((c) => c.scheme === "UK_CA_TYPE" && c.id)?.id ?? cls.find((c) => c.scheme === "TED_CA_TYPE" && c.id)?.id ?? null;

  // Awarded value: the signed contracts, else the awards; otherwise the
  // tender's estimate, else the sum of its lots.
  const sum = (vals: (Value | undefined)[]) => {
    const withAmount = vals.filter((v): v is Value & { amount: number } => typeof v?.amount === "number");
    return withAmount.length ? { amount: withAmount.reduce((a, v) => a + v.amount, 0), currency: withAmount[0].currency ?? null } : null;
  };
  const value =
    (stage === "award" ? sum((r.contracts ?? []).map((c) => c.value)) ?? sum((r.awards ?? []).map((a) => a.value)) : null) ??
    (typeof t.value?.amount === "number" ? { amount: t.value.amount, currency: t.value.currency ?? null } : null) ??
    sum((t.lots ?? []).map((l) => l.value));

  const period = r.contracts?.find((c) => c.period)?.period ?? r.awards?.find((a) => a.contractPeriod)?.contractPeriod ?? t.contractPeriod ?? t.lots?.find((l) => l.contractPeriod)?.contractPeriod;
  const start = date(period?.startDate);
  const end = date(period?.endDate) ?? (start && period?.durationInDays ? new Date(start.getTime() + period.durationInDays * 86_400_000) : null);

  return {
    noticeId: r.id,
    ocid: r.ocid,
    stage,
    title: (t.title ?? "").trim() || `Notice ${r.id}`,
    buyerName: r.buyer?.name ?? buyer?.name ?? null,
    buyerType,
    value: value?.amount ?? null,
    currency: value?.currency ?? null,
    cpvCodes: uniq([
      t.classification?.scheme === "CPV" ? (t.classification.id ?? "") : "",
      ...(t.items ?? []).flatMap((i) => (i.additionalClassifications ?? []).filter((c) => c.scheme === "CPV").map((c) => c.id ?? "")),
    ]),
    regions: uniq((t.items ?? []).flatMap((i) => (i.deliveryAddresses ?? []).map((a) => a.region ?? ""))),
    deadline: date(t.tenderPeriod?.endDate),
    publishedAt: date(r.date) ?? new Date(),
    contractStart: start,
    contractEnd: end,
    tenderReference: t.id ?? null,
    suppliers: uniq((r.awards ?? []).flatMap((a) => (a.suppliers ?? []).map((s) => s.name ?? ""))),
  };
}

// ── Requirements a bid will meet ────────────────────────────────────────────

/**
 * Buyer types that are central government: the buyer's own classification on
 * the notice (UK_CA_TYPE under the Procurement Act 2023, TED_CA_TYPE before).
 * Buyers sometimes misclassify themselves, so flags say "likely".
 */
const CENTRAL = new Set(["publicAuthorityCentralGovernment", "MINISTRY", "NATIONAL_AGENCY"]);
const PPN026_FROM = new Date("2027-01-01T00:00:00Z");

export type TenderFlag = { code: "crp" | "social_value"; level: "likely" | "possible"; label: string; reason: string };

/**
 * What the notice suggests the bid will need. "Likely" rests on the buyer
 * being central government and the value; the tender documents decide, so
 * every flag says why it was raised.
 */
export function tenderFlags(n: NoticeSummary): TenderFlag[] {
  const flags: TenderFlag[] = [];
  const central = n.buyerType != null && CENTRAL.has(n.buyerType);
  const gbp = n.currency == null || n.currency === "GBP" ? n.value : null;
  const years =
    n.contractStart && n.contractEnd ? Math.max((n.contractEnd.getTime() - n.contractStart.getTime()) / (365.25 * 86_400_000), 1) : null;
  const perYear = gbp != null && years ? gbp / years : null;

  if (central && gbp != null && (perYear ?? gbp) > 5_000_000) {
    flags.push({
      code: "crp",
      level: "likely",
      label: "Carbon Reduction Plan (PPN 006)",
      reason: `The buyer classes itself as central government and the contract is ${perYear != null ? "over £5m a year" : "over £5m (length not given)"}: PPN 006 asks central government buyers to require a Carbon Reduction Plan.`,
    });
  } else if (gbp != null && gbp > 5_000_000) {
    flags.push({
      code: "crp",
      level: "possible",
      label: "Carbon Reduction Plan",
      reason: "Over £5m. PPN 006 binds central government buyers only, but many other public buyers ask for a Carbon Reduction Plan too.",
    });
  }
  if (central) {
    const ppn026 = n.publishedAt >= PPN026_FROM;
    if (!ppn026 || gbp == null || gbp >= 1_000_000) {
      flags.push({
        code: "social_value",
        level: "likely",
        label: ppn026 ? "Social value (PPN 026 model)" : "Social value (PPN 002)",
        reason: ppn026
          ? "Central government procurement from 1 January 2027 of £1m or more: the PPN 026 Social Value Model applies (minimum 10% weighting, 20% at £5m or more)."
          : "Central government buyer: social value is evaluated under PPN 002 (PPN 026 applies to procurements from 1 January 2027).",
      });
    }
  }
  return flags;
}

// ── Watches ─────────────────────────────────────────────────────────────────

export type WatchCriteria = { cpvPrefixes: string[]; regions: string[]; keywords: string[]; minValue: number | null };

/**
 * Why a notice matches a watch, or null. A notice matches on a CPV prefix or
 * a title keyword, then must be in one of the regions (a notice naming no
 * region is kept) and not below the minimum value (an unknown value is kept).
 */
export function matchWatch(n: NoticeSummary, w: WatchCriteria): string | null {
  const cpv = w.cpvPrefixes.map((p) => p.replace(/\D/g, "")).filter(Boolean).find((p) => n.cpvCodes.some((c) => c.startsWith(p)));
  const title = n.title.toLowerCase();
  const keyword = w.keywords.map((k) => k.trim().toLowerCase()).filter((k) => k.length >= 3).find((k) => title.includes(k));
  if (!cpv && !keyword) return null;
  if (w.regions.length && n.regions.length && !n.regions.some((r) => w.regions.some((p) => r.toUpperCase().startsWith(p.toUpperCase())))) return null;
  if (w.minValue != null && n.value != null && n.value < w.minValue) return null;
  return cpv ? `CPV ${cpv}` : `"${keyword}" in the title`;
}

// ── API ─────────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Pause between pages, to stay under Find a Tender's rate limit. */
const PAGE_PAUSE_MS = 300;

export class FtsRateLimited extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super(`Find a Tender is rate limiting requests; try again in ${retryAfterSeconds} seconds.`);
  }
}

/**
 * Find a Tender rate-limits bursts with a plain-text 429 and Retry-After
 * (120 s seen on 26 September 2026). A short wait is retried; a long one is
 * reported, and the next daily run picks up from the last complete check.
 */
async function getJson(url: string, attempt = 0): Promise<unknown> {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20_000), cache: "no-store" });
  if (res.status === 429) {
    const wait = Number(res.headers.get("retry-after")) || 5 * (attempt + 1);
    if (wait > 10 || attempt >= 2) throw new FtsRateLimited(wait);
    await sleep(wait * 1000);
    return getJson(url, attempt + 1);
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Find a Tender answered ${res.status}`);
  return res.json();
}

/** One notice, or null when Find a Tender has no such notice. */
export async function fetchNotice(noticeId: string): Promise<OcdsRelease | null> {
  const pkg = (await getJson(`${BASE}/api/1.0/ocdsReleasePackages/${encodeURIComponent(noticeId)}`)) as { releases?: OcdsRelease[] } | null;
  return pkg?.releases?.[0] ?? null;
}

/**
 * Tender releases (new and updated) published between two times, page by
 * page. The API's own stages=tender filter was found on 26 September 2026 to
 * return about a tenth of them, so every release is read and filtered here
 * (about 2,300 releases a week in 100-release pages).
 */
export async function* fetchTenderReleases(from: Date, to: Date, maxPages = 60): AsyncGenerator<OcdsRelease> {
  const iso = (d: Date) => d.toISOString().slice(0, 19);
  let url: string | null = `${BASE}/api/1.0/ocdsReleasePackages?limit=100&updatedFrom=${iso(from)}&updatedTo=${iso(to)}`;
  for (let page = 0; url && page < maxPages; page++) {
    const pkg = (await getJson(url)) as { releases?: OcdsRelease[]; links?: { next?: string } } | null;
    for (const r of pkg?.releases ?? []) {
      if (r.tag?.includes("tender") || r.tag?.includes("tenderUpdate")) yield r;
    }
    const next = pkg?.links?.next;
    url = next && (pkg?.releases?.length ?? 0) > 0 && next.startsWith(BASE) ? next : null;
    if (url) await sleep(PAGE_PAUSE_MS);
  }
}


