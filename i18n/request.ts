import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { UI_LOCALE_COOKIE, mergeMessages, resolveUiLocale, type Messages } from "@/lib/i18n/ui-locale";
import en from "../messages/en.json";

// next-intl without URL routing: the language is the ui_lang cookie, so no
// middleware runs and static pages stay static. Only layouts that render a
// NextIntlClientProvider (the sign-in group) read it.
export default getRequestConfig(async () => {
  const store = await cookies();
  const locale = resolveUiLocale(store.get(UI_LOCALE_COOKIE)?.value, process.env.NEXT_PUBLIC_ENABLE_ARABIC_UI === "true");
  const messages = locale === "en" ? (en as Messages) : mergeMessages(en as Messages, (await import(`../messages/${locale}.json`)).default as Messages);
  return { locale, messages };
});
