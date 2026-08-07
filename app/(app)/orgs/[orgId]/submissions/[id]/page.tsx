import { requireOrgMember, AuthError } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { SubmissionReviewActions } from "../review-actions";
import { SubmissionEditActions } from "../edit-actions";
import { SubmissionEvidenceDownloads } from "../evidence-download-actions";
import { SubmissionCommentActions } from "../comment-actions";

interface SubmissionDetailPageProps {
  params: Promise<{ orgId: string; id: string }>;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  submitted: "Submitted",
  under_review: "Under review",
  approved: "Approved",
  rejected: "Rejected",
  needs_info: "Needs info",
};

const STATUS_CLASSES: Record<string, string> = {
  pending: "border-[#e5e7eb] bg-[#e1f4df] text-[#0f3e17]",
  submitted: "border-[#b6ced5] bg-[#b6ced5]/30 text-[#0f3e17]",
  under_review: "border-[#b6ced5] bg-[#b6ced5]/50 text-[#0f3e17]",
  approved: "border-[#b1dbb8] bg-[#cfe7d3] text-[#0f3e17]",
  rejected: "border-[#e5e7eb] bg-[#e5e7eb] text-[#333333]",
  needs_info: "border-[#b6ced5] bg-[#b6ced5]/20 text-[#0f3e17]",
};

const DOC_TYPE_LABELS: Record<string, string> = {
  waste_ticket: "Waste ticket",
  delivery_note: "Delivery note",
  fuel_receipt: "Fuel receipt",
  other: "Other",
};

export default async function SubmissionDetailPage({ params }: SubmissionDetailPageProps) {
  const { orgId, id } = await params;

  try {
    await requireOrgMember(orgId, "admin", "editor", "reviewer");
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/sign-in");
      return (
        <div className="p-[42px]">
          <p className="text-sm text-[#222222] tracking-[-0.42px]">
            You do not have permission to view submissions.
          </p>
        </div>
      );
    }
    throw err;
  }

  const [submission, emissionCategories, facilities] = await Promise.all([
    prisma.fieldSubmission.findUnique({
      where: { id },
      include: {
        submittedBy: { select: { name: true, email: true } },
        reportingPeriod: { select: { id: true, label: true, startDate: true, endDate: true } },
        emissionCategory: { select: { id: true, scope: true, name: true } },
        facility: { select: { id: true, name: true } },
        site: { select: { name: true, project: { select: { name: true } } } },
        contract: { select: { name: true } },
        resubmittedFrom: { select: { id: true, documentType: true, createdAt: true } },
        resubmissions: {
          select: { id: true, status: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        files: {
          include: {
            evidenceFile: {
              select: {
                id: true,
                filename: true,
                classifications: {
                  select: { confidenceScore: true, documentType: true, modelVersion: true },
                  orderBy: { createdAt: "desc" },
                  take: 1,
                },
              },
            },
          },
        },
      },
    }),
    prisma.emissionCategory.findMany({
      select: { id: true, scope: true, name: true },
      orderBy: [{ scope: "asc" }, { name: "asc" }],
    }),
    prisma.facility.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const [reviewer, activityRecord] = await Promise.all([
    submission?.reviewedByUserId
      ? prisma.user.findUnique({
          where: { id: submission.reviewedByUserId },
          select: { name: true },
        })
      : Promise.resolve(null),
    submission?.activityRecordId
      ? prisma.activityRecord.findUnique({
          where: { id: submission.activityRecordId },
          select: {
            id: true,
            calculations: {
              select: { totalCo2e: true },
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        })
      : Promise.resolve(null),
  ]);

  if (!submission || submission.organizationId !== orgId) {
    notFound();
  }

  const comments = await prisma.comment.findMany({
    where: {
      organizationId: orgId,
      targetType: "field_submission",
      targetId: id,
    },
    include: { author: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  const isResolved = submission.status === "approved" || submission.status === "rejected";

  // Parse form data for display
  const formData = submission.formData as Record<string, unknown> | null;
  const ocrData = submission.ocrExtractedData as Record<string, unknown> | null;

  // Side-by-side verification rows: OCR value vs what the worker submitted.
  const IGNORED_KEYS = new Set(["autoExtracted", "resubmittedFromId", "raw"]);
  const comparisonKeys = [
    ...new Set([...Object.keys(ocrData ?? {}), ...Object.keys(formData ?? {})]),
  ].filter((key) => !IGNORED_KEYS.has(key));
  const comparisonRows = comparisonKeys
    .map((key) => {
      const ocrValue = ocrData?.[key];
      const formValue = formData?.[key];
      const ocrText = ocrValue == null || ocrValue === "" ? null : String(ocrValue);
      const formText = formValue == null || formValue === "" ? null : String(formValue);
      if (ocrText == null && formText == null) return null;
      const mismatch =
        ocrText != null &&
        formText != null &&
        ocrText.trim().toLowerCase() !== formText.trim().toLowerCase();
      return { key, ocrText, formText, mismatch };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
  const mismatchCount = comparisonRows.filter((row) => row.mismatch).length;

  // Flag submissions whose capture date falls outside the booked period —
  // the server silently books out-of-range dates into the latest period.
  const captureDate = submission.deviceSubmittedAt ?? submission.createdAt;
  const periodMismatch =
    captureDate < submission.reportingPeriod.startDate ||
    captureDate > submission.reportingPeriod.endDate;

  const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|gif)$/i;

  return (
    <div className="p-[42px] max-w-[900px] mx-auto">
      <div className="mb-[42px]">
        <Link
          href={`/orgs/${orgId}/submissions`}
          className="inline-flex items-center gap-1.5 text-xs text-[#333333] hover:text-[#0f3e17] tracking-[-0.36px] mb-[14px] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to submissions
        </Link>
        <p className="text-xs font-normal tracking-[-0.36px] text-[#0f3e17] bg-[#b6ced5] rounded-full px-[14px] py-[7px] inline-flex mb-[14px] ml-3">
          Review
        </p>
        <h1
          className="text-[40px] leading-[1.35] tracking-[-0.4px] text-[#0f3e17]"
          style={{ fontFamily: "var(--font-fraunces, Fraunces, Georgia, serif)", fontWeight: 300 }}
        >
          {DOC_TYPE_LABELS[submission.documentType] ?? submission.documentType}
        </h1>
        <div className="flex flex-wrap items-center gap-3 mt-[7px]">
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-[14px] py-[7px] text-xs font-normal tracking-[-0.36px]",
              STATUS_CLASSES[submission.status] ?? "border-[#e5e7eb] bg-[#e1f4df] text-[#333333]",
            )}
          >
            {STATUS_LABELS[submission.status] ?? submission.status}
          </span>
          <p className="text-sm text-[#222222] font-normal tracking-[-0.42px]">
            Submitted by {submission.submittedBy.name ?? submission.submittedBy.email} on{" "}
            {submission.createdAt.toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
          {isResolved && submission.reviewedAt && (
            <p className="text-sm text-[#222222] font-normal tracking-[-0.42px]">
              Reviewed by {reviewer?.name ?? "Unknown reviewer"} at{" "}
              {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(submission.reviewedAt))}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-[21px]">
        <div className="grid gap-[21px] md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Submission details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <DetailRow label="Document type" value={DOC_TYPE_LABELS[submission.documentType] ?? submission.documentType} />
              <DetailRow label="Reporting period" value={submission.reportingPeriod.label} />
              {periodMismatch && (
                <div className="rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 tracking-[-0.36px]">
                  Captured on{" "}
                  {captureDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}{" "}
                  — outside this reporting period&apos;s date range. It was booked into
                  the most recent period; check the period setup if this is unexpected.
                </div>
              )}
              {submission.site && (
                <DetailRow
                  label="Site"
                  value={
                    submission.site.project?.name
                      ? `${submission.site.project.name} — ${submission.site.name}`
                      : submission.site.name
                  }
                />
              )}
              {submission.contract && (
                <DetailRow label="Contract" value={submission.contract.name} />
              )}
              {submission.emissionCategory && (
                <DetailRow
                  label="Category"
                  value={`Scope ${submission.emissionCategory.scope}: ${submission.emissionCategory.name}`}
                />
              )}
              {submission.facility && (
                <DetailRow label="Facility" value={submission.facility.name} />
              )}
              {formData && Object.entries(formData).map(([key, value]) => (
                value != null && value !== "" ? (
                  <DetailRow
                    key={key}
                    label={key.replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim()}
                    value={String(value)}
                  />
                ) : null
              ))}
              {submission.reviewNote && (
                <DetailRow label="Review note" value={submission.reviewNote} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Location & distance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {submission.gpsLat != null && submission.gpsLng != null && (
                <DetailRow
                  label="Device GPS"
                  value={`${Number(submission.gpsLat).toFixed(5)}, ${Number(submission.gpsLng).toFixed(5)}`}
                />
              )}
              {submission.pickupLat != null && submission.pickupLng != null && (
                <DetailRow
                  label="Pickup"
                  value={`${Number(submission.pickupLat).toFixed(5)}, ${Number(submission.pickupLng).toFixed(5)}`}
                />
              )}
              {submission.deliveryLat != null && submission.deliveryLng != null && (
                <DetailRow
                  label="Delivery"
                  value={`${Number(submission.deliveryLat).toFixed(5)}, ${Number(submission.deliveryLng).toFixed(5)}`}
                />
              )}
              {submission.calculatedDistanceKm != null && (
                <DetailRow
                  label="Road distance"
                  value={`${Number(submission.calculatedDistanceKm).toFixed(2)} km${submission.distanceSource ? ` (${submission.distanceSource === "gps_osrm" ? "OSRM" : submission.distanceSource === "gps_haversine" ? "straight-line" : submission.distanceSource})` : ""}`}
                />
              )}
              {submission.gpsLat == null && submission.pickupLat == null && (
                <p className="text-sm text-[#333333] italic tracking-[-0.42px]">No location captured</p>
              )}
            </CardContent>
          </Card>
        </div>

        {comparisonRows.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Document verification
                {mismatchCount > 0 && (
                  <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-normal text-amber-800">
                    {mismatchCount} field{mismatchCount !== 1 ? "s" : ""} differ
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                What the OCR read from the photo vs. what the field worker submitted.
                Highlighted rows changed after auto-extraction — verify against the photo below.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-[10px] border border-[#e5e7eb]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#e5e7eb] bg-[#f9fafb]">
                      <th className="px-3 py-2 text-left text-xs font-normal uppercase tracking-wide text-[#333333]">Field</th>
                      <th className="px-3 py-2 text-left text-xs font-normal uppercase tracking-wide text-[#333333]">Read from photo</th>
                      <th className="px-3 py-2 text-left text-xs font-normal uppercase tracking-wide text-[#333333]">Submitted</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e5e7eb]">
                    {comparisonRows.map((row) => (
                      <tr key={row.key} className={row.mismatch ? "bg-amber-50" : undefined}>
                        <td className="px-3 py-2 text-xs text-[#333333] tracking-[-0.36px] capitalize">
                          {row.key.replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim()}
                        </td>
                        <td className="px-3 py-2 text-[#222222] tracking-[-0.42px]">
                          {row.ocrText ?? <span className="text-[#999] italic">not read</span>}
                        </td>
                        <td className={`px-3 py-2 tracking-[-0.42px] ${row.mismatch ? "font-medium text-amber-900" : "text-[#222222]"}`}>
                          {row.formText ?? <span className="text-[#999] italic">not provided</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Evidence files{" "}
              <span className="text-sm font-normal text-[#333333]">({submission.files.length})</span>
            </CardTitle>
            <CardDescription>
              Photos and documents captured in the field or uploaded by the submitter.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {submission.files.length === 0 ? (
              <p className="text-sm text-[#333333] italic tracking-[-0.42px]">No evidence files attached</p>
            ) : (
              <div className="space-y-3">
                {/* Inline previews so reviewers verify against the actual
                    ticket photo without downloading. The download route 302s
                    to a presigned URL, which <img> follows. */}
                {submission.files.some((f) => IMAGE_EXTENSIONS.test(f.evidenceFile.filename)) && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {submission.files
                      .filter((f) => IMAGE_EXTENSIONS.test(f.evidenceFile.filename))
                      .map((file) => (
                        <a
                          key={file.evidenceFile.id}
                          href={`/api/orgs/${orgId}/evidence/${file.evidenceFile.id}/download`}
                          target="_blank"
                          rel="noreferrer"
                          className="group block overflow-hidden rounded-[10px] border border-[#e5e7eb]"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`/api/orgs/${orgId}/evidence/${file.evidenceFile.id}/download`}
                            alt={`Evidence: ${file.evidenceFile.filename}`}
                            className="h-56 w-full object-cover transition-transform group-hover:scale-[1.02]"
                            loading="lazy"
                          />
                          <p className="truncate border-t border-[#e5e7eb] bg-[#f9fafb] px-3 py-1.5 text-xs text-[#333333] tracking-[-0.36px]">
                            {file.evidenceFile.filename}
                          </p>
                        </a>
                      ))}
                  </div>
                )}
                <SubmissionEvidenceDownloads
                  orgId={orgId}
                  files={submission.files.map((file) => ({
                    id: file.evidenceFile.id,
                    filename: file.evidenceFile.filename,
                  }))}
                />
                {submission.files.some((f) => f.evidenceFile.classifications.length > 0) && (
                  <div className="divide-y divide-[#e5e7eb] rounded-[10px] border border-[#e5e7eb] mt-3">
                    {submission.files.map((file) => {
                      const cls = file.evidenceFile.classifications[0];
                      if (!cls) return null;
                      const score = cls.confidenceScore;
                      const scoreColor =
                        score >= 80 ? "text-[#0f3e17]" : score >= 50 ? "text-amber-700" : "text-red-600";
                      const scoreBg =
                        score >= 80 ? "bg-[#e1f4df]" : score >= 50 ? "bg-amber-50" : "bg-red-50";
                      return (
                        <div key={file.evidenceFile.id} className="flex items-center justify-between px-3 py-2.5 gap-3">
                          <p className="text-xs text-[#222222] tracking-[-0.36px] truncate flex-1">
                            {file.evidenceFile.filename}
                          </p>
                          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${scoreBg}`}>
                            <span className={`text-xs font-medium ${scoreColor}`}>
                              {score}% confidence
                            </span>
                          </div>
                          <p className="text-[11px] text-[#555] tracking-[-0.33px] shrink-0">
                            {cls.documentType.replace(/_/g, " ")} · {cls.modelVersion}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {submission.activityRecordId && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Linked activity record</CardTitle>
              <CardDescription>
                This submission was approved and converted to a committed activity record.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <code className="text-xs bg-[#e1f4df] text-[#0f3e17] px-2 py-1 rounded-[7px]">
                  {submission.activityRecordId}
                </code>
                <Link
                  href={`/orgs/${orgId}/records/${submission.activityRecordId}`}
                  className="text-xs text-[#0f3e17] underline underline-offset-2 tracking-[-0.36px] hover:opacity-70"
                >
                  View record
                </Link>
              </div>
              {submission.status === "approved" && activityRecord?.calculations[0] && (
                <p className="mt-3 text-sm text-[#222222] tracking-[-0.42px]">
                  Calculated CO₂e:{" "}
                  <span className="font-medium text-[#0f3e17]">
                    {Number(activityRecord.calculations[0].totalCo2e).toFixed(2)} tCO₂e
                  </span>
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {submission.resubmittedFrom && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resubmission</CardTitle>
              <CardDescription>
                This is a corrected resubmission of an earlier rejected submission.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#333333] tracking-[-0.36px]">Original submission:</span>
                <Link
                  href={`/orgs/${orgId}/submissions/${submission.resubmittedFrom.id}`}
                  className="text-xs text-[#0f3e17] underline underline-offset-2 tracking-[-0.36px] hover:opacity-70"
                >
                  {DOC_TYPE_LABELS[submission.resubmittedFrom.documentType] ?? submission.resubmittedFrom.documentType}
                  {" · "}
                  {submission.resubmittedFrom.createdAt.toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {submission.resubmissions.length > 0 && submission.status === "rejected" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resubmission received</CardTitle>
              <CardDescription>
                The field worker has submitted a corrected version of this rejected submission.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-[10px] py-[5px] text-xs tracking-[-0.36px]",
                    STATUS_CLASSES[submission.resubmissions[0].status] ?? "border-[#e5e7eb] bg-[#e5e7eb] text-[#333333]",
                  )}
                >
                  {STATUS_LABELS[submission.resubmissions[0].status] ?? submission.resubmissions[0].status}
                </span>
                <Link
                  href={`/orgs/${orgId}/submissions/${submission.resubmissions[0].id}`}
                  className="text-xs text-[#0f3e17] underline underline-offset-2 tracking-[-0.36px] hover:opacity-70"
                >
                  Review resubmission
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Comments</CardTitle>
            <CardDescription>
              Add notes for the field worker or internal review team.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {comments.length > 0 && (
              <div className="mb-4 divide-y divide-[#e5e7eb] rounded-[14px] border border-[#e5e7eb]">
                {comments.map((comment) => (
                  <div key={comment.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-normal text-[#0f3e17] tracking-[-0.42px]">
                        {comment.author.name ?? comment.author.email}
                      </p>
                      <time className="text-xs text-[#333333] tracking-[-0.36px]">
                        {comment.createdAt.toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </time>
                    </div>
                    <p className="mt-1 text-sm text-[#222222] tracking-[-0.42px]">{comment.body}</p>
                  </div>
                ))}
              </div>
            )}
            <SubmissionCommentActions
              orgId={orgId}
              submissionId={id}
              comments={comments.map((comment) => ({
                id: comment.id,
                body: comment.body,
                createdAt: comment.createdAt.toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                }),
                authorName: comment.author.name ?? comment.author.email,
              }))}
            />
          </CardContent>
        </Card>

        {!isResolved && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Edit submission values</CardTitle>
              <CardDescription>
                Correct OCR-extracted or field-worker-submitted values before approving.
                Saving recalculates the road distance from any updated GPS coordinates.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SubmissionEditActions
                orgId={orgId}
                submissionId={id}
                formData={(submission.formData ?? {}) as Record<string, unknown>}
                emissionCategoryId={submission.emissionCategoryId}
                facilityId={submission.facilityId}
                pickupLat={submission.pickupLat !== null ? Number(submission.pickupLat) : null}
                pickupLng={submission.pickupLng !== null ? Number(submission.pickupLng) : null}
                deliveryLat={submission.deliveryLat !== null ? Number(submission.deliveryLat) : null}
                deliveryLng={submission.deliveryLng !== null ? Number(submission.deliveryLng) : null}
                calculatedDistanceKm={submission.calculatedDistanceKm !== null ? Number(submission.calculatedDistanceKm) : null}
                distanceSource={submission.distanceSource}
                emissionCategories={emissionCategories}
                facilities={facilities}
              />
            </CardContent>
          </Card>
        )}

        {!isResolved && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Review actions</CardTitle>
              <CardDescription>
                Approve to create a committed activity record, or reject with a note.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SubmissionReviewActions
                orgId={orgId}
                submissionId={id}
                currentEmissionCategoryId={submission.emissionCategoryId}
                currentFacilityId={submission.facilityId}
                emissionCategories={emissionCategories}
                facilities={facilities}
                disabled={isResolved}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
      <p className="text-xs font-normal text-[#333333] tracking-[-0.36px] sm:w-32 shrink-0 capitalize">{label}</p>
      <p className="text-sm text-[#0f3e17] tracking-[-0.42px]">{value}</p>
    </div>
  );
}
