import { prisma } from "@/lib/db";
import { addRecord, emptyAgg, KPIS } from "@/lib/kpis/catalogue";
import { documentState, kindLabel } from "./documents";
import { loadWastePlan } from "./swmp-load";

export const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
export const currentMonth = (now = new Date()) => now.toISOString().slice(0, 7);

/**
 * One project's month for a client: the loads recorded, the waste KPIs, how the Site Waste Management Plan
 * is doing, licences and permits to watch, and carrier register checks already made. Everything is read
 * inside the organisation and nothing is invented: a figure with no basis is left blank.
 */
export async function loadProjectPack(orgId: string, projectId: string, month: string, currency: string) {
  const start = new Date(`${month}-01T00:00:00Z`);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  const [project, loads, docs, plan] = await Promise.all([
    prisma.project.findFirst({
      where: { id: projectId, organizationId: orgId },
      select: { id: true, name: true, contract: { select: { name: true, contractValue: true, currency: true } }, carbonBudget: { select: { floorAreaM2: true } } },
    }),
    prisma.wasteRecord.findMany({
      where: { organizationId: orgId, projectId, recordedAt: { gte: start, lt: end } },
      orderBy: { recordedAt: "asc" },
      take: 5000,
      select: { id: true, recordedAt: true, wasteType: true, ewcCode: true, disposalRoute: true, hazardous: true, weightTonnes: true, co2eTonnes: true, carrierName: true, transferNoteReference: true },
    }),
    prisma.wasteDocument.findMany({
      where: { organizationId: orgId, status: "accepted", OR: [{ projectId }, { projectId: null }] },
      orderBy: { validUntil: "asc" },
      take: 500,
      select: { id: true, kind: true, title: true, issuer: true, reference: true, validUntil: true, extracted: true },
    }),
    loadWastePlan(orgId, projectId),
  ]);
  if (!project) return null;

  const agg = emptyAgg();
  for (const l of loads) addRecord(agg, { tonnes: Number(l.weightTonnes), route: l.disposalRoute, hazardous: l.hazardous, co2eT: l.co2eTonnes != null ? Number(l.co2eTonnes) : null });
  const sameCurrency = project.contract?.currency === currency;
  agg.value = sameCurrency && project.contract?.contractValue != null ? Number(project.contract.contractValue) : null;
  agg.floorM2 = project.carbonBudget?.floorAreaM2 != null ? Number(project.carbonBudget.floorAreaM2) : null;
  const kpis = ["wt", "dv", "rc", "lf", "hz", "pk", "pm", "co"].map((id) => {
    const def = KPIS.find((k) => k.id === id)!;
    return { id, label: def.label, unit: def.unit, decimals: def.decimals, value: def.compute(agg), needs: def.needs };
  });

  const watch = docs
    .filter((d) => d.kind !== "transfer_note")
    .map((d) => ({ ...d, state: documentState(d.kind, d.validUntil), kindLabel: kindLabel(d.kind) }))
    .filter((d) => d.state === "expired" || d.state === "expiring");
  const registerChecks = docs
    .map((d) => ({ title: d.issuer ?? d.title, check: (d.extracted as { registerCheck?: { status: string; registration?: string; holder?: string | null; expiryDate?: string | null; checkedAt?: string } } | null)?.registerCheck }))
    .filter((x): x is { title: string; check: NonNullable<typeof x.check> } => !!x.check && x.check.status !== "not_checked");

  return {
    project: { id: project.id, name: project.name, contractName: project.contract?.name ?? null },
    month,
    loads: loads.map((l) => ({ ...l, weightTonnes: Number(l.weightTonnes) })),
    kpis,
    plan,
    watch,
    registerChecks,
  };
}
