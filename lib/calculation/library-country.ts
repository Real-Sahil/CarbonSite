// Which country a factor library is written for. A run is pinned to one
// library, so an organisation based in one country running on another
// country's library prices its grid electricity, fuels and waste with the
// wrong national factors. That is sometimes deliberate (EPA for US
// operations), so it needs a confirmation rather than a hard stop.

import { countryIso2 } from "./geography";

const LIBRARY_COUNTRY: Array<[RegExp, string]> = [
  [/^DEFRA\b/i, "GB"],
  [/^Defra UK spend/i, "GB"],
  [/^EPA\b/i, "US"],
  [/^ADEME\b/i, "FR"],
];

export function libraryCountry(libraryName: string): string | null {
  return LIBRARY_COUNTRY.find(([re]) => re.test(libraryName))?.[1] ?? null;
}

/** A message when the library is written for another country than the organisation's, else null. */
export function libraryCountryMismatch(libraryName: string, orgCountry: string | null | undefined): string | null {
  const lib = libraryCountry(libraryName);
  const org = countryIso2(orgCountry);
  if (!lib || !org || lib === org) return null;
  return (
    `${libraryName} is written for ${lib}, but this organisation is based in ${org}. ` +
    `Its national factors (grid electricity, fuels, waste) will be used for every record that has no organisation factor. ` +
    `Continue only if these operations are in ${lib}.`
  );
}
