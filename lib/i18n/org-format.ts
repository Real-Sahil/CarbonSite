// Number, date and money formatting for an organisation, from its HQ country
// and reporting currency, so a report reads naturally wherever the customer
// is: 1,234.5 or 1.234,5, 3 October or October 3. The report text itself is
// English; only the formatting follows the organisation.

/** HQ country (ISO 3166-1 alpha-2) to the BCP 47 locale its people expect numbers and dates in. */
const COUNTRY_LOCALE: Record<string, string> = {
  GB: "en-GB", IE: "en-IE", US: "en-US", CA: "en-CA", AU: "en-AU", NZ: "en-NZ", ZA: "en-ZA", IN: "en-IN", SG: "en-SG", HK: "en-HK",
  AE: "en-AE", NG: "en-NG", KE: "en-KE", PH: "en-PH", MY: "en-MY",
  DE: "de-DE", AT: "de-AT", CH: "de-CH", FR: "fr-FR", BE: "fr-BE", LU: "fr-LU", ES: "es-ES", MX: "es-MX", AR: "es-AR", CL: "es-CL", CO: "es-CO",
  IT: "it-IT", PT: "pt-PT", BR: "pt-BR", NL: "nl-NL", SE: "sv-SE", DK: "da-DK", NO: "nb-NO", FI: "fi-FI", PL: "pl-PL", CZ: "cs-CZ", HU: "hu-HU",
  RO: "ro-RO", GR: "el-GR", TR: "tr-TR", JP: "ja-JP", KR: "ko-KR", CN: "zh-CN", TW: "zh-TW", TH: "th-TH", VN: "vi-VN", ID: "id-ID",
};

export const DEFAULT_LOCALE = "en-GB";

/** The locale for an HQ country; English (UK) when the country is unknown, unset or not listed. */
export function localeForCountry(country: string | null | undefined): string {
  return COUNTRY_LOCALE[(country ?? "").trim().toUpperCase()] ?? DEFAULT_LOCALE;
}

/** The symbol people write for a currency in a locale: "£", "$", "€", "A$" in en-US, "CHF" where there is none. */
export function currencySymbol(currency: string, locale: string = DEFAULT_LOCALE): string {
  try {
    const part = new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "narrowSymbol" })
      .formatToParts(0)
      .find((p) => p.type === "currency");
    return part?.value ?? currency;
  } catch {
    return currency;
  }
}

/** Money in a currency and locale; `decimals` 0 for rounded figures, 2 for invoice lines. */
export function formatMoney(n: number, currency: string, locale: string = DEFAULT_LOCALE, decimals = 0): string {
  try {
    return n.toLocaleString(locale, { style: "currency", currency, minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  } catch {
    return `${currency} ${n.toLocaleString(DEFAULT_LOCALE, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
  }
}

export type OrgFormat = { locale: string; currency: string };

export function orgFormat(org: { hqCountry?: string | null; reportingCurrency?: string | null }): OrgFormat {
  const currency = /^[A-Za-z]{3}$/.test(org.reportingCurrency ?? "") ? org.reportingCurrency!.toUpperCase() : "GBP";
  return { locale: localeForCountry(org.hqCountry), currency };
}

export type Formatters = {
  /** A long date: 3 October 2026 or October 3, 2026. */
  date: (d: Date) => string;
  /** A number with a fixed number of decimals in the organisation's locale. */
  number: (n: number, maxDecimals?: number, minDecimals?: number) => string;
  /** Tonnes and similar: two decimals under 10, one above. */
  tonnes: (n: number) => string;
  /** Money in the given currency (the organisation's reporting currency by default), no decimals. */
  money: (n: number, currency?: string) => string;
  percent: (fraction: number, decimals?: number) => string;
};

export function formatters(f: OrgFormat): Formatters {
  const safe = <T>(fn: () => T, fallback: () => T): T => {
    try {
      return fn();
    } catch {
      return fallback();
    }
  };
  const number = (n: number, maxDecimals = 1, minDecimals = 0) =>
    safe(
      () => n.toLocaleString(f.locale, { minimumFractionDigits: minDecimals, maximumFractionDigits: maxDecimals }),
      () => n.toLocaleString(DEFAULT_LOCALE, { minimumFractionDigits: minDecimals, maximumFractionDigits: maxDecimals }),
    );
  return {
    date: (d) => safe(() => d.toLocaleDateString(f.locale, { day: "numeric", month: "long", year: "numeric" }), () => d.toISOString().slice(0, 10)),
    number,
    tonnes: (n) => number(n, n < 10 ? 2 : 1, 1),
    money: (n, currency = f.currency) =>
      safe(
        () => n.toLocaleString(f.locale, { style: "currency", currency, maximumFractionDigits: 0 }),
        () => `${currency} ${Math.round(n).toLocaleString(DEFAULT_LOCALE)}`,
      ),
    percent: (fraction, decimals = 1) => `${number(fraction * 100, decimals, decimals)}%`,
  };
}
