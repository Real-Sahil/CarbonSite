// The language of the app's own screens (not the number and date formatting,
// which follows the organisation's country; see org-format.ts). English is the
// default. Arabic is a pilot on the sign-in screen: its wording has not had a
// native review, so it only appears when NEXT_PUBLIC_ENABLE_ARABIC_UI is "true".
// The strings live in messages/<locale>.json and are served by next-intl in
// its no-routing mode (i18n/request.ts), so URLs and static pages are unchanged.

export const UI_LOCALES = ["en", "ar"] as const;
export type UiLocale = (typeof UI_LOCALES)[number];
export const UI_LOCALE_COOKIE = "ui_lang";

export const dirOf = (l: UiLocale): "ltr" | "rtl" => (l === "ar" ? "rtl" : "ltr");

/** The locale a stored value names; English for anything unknown or when Arabic is not enabled. */
export function resolveUiLocale(value: string | null | undefined, arabicEnabled: boolean): UiLocale {
  return value === "ar" && arabicEnabled ? "ar" : "en";
}

export type Messages = { [key: string]: string | Messages };

/** `over` laid on `base`, key by key, so a string missing from a translation shows in English. */
export function mergeMessages(base: Messages, over: Messages): Messages {
  const out: Messages = { ...base };
  for (const [k, v] of Object.entries(over)) {
    const b = base[k];
    out[k] = typeof v === "object" && typeof b === "object" ? mergeMessages(b, v) : v;
  }
  return out;
}
