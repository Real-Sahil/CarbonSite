import { requireOrgMember, AuthError } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { SubmissionDetail } from "./submission-detail";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

interface SubmissionDetailPageProps {
  params: Promise<{ orgId: string; submissionId: string }>;
}

export default async function SubmissionDetailPage({
  params,
}: SubmissionDetailPageProps) {
  const { orgId, submissionId } = await params;

  try {
    await requireOrgMember(orgId, "admin", "editor", "reviewer");

    const submission = await prisma.fieldSubmission.findFirst({
      where: { id: submissionId, organizationId: orgId },
      include: {
        submittedBy: { select: { id: true, name: true, email: true } },
        emissionCategory: { select: { id: true, name: true, scope: true } },
        facility: { select: { id: true, name: true } },
        reportingPeriod: { select: { id: true, label: true } },
        files: {
          include: { evidenceFile: { select: { id: true, fileName: true, mimeType: true } } },
        },
      },
    });

    if (!submission) {
      return (
        <div className="min-h-[100dvh] bg-[#F9FAFB]">
          <div className="max-w-[1200px] mx-auto px-8 py-8">
            <p className="text-red-600">Submission not found.</p>
          </div>
        </div>
      );
    }

    const emissionCategories = await prisma.emissionCategory.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, scope: true },
      orderBy: { scope: "asc" },
    });

    const facilities = await prisma.facility.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    return (
      <div className="min-h-[100dvh] bg-[#F9FAFB]">
        <div className="bg-white border-b border-[#E5E7EB]">
          <div className="max-w-[1200px] mx-auto px-8 py-4">
            <Link
              href={`/orgs/${orgId}/submissions`}
              className="flex items-center gap-1 text-sm text-[#374151] hover:text-[#111827] mb-3"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to submissions
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-[#111827]">
              Review submission
            </h1>
          </div>
        </div>

        <div className="max-w-[1200px] mx-auto px-8 py-8">
          <SubmissionDetail
            submission={submission}
            emissionCategories={emissionCategories}
            facilities={facilities}
            orgId={orgId}
          />
        </div>
      </div>
    );
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/sign-in");
      return (
        <div className="min-h-[100dvh] bg-[#F9FAFB]">
          <div className="max-w-[1200px] mx-auto px-8 py-8">
            <p className="text-red-600">You do not have permission to view this submission.</p>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-[100dvh] bg-[#F9FAFB]">
        <div className="max-w-[1200px] mx-auto px-8 py-8">
          <p className="text-red-600 text-sm">Failed to load submission details.</p>
        </div>
      </div>
    );
  }
}
