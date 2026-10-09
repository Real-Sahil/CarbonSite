/**
 * England's public register of waste carriers, brokers and dealers (Environment Agency, "Public
 * Registers Online" API, no key). A registration number is looked up and the holder, tier and expiry
 * are reported back. Used under the Environment Agency Conditional Licence: commercial reuse is
 * allowed with the attribution below, and nothing here implies the Agency endorses MetricOra or
 * has checked a transfer note. Scotland (SEPA), Wales (NRW) and Northern Ireland keep their own
 * registers, so a number in another format is "not checked", never "invalid".
 */
export const REGISTER_ATTRIBUTION = "Contains Environment Agency information © Environment Agency and/or database right";
export const REGISTER_LICENCE_URL = "https://www.gov.uk/government/publications/environment-agency-conditional-licence/environment-agency-conditional-licence";
// Overridable only so a local stand-in can answer in tests and offline environments; production uses the Environment Agency.
const ENDPOINT = process.env.CARRIER_REGISTER_URL ?? "https://environment.data.gov.uk/public-register/waste-carriers-brokers/registration.json";

/** "cbdu 564741" → "CBDU564741"; null when it is not an England carrier number (CBDU or CBDL plus digits). */
export function englandRegistration(raw: string | null | undefined): string | null {
  const r = (raw ?? "").toUpperCase().replace(/[\s-]/g, "");
  return /^CBD[UL]\d{4,7}$/.test(r) ? r : null;
}

export type RegisterResult =
  | { status: "not_checked"; reason: string }
  | { status: "not_found"; registration: string; checkedAt: string }
  | { status: "unavailable"; registration: string; checkedAt: string }
  | {
      status: "registered" | "expired";
      registration: string;
      holder: string | null;
      companyNumber: string | null;
      tier: string | null;
      registrationType: string | null;
      expiryDate: string | null;
      checkedAt: string;
    };

type Item = {
  registrationNumber?: string;
  expiryDate?: string;
  tier?: { label?: string };
  registrationType?: { label?: string };
  holder?: { name?: string; companyNumber?: string };
};

/** Pure: turns the register's JSON into a result. An exact registration-number match is required. */
export function parseRegister(json: unknown, registration: string, now = new Date()): RegisterResult {
  const checkedAt = now.toISOString();
  const items = (json as { items?: Item[] } | null)?.items;
  if (!Array.isArray(items)) return { status: "unavailable", registration, checkedAt };
  const hit = items.find((i) => i.registrationNumber?.toUpperCase() === registration);
  if (!hit) return { status: "not_found", registration, checkedAt };
  const expiry = hit.expiryDate && /^\d{4}-\d{2}-\d{2}$/.test(hit.expiryDate) ? hit.expiryDate : null;
  const expired = expiry != null && new Date(`${expiry}T23:59:59Z`) < now;
  return {
    status: expired ? "expired" : "registered",
    registration,
    holder: hit.holder?.name ?? null,
    companyNumber: hit.holder?.companyNumber ?? null,
    tier: hit.tier?.label ?? null,
    registrationType: hit.registrationType?.label ?? null,
    expiryDate: expiry,
    checkedAt,
  };
}

/** One lookup with a short timeout. Any failure is "unavailable", which a person must not read as "not registered". */
export async function lookupCarrier(rawRegistration: string, fetcher: typeof fetch = fetch): Promise<RegisterResult> {
  const registration = englandRegistration(rawRegistration);
  if (!registration) return { status: "not_checked", reason: "Only England registration numbers (CBDU or CBDL) can be checked here. Scotland, Wales and Northern Ireland keep their own registers." };
  try {
    const res = await fetcher(`${ENDPOINT}?registrationNumber=${encodeURIComponent(registration)}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { status: "unavailable", registration, checkedAt: new Date().toISOString() };
    return parseRegister(await res.json(), registration);
  } catch {
    return { status: "unavailable", registration, checkedAt: new Date().toISOString() };
  }
}
