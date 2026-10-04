"use client";

import { createContext, useContext } from "react";
import { currencySymbol, formatMoney } from "@/lib/i18n/org-format";

type OrgLocaleValue = { locale: string; currency: string };
const OrgLocaleContext = createContext<OrgLocaleValue>({ locale: "en-GB", currency: "GBP" });

/** Provides the organisation's locale and reporting currency to client components under the org layout. */
export function OrgLocaleProvider({ locale, currency = "GBP", children }: { locale: string; currency?: string; children: React.ReactNode }) {
  return <OrgLocaleContext.Provider value={{ locale, currency }}>{children}</OrgLocaleContext.Provider>;
}

/** The organisation's BCP 47 locale for numbers and dates; en-GB outside the org layout. */
export function useOrgLocale(): string {
  return useContext(OrgLocaleContext).locale;
}

/** The organisation's reporting currency (ISO 4217); GBP outside the org layout. */
export function useOrgCurrency(): string {
  return useContext(OrgLocaleContext).currency;
}

/**
 * Money in the organisation's reporting currency and locale, plus the currency
 * code and its symbol for labels ("Financial impact low (€)"). Pass a currency
 * to format an amount that is held in another one.
 */
export function useOrgMoney() {
  const { locale, currency } = useContext(OrgLocaleContext);
  return {
    currency,
    symbol: currencySymbol(currency, locale),
    format: (n: number, opts?: { currency?: string; decimals?: number }) => formatMoney(n, opts?.currency ?? currency, locale, opts?.decimals ?? 0),
  };
}
