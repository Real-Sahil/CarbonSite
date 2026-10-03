// The number and date locale a report prints in. Report templates are pure
// synchronous functions, so the registry wraps the render call in
// withLocale(), and the formatting helpers read loc(). UK-form reports (PPN 006,
// SECR, PPN 06/21, National TOMs, NHS Evergreen, the bid pack) never set it:
// their readers are UK buyers and regulators, so they stay en-GB.

import { DEFAULT_LOCALE, localeForCountry } from "@/lib/i18n/org-format";

let current = DEFAULT_LOCALE;

export const loc = () => current;

/** Runs a synchronous render with the organisation's locale, then restores the previous one. */
export function withLocale<T>(hqCountry: string | null | undefined, render: () => T): T {
  const previous = current;
  current = localeForCountry(hqCountry);
  try {
    return render();
  } finally {
    current = previous;
  }
}
