export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { orgRefsError } from "@/lib/security/org-refs";
import { disposalRouteSchema } from "@/lib/validation/environmental";
import { LINK_ISSUERS } from "@/lib/evidence/submission-link";
import { syncWasteRecordCalculation, rebuildEnvironmentalMetricAggregates } from "@/lib/calculation/environmental-metrics";

const body = z
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

// POST: a reviewer turns a transfer note a carrier sent into a waste record. The record goes through the
// same calculation as any waste record; the document is accepted and linked to it. One record per document.
export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string; id: string }> }) {
  try {
    const { orgId, id } = await params;
    const { session } = await requireOrgMember(orgId, ...LINK_ISSUERS);
    const b = body.parse(await req.json());
    const doc = await prisma.wasteDocument.findFirst({ where: { id, organizationId: orgId } });
    if (!doc) return apiError("NOT_FOUND", "Document not found.", 404);
    if (doc.kind !== "transfer_note") return apiError("NOT_A_TRANSFER_NOTE", "Only a transfer note can become a waste record.", 422);
    if (doc.wasteRecordId) return apiError("ALREADY_RECORDED", "This document already has a waste record.", 409);

    const refs = await orgRefsError(orgId, { facilityId: b.facilityId, reportingPeriodId: b.reportingPeriodId, projectId: b.projectId });
    if (refs) return refs;

    if (b.transferNoteReference && !b.allowDuplicate) {
      const dup = await prisma.wasteRecord.findFirst({
        where: { organizationId: orgId, transferNoteReference: { equals: b.transferNoteReference, mode: "insensitive" } },
        select: { id: true },
      });
      if (dup) return apiError("POSSIBLE_DUPLICATE", "A waste record with this transfer note reference already exists.", 409);
    }

    const record = await prisma.$transaction(async (tx) => {
      // The claim and the create are one step, so two reviewers cannot both make a record from one document.
      const claimed = await tx.wasteDocument.updateMany({ where: { id, organizationId: orgId, wasteRecordId: null }, data: { status: "accepted", reviewedByUserId: session.user.id, reviewedAt: new Date() } });
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
          notes: `From transfer note document ${id}`,
          createdByUserId: session.user.id,
        },
        select: { id: true },
      });
      await tx.wasteDocument.update({ where: { id }, data: { wasteRecordId: r.id } });
      return r;
    });
    if (!record) return apiError("ALREADY_RECORDED", "This document already has a waste record.", 409);

    const calc = await syncWasteRecordCalculation(record.id, session.user.id);
    await rebuildEnvironmentalMetricAggregates(orgId, b.reportingPeriodId);
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "waste_document.reviewed",
      resourceType: "WasteDocument",
      resourceId: id,
      metadata: { recordedAsWasteRecord: record.id, weightTonnes: b.weightTonnes, co2eTonnes: calc?.co2eTonnes ?? null },
    });
    return NextResponse.json({ wasteRecordId: record.id }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
