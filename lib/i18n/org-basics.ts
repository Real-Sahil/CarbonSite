import { cache } from "react";
import { prisma } from "@/lib/db";
import { localeForCountry, orgFormat } from "./org-format";

/**
 * The organisation's name, HQ country and reporting currency. React cache()
 * makes the layout and every page in one request share this single query, so
 * formatting a page in the organisation's locale costs no extra round trip.
 */
export const getOrgBasics = cache((orgId: string) =>
  prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true, hqCountry: true, reportingCurrency: true },
  }),
);

/** BCP 47 locale for the organisation's numbers and dates (en-GB when unknown). */
export async function getOrgLocale(orgId: string): Promise<string> {
  const org = await getOrgBasics(orgId).catch(() => null);
  return localeForCountry(org?.hqCountry);
}

export async function getOrgFormat(orgId: string) {
  const org = await getOrgBasics(orgId).catch(() => null);
  return orgFormat(org ?? {});
}
