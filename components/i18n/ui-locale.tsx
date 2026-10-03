"use client";

import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { UI_LOCALE_COOKIE, type UiLocale } from "@/lib/i18n/ui-locale";

const ARABIC_ENABLED = process.env.NEXT_PUBLIC_ENABLE_ARABIC_UI === "true";

/** A one-line switch between English and Arabic; renders nothing unless Arabic is enabled. Sets the cookie and reloads the server data. */
export function LanguageSwitch() {
  const locale = useLocale() as UiLocale;
  const router = useRouter();
  if (!ARABIC_ENABLED) return null;
  const next: UiLocale = locale === "ar" ? "en" : "ar";
  return (
    <button
      type="button"
      lang={next}
      className="text-xs text-white/60 underline underline-offset-4 hover:text-white"
      onClick={() => {
        document.cookie = `${UI_LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
        router.refresh();
      }}
    >
      {next === "ar" ? "العربية" : "English"}
    </button>
  );
}
