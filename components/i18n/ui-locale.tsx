"use client";

import { useCallback, useEffect, useState } from "react";
import { UI_LOCALE_COOKIE, dirOf, resolveUiLocale, t as translate, type MessageKey, type UiLocale } from "@/lib/i18n/ui-locale";

const ARABIC_ENABLED = process.env.NEXT_PUBLIC_ENABLE_ARABIC_UI === "true";

function readCookie(): string | null {
  try {
    return document.cookie.split("; ").find((c) => c.startsWith(`${UI_LOCALE_COOKIE}=`))?.split("=")[1] ?? null;
  } catch {
    return null;
  }
}

/** The screen language, kept in a cookie and mirrored onto <html lang dir>. English until the client has read it. */
export function useUiLocale() {
  const [locale, setLocaleState] = useState<UiLocale>("en");

  useEffect(() => {
    const l = resolveUiLocale(readCookie(), ARABIC_ENABLED);
    setLocaleState(l);
    document.documentElement.lang = l;
    document.documentElement.dir = dirOf(l);
  }, []);

  const setLocale = useCallback((l: UiLocale) => {
    document.cookie = `${UI_LOCALE_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
    setLocaleState(l);
    document.documentElement.lang = l;
    document.documentElement.dir = dirOf(l);
  }, []);

  return { locale, setLocale, t: (key: MessageKey) => translate(locale, key), arabicEnabled: ARABIC_ENABLED };
}

/** A one-line switch between English and Arabic; renders nothing unless Arabic is enabled. */
export function LanguageSwitch({ locale, setLocale }: { locale: UiLocale; setLocale: (l: UiLocale) => void }) {
  if (!ARABIC_ENABLED) return null;
  const next: UiLocale = locale === "ar" ? "en" : "ar";
  return (
    <button type="button" onClick={() => setLocale(next)} className="text-xs text-white/60 underline underline-offset-4 hover:text-white" lang={next}>
      {next === "ar" ? "العربية" : "English"}
    </button>
  );
}
