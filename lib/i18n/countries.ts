// Countries an organisation can be based in, with the currency it most likely
// reports in. Used by sign-up and organisation creation so a new organisation
// starts with its own country and currency instead of UK defaults. The
// currency is a suggestion; the person can change it.

export const COUNTRIES: ReadonlyArray<{ code: string; name: string; currency: string }> = [
  { code: "GB", name: "United Kingdom", currency: "GBP" },
  { code: "IE", name: "Ireland", currency: "EUR" },
  { code: "DE", name: "Germany", currency: "EUR" },
  { code: "FR", name: "France", currency: "EUR" },
  { code: "NL", name: "Netherlands", currency: "EUR" },
  { code: "BE", name: "Belgium", currency: "EUR" },
  { code: "LU", name: "Luxembourg", currency: "EUR" },
  { code: "ES", name: "Spain", currency: "EUR" },
  { code: "PT", name: "Portugal", currency: "EUR" },
  { code: "IT", name: "Italy", currency: "EUR" },
  { code: "AT", name: "Austria", currency: "EUR" },
  { code: "FI", name: "Finland", currency: "EUR" },
  { code: "GR", name: "Greece", currency: "EUR" },
  { code: "SE", name: "Sweden", currency: "SEK" },
  { code: "DK", name: "Denmark", currency: "DKK" },
  { code: "NO", name: "Norway", currency: "NOK" },
  { code: "CH", name: "Switzerland", currency: "CHF" },
  { code: "PL", name: "Poland", currency: "PLN" },
  { code: "CZ", name: "Czechia", currency: "CZK" },
  { code: "HU", name: "Hungary", currency: "HUF" },
  { code: "RO", name: "Romania", currency: "RON" },
  { code: "TR", name: "Türkiye", currency: "TRY" },
  { code: "AE", name: "United Arab Emirates", currency: "AED" },
  { code: "SA", name: "Saudi Arabia", currency: "SAR" },
  { code: "QA", name: "Qatar", currency: "QAR" },
  { code: "KW", name: "Kuwait", currency: "KWD" },
  { code: "BH", name: "Bahrain", currency: "BHD" },
  { code: "OM", name: "Oman", currency: "OMR" },
  { code: "US", name: "United States", currency: "USD" },
  { code: "CA", name: "Canada", currency: "CAD" },
  { code: "MX", name: "Mexico", currency: "MXN" },
  { code: "BR", name: "Brazil", currency: "BRL" },
  { code: "AU", name: "Australia", currency: "AUD" },
  { code: "NZ", name: "New Zealand", currency: "NZD" },
  { code: "IN", name: "India", currency: "INR" },
  { code: "SG", name: "Singapore", currency: "SGD" },
  { code: "HK", name: "Hong Kong", currency: "HKD" },
  { code: "JP", name: "Japan", currency: "JPY" },
  { code: "KR", name: "South Korea", currency: "KRW" },
  { code: "CN", name: "China", currency: "CNY" },
  { code: "ZA", name: "South Africa", currency: "ZAR" },
  { code: "NG", name: "Nigeria", currency: "NGN" },
  { code: "KE", name: "Kenya", currency: "KES" },
];

export const CURRENCIES: readonly string[] = [...new Set(COUNTRIES.map((c) => c.currency))].sort();

const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

/** The listed country for an ISO 3166-1 alpha-2 code (any case), or undefined. */
export function countryOf(code: string | null | undefined) {
  return BY_CODE.get((code ?? "").trim().toUpperCase());
}

/** The suggested reporting currency for a country, or undefined when it is not listed. */
export function currencyForCountry(code: string | null | undefined): string | undefined {
  return countryOf(code)?.currency;
}
