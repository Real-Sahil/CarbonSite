/**
 * England's public registers of waste permits (Environmental Permitting Regulations, waste operations)
 * and waste exemptions, from the same Environment Agency "Public Registers Online" API and licence as the
 * carrier register (attribution in carrier-register.ts). A permit or exemption number is looked up and the
 * holder, site and status come back. It does not list which waste codes a permit covers, so a person still
 * checks that the site may take this waste. Wales, Scotland and Northern Ireland keep their own registers.
 */
const BASE = "https://environment.data.gov.uk/public-register";

export type PermitKind = "site_permit" | "exemption";

export type PermitResult =
  | { status: "not_checked"; reason: string }
  | { status: "not_found" | "unavailable"; reference: string; checkedAt: string }
  | {
      status: "effective" | "not_effective";
      reference: string;
      holder: string | null;
      site: string | null;
      siteType: string | null;
      /** The register's own wording for a permit ("Effective", "Surrendered"...). */
      registerStatus: string | null;
      /** Exemptions: the codes held, e.g. T11. */
      codes: string[];
      expiryDate: string | null;
      checkedAt: string;
    };

/** "epr/ab1234cd" → "AB1234CD"; "exp-ap3041yf" → "EXP/AP3041YF"; null when it is not the shape of an England permit or exemption number. */
export function permitReference(raw: string | null | undefined, kind: PermitKind): string | null {
  const r = (raw ?? "").toUpperCase().replace(/\s+/g, "");
  if (kind === "exemption") {
    const m = r.match(/^EXP[/-]([A-Z]{2}\d{4}[A-Z]{2})$/);
    return m ? `EXP/${m[1]}` : null;
  }
  const m = r.match(/^(?:EPR[/-])?([A-Z]{2}\d{4}[A-Z]{2})$/);
  return m ? m[1] : null;
}

type Item = {
  registrationNumber?: string;
  holder?: { name?: string };
  status?: { comment?: string };
  site?: unknown;
  exemption?: { expiryDate?: string; registrationType?: { notation?: string } }[];
};
type SiteInfo = { premises?: string; siteAddress?: { address?: string }; siteType?: { description?: string } };

/** Pure: an exact reference match is required. An exemption is in force while any of its codes has not expired. */
export function parsePermit(json: unknown, reference: string, now = new Date()): PermitResult {
  const checkedAt = now.toISOString();
  const items = (json as { items?: Item[] } | null)?.items;
  if (!Array.isArray(items)) return { status: "unavailable", reference, checkedAt };
  const hit = items.find((i) => i.registrationNumber?.toUpperCase() === reference);
  if (!hit) return { status: "not_found", reference, checkedAt };
  const siteRaw = Array.isArray(hit.site) ? hit.site[0] : hit.site;
  const site = (siteRaw ?? {}) as SiteInfo;
  const exemptions = hit.exemption ?? [];
  const expiries = exemptions.map((e) => e.expiryDate).filter((d): d is string => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  const expiryDate = expiries.length ? expiries[expiries.length - 1] : null;
  const registerStatus = hit.status?.comment ?? null;
  const inForce = exemptions.length > 0 ? expiryDate == null || new Date(`${expiryDate}T23:59:59Z`) >= now : registerStatus?.toLowerCase() === "effective";
  return {
    status: inForce ? "effective" : "not_effective",
    reference,
    holder: hit.holder?.name ?? null,
    site: site.premises ?? site.siteAddress?.address ?? null,
    siteType: site.siteType?.description ?? null,
    registerStatus,
    codes: exemptions.map((e) => e.registrationType?.notation).filter((c): c is string => !!c),
    expiryDate,
    checkedAt,
  };
}

/** One lookup with a short timeout. Any failure is "unavailable", which a person must not read as "no permit". */
export async function lookupPermit(kind: PermitKind, raw: string, fetcher: typeof fetch = fetch): Promise<PermitResult> {
  const reference = permitReference(raw, kind);
  if (!reference) return { status: "not_checked", reason: kind === "exemption" ? "Only England exemption numbers (EXP/ then two letters, four digits, two letters) can be checked here." : "Only England permit numbers (two letters, four digits, two letters, e.g. AB1234CD) can be checked here. Wales, Scotland and Northern Ireland keep their own registers." };
  const register = kind === "exemption" ? "waste-exemptions" : "waste-operations";
  try {
    const res = await fetcher(`${BASE}/${register}/registration.json?registrationNumber=${encodeURIComponent(reference)}`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { status: "unavailable", reference, checkedAt: new Date().toISOString() };
    return parsePermit(await res.json(), reference);
  } catch {
    return { status: "unavailable", reference, checkedAt: new Date().toISOString() };
  }
}
