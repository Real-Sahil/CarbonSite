import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";
import { disposalRouteSchema } from "@/lib/validation/environmental";
import { syncWasteRecordCalculation, rebuildEnvironmentalMetricAggregates } from "@/lib/calculation/environmental-metrics";

export const acceptBodySchema = z
  .object({
    facilityId: z.string().min(1).max(64),
    reportingPeriodId: z.string().min(1).max(64),
    projectId: z.string().min(1).max(64).nullish(),
    wasteType: z.string().trim().min(1).max(100),
    disposalRoute: disposalRouteSchema,
    hazardous: z.boolean().default(false),
    weightTonnes: z.number().positive(),
    ewcCode: z.string().trim().max(20).nullish(),
    carrierName: z.string().trim().max(200).nullish(),
    carrierRegistration: z.string().trim().max(40).nullish(),
    transferNoteReference: z.string().trim().max(100).nullish(),
    destination: z.string().trim().max(200).nullish(),
    vehicleRegistration: z.string().trim().max(20).nullish(),
    recordedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    allowDuplicate: z.boolean().default(false),
  })
  .strict();
export type AcceptBody = z.infer<typeof acceptBodySchema>;

const COMPARED = ["facilityId", "reportingPeriodId", "wasteType", "disposalRoute", "hazardous", "weightTonnes", "ewcCode", "transferNoteReference", "recordedAt", "carrierName", "carrierRegistration", "destination"] as const;

/** How many fields the reviewer ended up with that differ from what the reader and defaults suggested. */
export function changedFromSuggestion(suggestion: Partial<AcceptBody>, final: AcceptBody): number {
  return COMPARED.filter((k) => suggestion[k] !== undefined && (suggestion[k] ?? null) !== (final[k] ?? null)).length;
}

/**
 * The one place a transfer note becomes a waste record. The document claim and the record create are a single
 * transaction, so two reviewers (or a bulk approval and a click) cannot both make a record. Returns the new
 * record id, or null when the document was already recorded. The caller has checked ids with orgRefsError().
 */
export async function acceptTransferNote(orgId: string, userId: string, docId: string, b: AcceptBody, suggestion: Partial<AcceptBody>, via: "review" | "bulk") {
  const record = await prisma.$transaction(async (tx) => {
    const claimed = await tx.wasteDocument.updateMany({ where: { id: docId, organizationId: orgId, wasteRecordId: null }, data: { status: "accepted", reviewedByUserId: userId, reviewedAt: new Date() } });
    if (claimed.count === 0) return null;
    const r = await tx.wasteRecord.create({
      data: {
        organizationId: orgId,
        facilityId: b.facilityId,
        reportingPeriodId: b.reportingPeriodId,
        projectId: b.projectId ?? null,
        wasteType: b.wasteType,
        disposalRoute: b.disposalRoute,
        hazardous: b.hazardous,
        weightTonnes: b.weightTonnes,
        ewcCode: b.ewcCode ?? null,
        carrierName: b.carrierName ?? null,
        carrierRegistration: b.carrierRegistration ?? null,
        transferNoteReference: b.transferNoteReference ?? null,
        destination: b.destination ?? null,
        vehicleRegistration: b.vehicleRegistration ?? null,
        dataSource: "import",
        recordedAt: new Date(b.recordedAt),
        notes: `From transfer note document ${docId}`,
        createdByUserId: userId,
      },
      select: { id: true },
    });
    await tx.wasteDocument.update({ where: { id: docId }, data: { wasteRecordId: r.id } });
    return r;
  });
  if (!record) return null;
  const calc = await syncWasteRecordCalculation(record.id, userId);
  await rebuildEnvironmentalMetricAggregates(orgId, b.reportingPeriodId);
  await writeAuditLog({
    organizationId: orgId,
    actorUserId: userId,
    action: "waste_document.reviewed",
    resourceType: "WasteDocument",
    resourceId: docId,
    metadata: { recordedAsWasteRecord: record.id, weightTonnes: b.weightTonnes, co2eTonnes: calc?.co2eTonnes ?? null, via, changedFromSuggestion: changedFromSuggestion(suggestion, b) },
  });
  return record.id;
}
