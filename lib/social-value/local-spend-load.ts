import { prisma } from "@/lib/db";
import { geocodePostcodes } from "@/lib/social-value/geocode";
import {
  summariseLocalSpend,
  normalisePostcode,
  type LocalSpendSummary,
  type SpendLine,
  type SupplierLocation,
} from "@/lib/social-value/local-spend";

export type LocalSpendResult =
  | { ok: true; site: { id: string; name: string; postcode: string }; summary: LocalSpendSummary; recordCount: number }
  | { ok: false; code: "SITE_NOT_FOUND" | "SITE_NO_POSTCODE" | "SITE_NOT_LOCATED" | "GEOCODER_UNAVAILABLE"; message: string };

/** Records that count: reviewed or approved, not drafts, rejected or awaiting information. */
const COUNTED = ["in_review", "approved"] as const;

export async function loadLocalSpend(
  orgId: string,
  opts: { siteId: string; radiusMiles: number; from?: Date; to?: Date },
): Promise<LocalSpendResult> {
  const site = await prisma.site.findFirst({
    where: { id: opts.siteId, organizationId: orgId },
    select: { id: true, name: true, postcode: true },
  });
  if (!site) return { ok: false, code: "SITE_NOT_FOUND", message: "Site not found." };
  const sitePostcode = site.postcode ? normalisePostcode(site.postcode) : null;
  if (!sitePostcode) {
    return { ok: false, code: "SITE_NO_POSTCODE", message: "Add a valid UK postcode to this site first." };
  }

  let located;
  try {
    located = (await geocodePostcodes([sitePostcode])).get(sitePostcode) ?? null;
  } catch {
    return { ok: false, code: "GEOCODER_UNAVAILABLE", message: "The postcode lookup is unavailable. Try again shortly." };
  }
  if (!located) {
    return { ok: false, code: "SITE_NOT_LOCATED", message: `${sitePostcode} was not found. Check the site's postcode.` };
  }

  const [records, suppliers] = await Promise.all([
    prisma.activityRecord.findMany({
      where: {
        organizationId: orgId,
        siteId: site.id,
        spendAmount: { not: null },
        reviewStatus: { in: [...COUNTED] },
        ...((opts.from || opts.to) && {
          activityDate: { ...(opts.from && { gte: opts.from }), ...(opts.to && { lte: opts.to }) },
        }),
      },
      select: { supplierName: true, spendAmount: true, spendCurrency: true },
    }),
    prisma.svSupplierLocation.findMany({
      where: { organizationId: orgId },
      select: { nameKey: true, name: true, latitude: true, longitude: true, sme: true },
    }),
  ]);

  const lines: SpendLine[] = records.map((r) => ({
    supplierName: r.supplierName,
    amount: Number(r.spendAmount),
    currency: r.spendCurrency,
  }));
  const locations: SupplierLocation[] = suppliers.map((s) => ({
    key: s.nameKey,
    name: s.name,
    latitude: s.latitude == null ? null : Number(s.latitude),
    longitude: s.longitude == null ? null : Number(s.longitude),
    sme: s.sme,
  }));

  return {
    ok: true,
    site: { id: site.id, name: site.name, postcode: sitePostcode },
    summary: summariseLocalSpend(lines, locations, located, opts.radiusMiles),
    recordCount: records.length,
  };
}
