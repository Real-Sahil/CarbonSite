import { requireOrgMember, AuthError } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { SubmissionReviewActions } from "./review-actions";
import { SubmissionEvidenceDownloads } from "./evidence-download-actions";

interface SubmissionsPageProps {
  params: Promise<{ orgId: string }>;
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
  pending:
    "border-yellow-200 bg-yellow-50 text-yellow-800",
  submitted:
    "border-blue-200 bg-blue-50 text-blue-800",
  under_review:
    "border-purple-200 bg-purple-50 text-purple-800",
  approved:
    "border-green-200 bg-green-50 text-green-800",
  rejected:
    "border-red-200 bg-red-50 text-red-800",
  needs_info:
    "border-orange-200 bg-orange-50 text-orange-800",
};

const DOC_TYPE_LABELS: Record<string, string> = {
  waste_ticket: "Waste ticket",
  delivery_note: "Delivery note",
  fuel_receipt: "Fuel receipt",
  other: "Other",
};

export default async function SubmissionsPage({
  params,
}: SubmissionsPageProps) {
  const { orgId } = await params;

  try {
    await requireOrgMember(orgId, "admin", "editor", "reviewer");
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/sign-in");
      return (
        <div className="p-8">
          <p className="text-red-600">
            You do not have permission to view submissions.
          </p>
        </div>
      );
    }
    throw err;
  }

  const submissions = await prisma.fieldSubmission.findMany({
    where: { organizationId: orgId },
    include: {
      submittedBy: { select: { name: true, email: true } },
      reportingPeriod: { select: { label: true } },
      emissionCategory: { select: { id: true, scope: true, name: true } },
      facility: { select: { name: true } },
      files: {
        include: {
          evidenceFile: { select: { id: true, filename: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const [emissionCategories, facilities] = await Promise.all([
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

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">
          Field submissions
        </h1>
        <p className="text-slate-500 mt-1">
          Review incoming submissions from field workers before approving them
          as activity records.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Submissions
            <span className="ml-2 text-sm font-normal text-slate-500">
              ({submissions.length})
            </span>
          </CardTitle>
          {submissions.length === 0 && (
            <CardDescription>
              Share an invite link with your field workers to get started.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className={submissions.length === 0 ? "pb-8" : "p-0 pb-2"}>
          {submissions.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                <Inbox className="h-7 w-7 text-slate-400" />
              </div>
              <div>
                <p className="font-medium text-slate-700">
                  No field submissions yet
                </p>
                <p className="text-sm text-slate-500 mt-1 max-w-sm">
                  Share an invite link with your field workers to get started.
                  Field workers photograph waste tickets, delivery notes, and
                  fuel receipts directly from the mobile app.
                </p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted by</TableHead>
                  <TableHead>Reporting period</TableHead>
                  <TableHead>Facility</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Evidence</TableHead>
                  <TableHead>Record</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      {DOC_TYPE_LABELS[s.documentType] ?? s.documentType}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                          STATUS_CLASSES[s.status] ??
                            "border-slate-200 bg-slate-50 text-slate-700"
                        )}
                      >
                        {STATUS_LABELS[s.status] ?? s.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {s.submittedBy.name ?? s.submittedBy.email}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {s.reportingPeriod.label}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {s.facility?.name ?? (
                        <span className="text-slate-400 italic">None</span>
                      )}
                      {s.emissionCategory && (
                        <p className="mt-1 text-xs text-slate-500">
                          Scope {s.emissionCategory.scope}: {s.emissionCategory.name}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {s.pickupPostcode && s.deliveryPostcode
                        ? `${s.pickupPostcode} to ${s.deliveryPostcode}`
                        : "No route"}
                    </TableCell>
                    <TableCell>
                      <SubmissionEvidenceDownloads
                        orgId={orgId}
                        files={s.files.map((file) => ({
                          id: file.evidenceFile.id,
                          filename: file.evidenceFile.filename,
                        }))}
                      />
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {s.activityRecordId ? (
                        <span className="font-mono text-xs">
                          {s.activityRecordId.slice(0, 8)}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Not created</span>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm">
                      {s.createdAt.toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell>
                      <SubmissionReviewActions
                        orgId={orgId}
                        submissionId={s.id}
                        currentEmissionCategoryId={s.emissionCategoryId}
                        currentFacilityId={s.facilityId}
                        emissionCategories={emissionCategories}
                        facilities={facilities}
                        disabled={s.status === "approved" || s.status === "rejected"}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
