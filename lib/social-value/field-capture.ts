/**
 * Social value delivery logged from the field app (PPN 026 jobs, pay and
 * training, or any contract KPI). A field worker picks one of their site's
 * contract KPIs, enters the quantity and date, and may attach a photo of the
 * timesheet, training record or apprenticeship agreement. A reviewer's
 * approval turns it into an approved SvActivity against that KPI; it never
 * becomes an emissions ActivityRecord.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

type TxClient = Prisma.TransactionClient;

export type SocialValueEntry = {
  commitmentId: string;
  quantity: number;
  /** ISO date (YYYY-MM-DD) the delivery happened. */
  activityDate: string | null;
  note: string | null;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Reads the entry from a submission's formData, or explains what is missing. */
export function socialValueEntry(formData: Record<string, unknown>): { entry: SocialValueEntry } | { error: string } {
  const commitmentId = typeof formData.commitmentId === "string" ? formData.commitmentId.trim() : "";
  if (!commitmentId) return { error: "Choose the contract KPI this delivery counts towards." };
  const quantity = Number(formData.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) return { error: "Enter a quantity above zero." };
  if (quantity > 1_000_000) return { error: "Quantity is too large. Check the number." };
  const rawDate = typeof formData.activityDate === "string" ? formData.activityDate.trim() : "";
  if (rawDate && (!ISO_DATE.test(rawDate) || Number.isNaN(Date.parse(`${rawDate}T00:00:00Z`)))) {
    return { error: "Date must be YYYY-MM-DD." };
  }
  const note = typeof formData.note === "string" && formData.note.trim() ? formData.note.trim().slice(0, 500) : null;
  return { entry: { commitmentId, quantity, activityDate: rawDate || null, note } };
}

/** Commitments (KPIs) still open on a contract, for the field app's picker. */
export async function openContractKpis(orgId: string, contractId: string) {
  const rows = await prisma.svCommitment.findMany({
    where: { organizationId: orgId, contractId, status: { in: ["draft", "active", "in_progress"] } },
    select: {
      id: true,
      title: true,
      targetValue: true,
      targetUnit: true,
      outcome: { select: { name: true } },
      framework: { select: { name: true } },
    },
    orderBy: [{ createdAt: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    unit: r.targetUnit,
    target: r.targetValue == null ? null : Number(r.targetValue),
    criterion: r.outcome?.name ?? null,
    framework: r.framework?.name ?? null,
  }));
}

/**
 * The KPI a new field entry names must be an open commitment on the contract
 * of the site it was filed against. Returns an error message or null.
 */
export async function socialValueSubmissionError(
  orgId: string,
  contractId: string | null | undefined,
  formData: Record<string, unknown>,
): Promise<string | null> {
  const parsed = socialValueEntry(formData);
  if ("error" in parsed) return parsed.error;
  if (!contractId) return "This site is not on a contract, so it has no social value KPIs.";
  const commitment = await prisma.svCommitment.findFirst({
    where: { id: parsed.entry.commitmentId, organizationId: orgId, contractId, status: { in: ["draft", "active", "in_progress"] } },
    select: { id: true },
  });
  return commitment ? null : "That KPI is not open on this site's contract.";
}

/** Download links kept on the activity, the same absolute form the web upload stores. */
export function evidenceLinks(orgId: string, evidenceFileIds: string[], origin: string): string[] {
  return evidenceFileIds.map((id) => new URL(`/api/orgs/${orgId}/evidence/${id}/download`, origin).toString());
}

/**
 * Creates the approved SvActivity for a social value submission inside the
 * approval transaction. Idempotent per submission (unique field_submission_id).
 */
export async function approveSocialValueInTx(
  tx: TxClient,
  opts: {
    orgId: string;
    submission: {
      id: string;
      formData: Prisma.JsonValue;
      contractId: string | null;
      facilityId: string | null;
      reportingPeriodId: string;
      submittedByUserId: string;
      deviceSubmittedAt: Date | null;
      createdAt: Date;
    };
    facilityId: string | null;
    evidenceFileIds: string[];
    /** App origin for the evidence download links. */
    origin: string;
    reviewerUserId: string;
  },
): Promise<{ svActivityId: string }> {
  const { orgId, submission } = opts;
  const parsed = socialValueEntry((submission.formData ?? {}) as Record<string, unknown>);
  if ("error" in parsed) throw new SocialValueApprovalError(parsed.error);
  const { entry } = parsed;
  const commitment = await tx.svCommitment.findFirst({
    where: { id: entry.commitmentId, organizationId: orgId, ...(submission.contractId ? { contractId: submission.contractId } : {}) },
    select: { id: true, title: true, targetUnit: true },
  });
  if (!commitment) throw new SocialValueApprovalError("The KPI this entry names no longer exists on the contract.");

  const existing = await tx.svActivity.findUnique({ where: { fieldSubmissionId: submission.id }, select: { id: true } });
  if (existing) return { svActivityId: existing.id };

  const activityDate = entry.activityDate
    ? new Date(`${entry.activityDate}T00:00:00Z`)
    : (submission.deviceSubmittedAt ?? submission.createdAt);
  const activity = await tx.svActivity.create({
    data: {
      organizationId: orgId,
      commitmentId: commitment.id,
      facilityId: opts.facilityId,
      reportingPeriodId: submission.reportingPeriodId,
      submittedByUserId: submission.submittedByUserId,
      approvedByUserId: opts.reviewerUserId,
      title: commitment.title.slice(0, 200),
      description: entry.note,
      activityDate,
      quantityValue: entry.quantity,
      quantityUnit: commitment.targetUnit,
      status: "approved",
      evidenceUrls: evidenceLinks(orgId, opts.evidenceFileIds, opts.origin),
      fieldSubmissionId: submission.id,
    },
    select: { id: true },
  });
  return { svActivityId: activity.id };
}

export class SocialValueApprovalError extends Error {}
