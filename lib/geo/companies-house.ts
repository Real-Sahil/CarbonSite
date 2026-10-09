// Supplier lookup on the Companies House public register (free API key, Open Government Licence).
// Only the typed name or company number leaves the server; the key stays here.

const BASE = "https://api.company-information.service.gov.uk";
export const COMPANIES_HOUSE_ATTRIBUTION = "Contains public sector information licensed under the Open Government Licence v3.0. Source: Companies House.";

export class CompaniesHouseUnavailable extends Error {
  constructor(public reason: "no_key" | "unreachable" | `status_${number}`) {
    super(`Companies House unavailable: ${reason}`);
  }
}

export type CompanyCandidate = { number: string; name: string; status: string | null; address: string | null; postcode: string | null; incorporated: string | null };
export type CompanyProfile = CompanyCandidate & {
  sicCodes: string[];
  /** Type of the latest filed accounts (micro-entity, small, full ...), or null when none are filed. */
  accountsType: string | null;
  accountsOverdue: boolean;
  hasInsolvencyHistory: boolean;
  hasCharges: boolean;
  jurisdiction: string | null;
};

type RawSearchItem = { company_number?: string; title?: string; company_status?: string; address_snippet?: string; address?: { postal_code?: string }; date_of_creation?: string };
type RawCompany = { company_number?: string; company_name?: string; company_status?: string; sic_codes?: string[]; date_of_creation?: string; jurisdiction?: string; has_insolvency_history?: boolean; has_charges?: boolean; accounts?: { overdue?: boolean; last_accounts?: { type?: string } }; registered_office_address?: { postal_code?: string; address_line_1?: string; locality?: string } };

export const isCompanyNumber = (s: string) => /^[A-Z0-9]{8}$/.test(s);

/** Search hits to candidates; entries without a number or name are dropped. */
export function toCandidates(json: unknown): CompanyCandidate[] {
  const items = (json as { items?: RawSearchItem[] } | null)?.items;
  if (!Array.isArray(items)) return [];
  return items.flatMap((i) =>
    i.company_number && i.title
      ? [{ number: i.company_number, name: i.title, status: i.company_status ?? null, address: i.address_snippet ?? null, postcode: i.address?.postal_code ?? null, incorporated: i.date_of_creation ?? null }]
      : [],
  );
}

/** One company record to a profile; null when it has no number or name. */
export function toProfile(json: unknown): CompanyProfile | null {
  const c = json as RawCompany | null;
  if (!c?.company_number || !c.company_name) return null;
  const a = c.registered_office_address;
  return {
    number: c.company_number,
    name: c.company_name,
    status: c.company_status ?? null,
    address: [a?.address_line_1, a?.locality, a?.postal_code].filter(Boolean).join(", ") || null,
    postcode: a?.postal_code ?? null,
    incorporated: c.date_of_creation ?? null,
    sicCodes: Array.isArray(c.sic_codes) ? c.sic_codes.filter((s) => /^\d{4,5}$/.test(s)) : [],
    accountsType: c.accounts?.last_accounts?.type && c.accounts.last_accounts.type !== "null" ? c.accounts.last_accounts.type : null,
    accountsOverdue: c.accounts?.overdue === true,
    hasInsolvencyHistory: c.has_insolvency_history === true,
    hasCharges: c.has_charges === true,
    jurisdiction: c.jurisdiction ?? null,
  };
}

export type CompanyFlag = { level: "red" | "amber"; text: string };

/** What a buyer should know before relying on a supplier. Facts from the register, never a score. */
export function companyFlags(p: Pick<CompanyProfile, "status" | "accountsOverdue" | "hasInsolvencyHistory">): CompanyFlag[] {
  const out: CompanyFlag[] = [];
  const status = (p.status ?? "").toLowerCase();
  if (status && status !== "active") out.push({ level: "red", text: `Company is ${status.replace(/-/g, " ")}` });
  if (p.hasInsolvencyHistory) out.push({ level: "amber", text: "Insolvency history on the register" });
  if (p.accountsOverdue) out.push({ level: "amber", text: "Accounts overdue" });
  return out;
}

const SME_LIKELY = new Set(["micro-entity", "small", "total-exemption-small", "unaudited-abridged", "medium"]);

/**
 * A hint only: filing small or medium accounts suggests an SME, but a small company can sit inside a large
 * group and the legal test also counts staff and group links. Returns null when the filing says nothing either way.
 */
export function smeHint(accountsType: string | null): string | null {
  if (!accountsType || !SME_LIKELY.has(accountsType)) return null;
  return `Files ${accountsType.replace(/-/g, " ")} accounts, which suggests an SME. Check it is not part of a large group before ticking SME.`;
}

export type CorporateOwner = { name: string; number: string | null; sharesBand: string | null };

/**
 * Companies that hold significant control of this one (company to company only; people are never read).
 * Ceased entries are dropped. The band is Companies House's own share range, e.g. "75-100".
 */
export function toCorporateOwners(json: unknown): CorporateOwner[] {
  const items = (json as { items?: Array<{ kind?: string; name?: string; ceased_on?: string; ceased?: boolean; natures_of_control?: string[]; identification?: { registration_number?: string } }> } | null)?.items;
  if (!Array.isArray(items)) return [];
  return items.flatMap((i) => {
    if (i.kind !== "corporate-entity-person-with-significant-control" || !i.name || i.ceased_on || i.ceased) return [];
    const band = (i.natures_of_control ?? []).map((n) => /^ownership-of-shares-(\d+)-to-(\d+)-percent/.exec(n)).find(Boolean);
    return [{ name: i.name, number: i.identification?.registration_number ?? null, sharesBand: band ? `${band[1]}-${band[2]}` : null }];
  });
}

async function get(path: string): Promise<unknown | null> {
  const key = process.env.COMPANIES_HOUSE_API_KEY?.trim();
  if (!key) throw new CompaniesHouseUnavailable("no_key");
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}` }, signal: AbortSignal.timeout(8000), cache: "no-store" });
  } catch {
    throw new CompaniesHouseUnavailable("unreachable");
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new CompaniesHouseUnavailable(`status_${res.status}`);
  return res.json();
}

export async function searchCompanies(q: string): Promise<CompanyCandidate[]> {
  return toCandidates(await get(`/search/companies?q=${encodeURIComponent(q)}&items_per_page=6`));
}

export async function getCompany(number: string): Promise<CompanyProfile | null> {
  return toProfile(await get(`/company/${encodeURIComponent(number)}`));
}

export async function getCorporateOwners(number: string): Promise<CorporateOwner[]> {
  return toCorporateOwners(await get(`/company/${encodeURIComponent(number)}/persons-with-significant-control?items_per_page=50`));
}

export type CompanyCheck = { number: string; status: string | null; accountsType: string | null; accountsOverdue: boolean; hasInsolvencyHistory: boolean; sicCodes: string[]; flags: CompanyFlag[]; smeHint: string | null; checkedAt: string };

/** What is kept on a supplier after picking or re-checking it: register facts and the date they were read. */
export function companyCheckOf(p: CompanyProfile, now = new Date()): CompanyCheck {
  return { number: p.number, status: p.status, accountsType: p.accountsType, accountsOverdue: p.accountsOverdue, hasInsolvencyHistory: p.hasInsolvencyHistory, sicCodes: p.sicCodes, flags: companyFlags(p), smeHint: smeHint(p.accountsType), checkedAt: now.toISOString() };
}
