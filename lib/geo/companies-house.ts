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
export type CompanyProfile = CompanyCandidate & { sicCodes: string[] };

type RawSearchItem = { company_number?: string; title?: string; company_status?: string; address_snippet?: string; address?: { postal_code?: string }; date_of_creation?: string };
type RawCompany = { company_number?: string; company_name?: string; company_status?: string; sic_codes?: string[]; date_of_creation?: string; registered_office_address?: { postal_code?: string; address_line_1?: string; locality?: string } };

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
  };
}

async function get(path: string): Promise<unknown | null> {
  const key = process.env.COMPANIES_HOUSE_API_KEY;
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
