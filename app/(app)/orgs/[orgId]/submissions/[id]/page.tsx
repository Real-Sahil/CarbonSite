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
        reportingPeriod: { select: { id: true, label: true } },
        emissionCategory: { select: { id: true, scope: true, name: true } },
        facility: { select: { id: true, name: true } },
        files: {
          include: {
            evidenceFile: { select: { id: true, filename: true } },
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
              <CardTitle className="text-base">Route information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {submission.pickupPostcode || submission.deliveryPostcode ? (
                <>
                  {submission.pickupPostcode && (
                    <DetailRow label="Pickup postcode" value={submission.pickupPostcode} />
                  )}
                  {submission.deliveryPostcode && (
                    <DetailRow label="Delivery postcode" value={submission.deliveryPostcode} />
                  )}
                  {submission.calculatedDistanceKm != null && (
                    <DetailRow
                      label="Distance"
                      value={`${Number(submission.calculatedDistanceKm).toFixed(2)} km${submission.distanceSource ? ` via ${submission.distanceSource}` : ""}`}
                    />
                  )}
                  {submission.pickupLat != null && submission.pickupLng != null && (
                    <DetailRow
                      label="Pickup coords"
                      value={`${Number(submission.pickupLat).toFixed(5)}, ${Number(submission.pickupLng).toFixed(5)}`}
                    />
                  )}
                  {submission.deliveryLat != null && submission.deliveryLng != null && (
                    <DetailRow
                      label="Delivery coords"
                      value={`${Number(submission.deliveryLat).toFixed(5)}, ${Number(submission.deliveryLng).toFixed(5)}`}
                    />
                  )}
                </>
              ) : (
                <p className="text-sm text-[#333333] italic tracking-[-0.42px]">No route information captured</p>
              )}
              {submission.gpsLat != null && submission.gpsLng != null && (
                <DetailRow
                  label="GPS location"
                  value={`${Number(submission.gpsLat).toFixed(5)}, ${Number(submission.gpsLng).toFixed(5)}`}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {ocrData && Object.keys(ocrData).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">OCR extracted data</CardTitle>
              <CardDescription>
                Data automatically extracted from the photographed document.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(ocrData).map(([key, value]) =>
                value != null && value !== "" ? (
                  <DetailRow
                    key={key}
                    label={key.replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim()}
                    value={String(value)}
                  />
                ) : null,
              )}
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
              <SubmissionEvidenceDownloads
                orgId={orgId}
                files={submission.files.map((file) => ({
                  id: file.evidenceFile.id,
                  filename: file.evidenceFile.filename,
                }))}
              />
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
