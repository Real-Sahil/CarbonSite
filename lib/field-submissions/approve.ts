// Shared field-submission approval logic — used by the single-submission
// review route and the bulk-review route so approved submissions always
// produce a calculation-ready ActivityRecord with evidence carried over.

import { Prisma } from "@prisma/client";

type TxClient = Prisma.TransactionClient;

export type ApprovableSubmission = Prisma.FieldSubmissionGetPayload<{
  include: { files: { select: { evidenceFileId: true } } };
}>;

// Map document-type-specific formData keys to a canonical amount/unit.
// Flutter sends: weight/weightUnit (waste), quantity/quantityUnit (delivery),
// volume/volumeUnit (fuel). Generic amount/unit as fallback.
export function extractAmountUnit(
  documentType: string,
  formData: Record<string, unknown>,
): { amount: number; unit: string } {
  let amount: number;
  let unit: string;
  switch (documentType) {
    case "waste_ticket":
      amount = Number(formData["weight"] ?? formData["amount"] ?? 0) || 0;
      unit = String(formData["weightUnit"] ?? formData["unit"] ?? "kg");
      break;
    case "delivery_note":
      amount = Number(formData["quantity"] ?? formData["weight"] ?? formData["amount"] ?? 0) || 0;
      unit = String(formData["quantityUnit"] ?? formData["weightUnit"] ?? formData["unit"] ?? "units");
      break;
    case "fuel_receipt":
      amount = Number(formData["volume"] ?? formData["amount"] ?? 0) || 0;
      unit = String(formData["volumeUnit"] ?? formData["unit"] ?? "litres");
      break;
    default:
      amount = Number(formData["amount"] ?? 0) || 0;
      unit = String(formData["unit"] ?? "units");
  }
  return { amount, unit };
}

// Parse the activity date captured on the document. OCR and manual entry
// produce ISO (YYYY-MM-DD) or UK day-first (DD/MM/YYYY, DD-MM-YYYY) formats.
export function extractActivityDate(
  formData: Record<string, unknown>,
  fallback?: Date | null,
): Date | undefined {
  const raw = formData["date"] ?? formData["activityDate"];
  if (typeof raw === "string" && raw.trim()) {
    const value = raw.trim();
    const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
      const parsed = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00Z`);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    const dayFirst = value.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
    if (dayFirst) {
      const day = Number(dayFirst[1]);
      const month = Number(dayFirst[2]);
      let year = Number(dayFirst[3]);
      if (year < 100) year += 2000;
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
        const parsed = new Date(Date.UTC(year, month - 1, day));
        if (!Number.isNaN(parsed.getTime())) return parsed;
      }
    }
  }
  return fallback ?? undefined;
}

export type ApprovalIssue = { code: string; message: string };

// Validates a submission can be approved. Returns null when OK.
export function approvalBlocker(
  submission: ApprovableSubmission,
  emissionCategoryId: string | null | undefined,
): ApprovalIssue | null {
  if (!emissionCategoryId) {
    return {
      code: "MISSING_CATEGORY",
      message: "Assign an emission category before approving this submission.",
    };
  }
  const formData = (submission.formData ?? {}) as Record<string, unknown>;
  const { amount, unit } = extractAmountUnit(submission.documentType, formData);
  if (!Number.isFinite(amount) || amount <= 0 || !unit) {
    return {
      code: "INVALID_FORM_DATA",
      message: "Submission form data must include a positive amount and unit.",
    };
  }
  return null;
}

// Creates the committed ActivityRecord, links evidence, and marks the
// submission approved — inside the caller-supplied transaction.
export async function approveSubmissionInTx(
  tx: TxClient,
  opts: {
    orgId: string;
    submission: ApprovableSubmission;
    emissionCategoryId: string;
    facilityId?: string | null;
    reviewerUserId: string;
    reviewNote?: string;
  },
): Promise<{
  activityRecordId: string;
  submission: Prisma.FieldSubmissionGetPayload<Record<string, never>>;
}> {
  const { orgId, submission, reviewerUserId } = opts;
  const formData = (submission.formData ?? {}) as Record<string, unknown>;
  const { amount, unit } = extractAmountUnit(submission.documentType, formData);
  const evidenceFileIds = submission.files.map((file) => file.evidenceFileId);
  const facilityId =
    opts.facilityId === undefined ? submission.facilityId : opts.facilityId;

  let activityRecordId = submission.activityRecordId;

  if (!activityRecordId) {
    const record = await tx.activityRecord.create({
      data: {
        organizationId: orgId,
        reportingPeriodId: submission.reportingPeriodId,
        emissionCategoryId: opts.emissionCategoryId,
        facilityId,
        siteId: submission.siteId,
        contractId: submission.contractId,
        fieldSubmissionId: submission.id,
        createdByUserId: reviewerUserId,
        sourceDescription: String(
          formData["supplierName"] ??
            formData["description"] ??
            formData["sourceDescription"] ??
            submission.documentType,
        ),
        supplierName: formData["supplierName"] ? String(formData["supplierName"]) : undefined,
        amount,
        unit,
        activityDate: extractActivityDate(formData, submission.deviceSubmittedAt),
        reviewStatus: "approved",
        evidenceStatus: evidenceFileIds.length > 0 ? "complete" : "missing",
        pickupPostcode: submission.pickupPostcode,
        deliveryPostcode: submission.deliveryPostcode,
        pickupLat: submission.pickupLat,
        pickupLng: submission.pickupLng,
        deliveryLat: submission.deliveryLat,
        deliveryLng: submission.deliveryLng,
        distanceAmount: submission.calculatedDistanceKm,
        distanceUnit: submission.calculatedDistanceKm ? "km" : undefined,
        routeDistanceSource: submission.distanceSource,
      },
    });
    activityRecordId = record.id;
  }

  if (evidenceFileIds.length > 0) {
    await tx.activityRecordEvidence.createMany({
      data: evidenceFileIds.map((evidenceFileId) => ({
        organizationId: orgId,
        activityRecordId: activityRecordId!,
        evidenceFileId,
      })),
      skipDuplicates: true,
    });
  }

  const updated = await tx.fieldSubmission.update({
    where: { id: submission.id },
    data: {
      status: "approved",
      emissionCategoryId: opts.emissionCategoryId,
      facilityId,
      reviewNote: opts.reviewNote,
      reviewedByUserId: reviewerUserId,
      reviewedAt: new Date(),
      activityRecordId,
    },
  });

  return { activityRecordId, submission: updated };
}
