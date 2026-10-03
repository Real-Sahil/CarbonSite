"use client";

import { createContext, useContext } from "react";

const OrgLocaleContext = createContext("en-GB");

/** Provides the organisation's locale to client components under the org layout. */
export function OrgLocaleProvider({ locale, children }: { locale: string; children: React.ReactNode }) {
  return <OrgLocaleContext.Provider value={locale}>{children}</OrgLocaleContext.Provider>;
}

/** The organisation's BCP 47 locale for numbers and dates; en-GB outside the org layout. */
export function useOrgLocale(): string {
  return useContext(OrgLocaleContext);
}
