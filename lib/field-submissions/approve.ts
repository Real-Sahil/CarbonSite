// Shared field-submission approval logic — used by the single-submission
// review route and the bulk-review route so approved submissions always
// produce a calculation-ready ActivityRecord with evidence carried over.

import { Prisma } from "@prisma/client";
import { isValid as isValidUkPostcode } from "postcode";
import { convertBetween } from "@/lib/calculation/units";
import { recordDeliveryEmbodiedCarbon, type EmbodiedOutcome } from "@/lib/embodied-carbon/delivery-notes";
import { approveSocialValueInTx, socialValueEntry } from "@/lib/social-value/field-capture";

type TxClient = Prisma.TransactionClient;

export type ApprovableSubmission = Prisma.FieldSubmissionGetPayload<{
  include: { files: { select: { evidenceFileId: true } } };
}>;

// Map document-type-specific formData keys to a canonical amount/unit.
// Flutter sends: weight/weightUnit (waste), quantity/quantityUnit (delivery),
// volume/volumeUnit (fuel). Generic amount/unit as fallback.
// ocrData is checked as a secondary source when formData fields are missing or zero.
export function extractAmountUnit(
  documentType: string,
  formData: Record<string, unknown>,
  ocrData?: Record<string, unknown> | null,
): { amount: number; unit: string } {
  // Merge: formData wins, ocrData fills gaps
  const merged = { ...(ocrData ?? {}), ...formData };
  let amount: number;
  let unit: string;
  switch (documentType) {
    case "waste_ticket":
      amount = Number(merged["weight"] ?? merged["amount"] ?? 0) || 0;
      unit = String(merged["weightUnit"] ?? merged["unit"] ?? "kg");
      break;
    case "delivery_note":
      amount = Number(merged["quantity"] ?? merged["weight"] ?? merged["amount"] ?? 0) || 0;
      unit = String(merged["quantityUnit"] ?? merged["weightUnit"] ?? merged["unit"] ?? "units");
      break;
    case "fuel_receipt":
      amount = Number(merged["volume"] ?? merged["amount"] ?? 0) || 0;
      unit = String(merged["volumeUnit"] ?? merged["unit"] ?? "litres");
      break;
    case "water_meter_reading":
      amount = Number(merged["reading"] ?? merged["volume"] ?? merged["amount"] ?? 0) || 0;
      unit = String(merged["readingUnit"] ?? merged["volumeUnit"] ?? merged["unit"] ?? "m3");
      break;
    default:
      amount = Number(merged["amount"] ?? 0) || 0;
      unit = String(merged["unit"] ?? "units");
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

/** Fuel named on the submission (reviewer edit, then worker entry, then OCR). */
export function fuelTypeOf(formData: Record<string, unknown>, ocrData: Record<string, unknown> | null): string | undefined {
  const v = formData["fuelType"] ?? ocrData?.["fuelType"];
  return typeof v === "string" && v.trim() ? v.trim().slice(0, 60) : undefined;
}

export type ApprovalIssue = { code: string; message: string };

// Validates a submission can be approved. Returns null when OK.
export function approvalBlocker(
  submission: ApprovableSubmission,
  emissionCategoryId: string | null | undefined,
  facilityId?: string | null,
): ApprovalIssue | null {
  // Social value entries become an SvActivity against a contract KPI: no
  // emission category, amount or unit of their own.
  if (submission.documentType === "social_value") {
    const parsed = socialValueEntry((submission.formData ?? {}) as Record<string, unknown>);
    return "error" in parsed ? { code: "INVALID_FORM_DATA", message: parsed.error } : null;
  }
  // Water meter readings never get an EmissionCategory — water has no GHG
  // Protocol scope, so they promote to a WaterRecord, not an ActivityRecord.
  if (!emissionCategoryId && submission.documentType !== "water_meter_reading") {
    return {
      code: "MISSING_CATEGORY",
      message: "Assign an emission category before approving this submission.",
    };
  }
  // waste_ticket submissions promote to a WasteRecord, whose facilityId is
  // NOT NULL — without this check, approval would fail with a raw DB
  // constraint error instead of a clear reviewer-facing message.
  if (submission.documentType === "waste_ticket" && !facilityId) {
    return {
      code: "MISSING_FACILITY",
      message: "Assign a facility before approving this waste ticket.",
    };
  }
  const formData = (submission.formData ?? {}) as Record<string, unknown>;
  const ocrData = typeof submission.ocrExtractedData === "object" && !Array.isArray(submission.ocrExtractedData)
    ? (submission.ocrExtractedData as Record<string, unknown>)
    : null;
  const { amount, unit } = extractAmountUnit(submission.documentType, formData, ocrData);
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
    emissionCategoryId: string | null;
    facilityId?: string | null;
    reviewerUserId: string;
    reviewNote?: string;
    /** Delivery notes: undefined = match the material automatically, null = record no embodied carbon. */
    embodiedMaterialId?: string | null;
    /** App origin, for the evidence links a social value entry keeps. */
    origin?: string;
  },
): Promise<{
  /** Social value entries only: the approved delivery entry created. */
  svActivityId?: string;
  /** Delivery notes only: the embodied carbon record created, or why none was. */
  embodied?: EmbodiedOutcome;
  // Null exactly when this submission promoted to a WaterRecord instead of
  // an ActivityRecord (water_meter_reading — water has no GHG scope).
  activityRecordId: string | null;
  submission: Prisma.FieldSubmissionGetPayload<Record<string, never>>;
}> {
  const { orgId, submission, reviewerUserId } = opts;
  const formData = (submission.formData ?? {}) as Record<string, unknown>;
  const ocrData = typeof submission.ocrExtractedData === "object" && !Array.isArray(submission.ocrExtractedData)
    ? (submission.ocrExtractedData as Record<string, unknown>)
    : null;
  const { amount, unit } = extractAmountUnit(submission.documentType, formData, ocrData);
  const evidenceFileIds = submission.files.map((file) => file.evidenceFileId);
  const facilityId =
    opts.facilityId === undefined ? submission.facilityId : opts.facilityId;
  const activityDate = extractActivityDate(formData, submission.deviceSubmittedAt);

  let activityRecordId: string | null = submission.activityRecordId;
  let embodied: EmbodiedOutcome | undefined;
  let svActivityId: string | undefined;

  if (submission.documentType === "social_value") {
    ({ svActivityId } = await approveSocialValueInTx(tx, {
      orgId,
      submission,
      facilityId: facilityId ?? null,
      evidenceFileIds,
      origin: opts.origin ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://www.metricora.co.uk",
      reviewerUserId,
    }));
    activityRecordId = null;
  } else if (submission.documentType === "water_meter_reading") {
    if (!facilityId) {
      throw new Error("Water meter reading submissions require a facility to be assigned before approval.");
    }
    await tx.waterRecord.create({
      data: {
        organizationId: orgId,
        facilityId,
        reportingPeriodId: submission.reportingPeriodId,
        metricType: "consumption",
        source: "municipal_supply",
        volumeM3: convertBetween(amount, unit, "litre") != null ? convertBetween(amount, unit, "litre")! / 1000 : amount,
        dataSource: "field_submission",
        fieldSubmissionId: submission.id,
        recordedAt: activityDate ?? submission.deviceSubmittedAt ?? new Date(),
        createdByUserId: reviewerUserId,
      },
    });
    activityRecordId = null;
  } else if (!activityRecordId) {
    const record = await tx.activityRecord.create({
      data: {
        organizationId: orgId,
        reportingPeriodId: submission.reportingPeriodId,
        emissionCategoryId: opts.emissionCategoryId!,
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
        // Fuel receipts: the fuel picks the factor (HVO is ~1% of diesel's Scope 1).
        fuelType: fuelTypeOf(formData, ocrData),
        amount,
        unit,
        activityDate,
        reviewStatus: "approved",
        evidenceStatus: evidenceFileIds.length > 0 ? "complete" : "missing",
        // Quantities read from a ticket, receipt or delivery note are
        // invoiced primary data, not estimates.
        dataOrigin: "invoiced",
        pickupPostcode: submission.pickupPostcode,
        deliveryPostcode: submission.deliveryPostcode,
        pickupLat: submission.pickupLat,
        pickupLng: submission.pickupLng,
        deliveryLat: submission.deliveryLat,
        deliveryLng: submission.deliveryLng,
        distanceAmount: submission.calculatedDistanceKm,
        distanceUnit: submission.calculatedDistanceKm ? "km" : undefined,
        routeDistanceSource: submission.distanceSource,
        country:
          (submission.pickupPostcode != null && isValidUkPostcode(submission.pickupPostcode)) ||
          (submission.deliveryPostcode != null && isValidUkPostcode(submission.deliveryPostcode))
            ? "GB"
            : undefined,
      },
    });
    activityRecordId = record.id;

    // Waste tickets also drive a WasteRecord capturing the ESRS E5-specific
    // fields (disposal route, hazardous split, EWC code) that ActivityRecord
    // has no room for — linked to the ActivityRecord this same submission
    // just created so its CO2e already flows through the normal engine.
    if (submission.documentType === "waste_ticket") {
      // approvalBlocker() must have already rejected any waste_ticket
      // submission with no resolvable facility — WasteRecord.facilityId is
      // NOT NULL, so this would otherwise fail as a raw DB constraint error.
      if (!facilityId) {
        throw new Error("Cannot approve a waste_ticket submission with no facility assigned.");
      }
      const weightTonnes = convertBetween(amount, unit, "kg") != null ? convertBetween(amount, unit, "kg")! / 1000 : amount;
      await tx.wasteRecord.create({
        data: {
          organizationId: orgId,
          facilityId,
          reportingPeriodId: submission.reportingPeriodId,
          wasteType: String(formData["wasteType"] ?? formData["description"] ?? "Field-submitted waste"),
          disposalRoute: String(formData["disposalRoute"] ?? "recycling_mixed"),
          hazardous: Boolean(formData["hazardous"] ?? false),
          weightTonnes,
          ewcCode: formData["ewcCode"] ? String(formData["ewcCode"]) : undefined,
          carrierName: formData["carrierName"]
            ? String(formData["carrierName"])
            : formData["supplierName"]
              ? String(formData["supplierName"])
              : undefined,
          carrierRegistration: formData["carrierRegistration"] ? String(formData["carrierRegistration"]) : undefined,
          transferNoteReference: formData["transferNoteReference"]
            ? String(formData["transferNoteReference"])
            : formData["consignment"]
              ? String(formData["consignment"])
              : undefined,
          destination: formData["destination"] ? String(formData["destination"]) : undefined,
          vehicleRegistration: formData["vehicleReg"] ? String(formData["vehicleReg"]) : undefined,
          activityRecordId: record.id,
          dataSource: "field_submission",
          fieldSubmissionId: submission.id,
          recordedAt: activityDate ?? submission.deviceSubmittedAt ?? new Date(),
          createdByUserId: reviewerUserId,
        },
      });
    }

    // Delivery notes also feed the project's embodied carbon (A1-A3 and the
    // actual A4 delivery), separate from the Scope 3 inventory record above.
    if (submission.documentType === "delivery_note") {
      embodied = await recordDeliveryEmbodiedCarbon(tx, {
        orgId,
        submission,
        formData: { ...(ocrData ?? {}), ...formData },
        quantity: amount,
        unit,
        activityDate: activityDate ?? submission.deviceSubmittedAt ?? new Date(),
        materialId: opts.embodiedMaterialId,
        userId: reviewerUserId,
      });
    }
  }

  if (evidenceFileIds.length > 0 && activityRecordId) {
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

  return { activityRecordId, submission: updated, ...(embodied ? { embodied } : {}), ...(svActivityId ? { svActivityId } : {}) };
}
