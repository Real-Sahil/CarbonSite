// What the site operations report prints for one reporting period: fuel stores and their gaps, plant and idling,
// hazardous and controlled material loads, waste licences and permits, carrier register checks and how each
// project's Site Waste Management Plan compares with what was recorded. Everything is read inside the organisation
// through the loaders the pages use, so the report and the pages cannot disagree. Nothing is estimated.

import { prisma } from "@/lib/db";
import { loadFuel } from "@/lib/fuel/load";
import { loadPlant } from "@/lib/plant/load";
import { loadMaterial } from "@/lib/material/server";
import { documentState, kindLabel } from "@/lib/waste/documents";
import { loadWastePlan } from "@/lib/waste/swmp-load";

const MAX_PLANS = 40;

export type SiteOperationsData = Awaited<ReturnType<typeof loadSiteOperations>>;

export async function loadSiteOperations(orgId: string, period: { label: string; startDate: Date; endDate: Date }) {
  const from = period.startDate;
  // The period's last day is included.
  const to = new Date(period.endDate.getTime() + 86_400_000);
  const [fuel, plant, material, docs, plans] = await Promise.all([
    loadFuel(orgId, from, to),
    loadPlant(orgId, from, to),
    loadMaterial(orgId),
    prisma.wasteDocument.findMany({
      where: { organizationId: orgId, status: "accepted", kind: { not: "transfer_note" } },
      orderBy: { validUntil: "asc" },
      take: 500,
      select: { id: true, kind: true, title: true, issuer: true, reference: true, validUntil: true, extracted: true },
    }),
    prisma.siteWastePlan.findMany({ where: { organizationId: orgId }, select: { projectId: true }, take: MAX_PLANS }),
  ]);
  const projects = await prisma.project.findMany({ where: { organizationId: orgId, id: { in: plans.map((p) => p.projectId) } }, select: { id: true, name: true } });
  const projectName = new Map(projects.map((p) => [p.id, p.name]));

  const inPeriod = (d: Date | null) => !!d && d >= from && d < to;
  const movements = material.movements
    .filter((m) => inPeriod(m.receivedOn ?? m.plannedOn))
    .map((m) => ({
      site: m.siteName, material: m.classificationName, ewc: m.ewcCode, hazardous: m.hazardous, status: m.status,
      tonnes: m.ticketTonnes != null ? Number(m.ticketTonnes) : Number(m.plannedTonnes),
      carrier: m.carrierName, destination: m.destinationName, issues: m.check.issues.map((i) => i.message ?? String(i)),
    }));

  const documents = docs
    .map((d) => ({ ...d, kindLabel: kindLabel(d.kind), state: documentState(d.kind, d.validUntil, period.endDate) }))
    .filter((d) => d.state === "expired" || d.state === "expiring");
  const checks = docs
    .map((d) => {
      const x = d.extracted as { registerCheck?: { status: string }; permitCheck?: { status: string } } | null;
      return x?.registerCheck?.status ?? x?.permitCheck?.status ?? null;
    })
    .filter((s): s is string => !!s && s !== "not_checked");

  const plansLoaded = await Promise.all(plans.map(async (p) => ({ name: projectName.get(p.projectId) ?? "Project", view: await loadWastePlan(orgId, p.projectId) })));
  const swmp = plansLoaded.map(({ name, view }) => ({
    project: name, status: view.status, version: view.version, targetPct: view.plan.targetDiversionPct,
    plannedPct: view.comparison.plannedDiversionPct, actualPct: view.comparison.actualDiversionPct,
    forecastTonnes: view.comparison.forecastTotal, actualTonnes: view.comparison.actualTotal, gaps: view.checks.filter((c) => !c.ok).length,
  }));

  return {
    period: { label: period.label, from, to: period.endDate },
    fuel: {
      stores: fuel.stores.filter((s) => s.litresIn > 0 || s.litresOut > 0 || s.lastDip),
      machines: fuel.machines.filter((m) => m.issued > 0 || (m.telematicsLitres ?? 0) > 0),
      sites: fuel.sites,
    },
    plant: { assets: plant.assets.filter((a) => a.hours > 0 || a.fuelLitres > 0), reconciliation: plant.reconciliation },
    movements,
    documents,
    registerChecks: { total: checks.length, found: checks.filter((s) => s === "registered" || s === "effective").length, problems: checks.filter((s) => ["expired", "not_found", "not_effective"].includes(s)).length },
    swmp,
  };
}
