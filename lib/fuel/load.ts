import { prisma } from "@/lib/db";
import { recordedFuelBySite } from "@/lib/plant/load";
import { summariseMachines, summariseSites, summariseStores } from "./rollup";

const num = (d: { toString(): string }) => Number(d);

/** One month of fuel for an organisation, optionally narrowed to a site. Every read is inside the organisation. */
export async function loadFuel(orgId: string, from: Date, to: Date, siteId?: string | null) {
  const storeRows = await prisma.fuelStore.findMany({
    where: { organizationId: orgId, ...(siteId ? { siteId } : {}) },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  const storeIds = storeRows.map((s) => s.id);
  const siteIds = [...new Set(storeRows.map((s) => s.siteId).filter((s): s is string => !!s))];
  // Dips and movements reach back a month before the window so a dip's baseline can be found.
  const back = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - 1, 1));
  const inScope = { organizationId: orgId, storeId: { in: storeIds } };
  const [sites, deliveries, issues, dips, assets, readings, recorded] = await Promise.all([
    siteIds.length ? prisma.site.findMany({ where: { organizationId: orgId, id: { in: siteIds } }, select: { id: true, name: true } }) : [],
    prisma.fuelDelivery.findMany({ where: { ...inScope, deliveredOn: { gte: back, lt: to } }, orderBy: { deliveredOn: "desc" } }),
    prisma.fuelIssue.findMany({ where: { ...inScope, issuedOn: { gte: back, lt: to } }, orderBy: { issuedOn: "desc" } }),
    prisma.fuelDip.findMany({ where: { ...inScope, dippedOn: { gte: back, lt: to } }, orderBy: { dippedOn: "desc" } }),
    prisma.plantAsset.findMany({ where: { organizationId: orgId, ...(siteId ? { siteId } : {}) }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.plantTelematicsReading.findMany({
      where: { organizationId: orgId, periodEnd: { gt: from, lte: to }, ...(siteId ? { asset: { siteId } } : {}) },
      select: { assetId: true, operatingHours: true, idleHours: true, fuelLitres: true },
    }),
    recordedFuelBySite(orgId, siteIds, new Date(from.getTime() - 1), new Date(to.getTime() - 1)),
  ]);
  const siteName = new Map(sites.map((s) => [s.id, s.name]));

  const deliveriesIn = deliveries.map((d) => ({ storeId: d.storeId, on: d.deliveredOn, fuelType: d.fuelType, litres: num(d.litres) }));
  const issuesIn = issues.map((i) => ({ storeId: i.storeId, on: i.issuedOn, litres: num(i.litres), plantAssetId: i.plantAssetId, vehicleLabel: i.vehicleLabel }));
  const stores = summariseStores(
    storeRows.map((s) => ({
      id: s.id, name: s.name, kind: s.kind, fuelType: s.fuelType, capacityLitres: num(s.capacityLitres),
      siteId: s.siteId, siteName: s.siteId ? siteName.get(s.siteId) ?? null : null, ownership: s.ownership, active: s.active,
    })),
    deliveriesIn, issuesIn,
    dips.map((p) => ({ storeId: p.storeId, on: p.dippedOn, litres: num(p.litres) })),
    from, to,
  );

  const telematics = new Map<string, { litres: number; hours: number; idleHours: number }>();
  for (const r of readings) {
    const t = telematics.get(r.assetId) ?? { litres: 0, hours: 0, idleHours: 0 };
    t.litres += r.fuelLitres == null ? 0 : num(r.fuelLitres);
    t.hours += r.operatingHours == null ? 0 : num(r.operatingHours);
    t.idleHours += r.idleHours == null ? 0 : num(r.idleHours);
    telematics.set(r.assetId, t);
  }
  const monthIssues = issuesIn.filter((i) => i.on >= from && i.on < to);
  const monthEntries = [
    ...deliveries.filter((d) => d.deliveredOn >= from).map((d) => ({ kind: "delivery" as const, id: d.id, storeId: d.storeId, on: d.deliveredOn, litres: num(d.litres), detail: [d.fuelType, d.supplierName, d.reference].filter(Boolean).join(" · ") })),
    ...issues.filter((i) => i.issuedOn >= from).map((i) => ({ kind: "issue" as const, id: i.id, storeId: i.storeId, on: i.issuedOn, litres: num(i.litres), detail: i.plantAssetId ? assets.find((a) => a.id === i.plantAssetId)?.name ?? "Machine" : i.vehicleLabel ?? "" })),
    ...dips.filter((p) => p.dippedOn >= from).map((p) => ({ kind: "dip" as const, id: p.id, storeId: p.storeId, on: p.dippedOn, litres: num(p.litres), detail: p.note ?? "" })),
  ].sort((a, b) => b.on.getTime() - a.on.getTime());

  return {
    stores,
    machines: summariseMachines(assets, monthIssues, telematics),
    sites: summariseSites(stores, recorded),
    entries: monthEntries.slice(0, 200),
    assets,
  };
}
