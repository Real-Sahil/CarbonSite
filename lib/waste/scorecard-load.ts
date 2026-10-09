import { prisma } from "@/lib/db";
import { scoreCarriers, type CarrierNote, type CarrierRow } from "@/lib/waste/scorecard";

/** The organisation's loads, transfer notes and their review counts. Every read is inside the organisation. */
export async function loadCarrierScorecard(orgId: string): Promise<CarrierRow[]> {
  const [loads, docs] = await Promise.all([
    prisma.wasteRecord.findMany({
      where: { organizationId: orgId },
      select: { carrierRegistration: true, carrierName: true, weightTonnes: true },
      take: 5000,
    }),
    prisma.wasteDocument.findMany({
      where: { organizationId: orgId, kind: "transfer_note" },
      select: { id: true, issuer: true, wasteRecordId: true, extracted: true },
      orderBy: { createdAt: "desc" },
      take: 2000,
    }),
  ]);
  const recordedIds = docs.filter((d) => d.wasteRecordId).map((d) => d.id);
  // The changed-fields count is written to the audit entry when a note is approved (see acceptTransferNote()).
  const audits = recordedIds.length
    ? await prisma.auditLog.findMany({
        where: { organizationId: orgId, action: "waste_document.reviewed", resourceType: "WasteDocument", resourceId: { in: recordedIds } },
        select: { resourceId: true, metadata: true },
        orderBy: { createdAt: "desc" },
        take: 5000,
      })
    : [];
  const changed = new Map<string, number>();
  for (const a of audits) {
    const v = (a.metadata as { changedFromSuggestion?: unknown } | null)?.changedFromSuggestion;
    if (typeof v === "number" && !changed.has(a.resourceId)) changed.set(a.resourceId, v);
  }
  const notes: CarrierNote[] = docs.map((d) => {
    const x = (d.extracted ?? {}) as { carrierRegistration?: string; carrier?: string; registerCheck?: CarrierNote["registerCheck"] };
    return {
      carrierRegistration: x.carrierRegistration ?? null,
      carrierName: d.issuer ?? x.carrier ?? null,
      recorded: !!d.wasteRecordId,
      changedFields: changed.get(d.id) ?? null,
      registerCheck: x.registerCheck ?? null,
    };
  });
  return scoreCarriers(
    loads.map((l) => ({ ...l, weightTonnes: Number(l.weightTonnes) })),
    notes,
  );
}
