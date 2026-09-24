// The country a record's factor is matched on. Library factors carry ISO
// 3166-1 alpha-2 codes, while records, facilities and organisations hold
// whatever the user typed ("UK", "United Kingdom", "gb"). A record with no
// country of its own takes its facility's, then the organisation's, so a UK
// organisation's electricity is never priced with another country's grid
// factor just because the record form left the country blank.

const ALIASES: Record<string, string> = {
  UK: "GB",
  "GREAT BRITAIN": "GB",
  BRITAIN: "GB",
  ENGLAND: "GB",
  SCOTLAND: "GB",
  WALES: "GB",
  "NORTHERN IRELAND": "GB",
  "UNITED KINGDOM": "GB",
  "UNITED STATES": "US",
  "UNITED STATES OF AMERICA": "US",
  USA: "US",
};

let byName: Map<string, string> | null = null;

function nameIndex(): Map<string, string> {
  if (byName) return byName;
  byName = new Map();
  const en = new Intl.DisplayNames(["en"], { type: "region" });
  for (let a = 65; a <= 90; a++) {
    for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a, b);
      let name: string | undefined;
      try {
        if (Intl.getCanonicalLocales(`und-${code}`)[0] !== `und-${code}`) continue;
        name = en.of(code);
      } catch {
        continue;
      }
      if (name && name !== code) byName.set(name.toUpperCase(), code);
    }
  }
  return byName;
}

/** ISO alpha-2 code for a country code or English name, or null. */
export function countryIso2(value: string | null | undefined): string | null {
  const v = value?.trim().toUpperCase();
  if (!v) return null;
  if (ALIASES[v]) return ALIASES[v];
  if (/^[A-Z]{2}$/.test(v)) return v;
  return nameIndex().get(v) ?? null;
}

/** First usable country of the record, its facility, then the organisation. */
export function recordCountry(...candidates: Array<string | null | undefined>): string | null {
  for (const c of candidates) {
    const iso = countryIso2(c);
    if (iso) return iso;
  }
  return null;
}
