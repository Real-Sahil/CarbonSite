export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { AuthError, requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { BiodiversityAssessmentEditor } from "./biodiversity-assessment-editor";

interface PageProps {
  params: Promise<{ orgId: string; reportId: string }>;
}

export default async function BiodiversityAssessmentDetailPage({ params }: PageProps) {
  const { orgId, reportId } = await params;

  let canEdit = false;
  let isAdmin = false;
  try {
    const result = await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");
    canEdit = ["admin", "editor"].includes(result.membership.role);
    isAdmin = result.membership.role === "admin";
  } catch (err) {
    if (err instanceof AuthError) redirect("/sign-in");
    return <div className="p-8 text-sm text-red-600">Access denied.</div>;
  }

  const assessment = await prisma.biodiversityAssessment.findUnique({
    where: { id: reportId },
    include: {
      createdBy: { select: { id: true, name: true } },
      signedOffBy: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
      site: { select: { id: true, name: true } },
    },
  });

  if (!assessment || assessment.organizationId !== orgId) {
    return <div className="p-8 text-sm text-red-600">Biodiversity assessment not found.</div>;
  }

  const [projects, sites] = await Promise.all([
    prisma.project.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.site.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const serialized = {
    id: assessment.id,
    orgId,
    title: assessment.title,
    version: assessment.version,
    status: assessment.status as string,
    projectId: assessment.projectId,
    siteId: assessment.siteId,
    sectionsJson: assessment.sectionsJson ?? null,
    assessmentDate: assessment.assessmentDate ? assessment.assessmentDate.toISOString().slice(0, 10) : null,
    lockedAt: assessment.lockedAt ? assessment.lockedAt.toISOString() : null,
    revisionOf: assessment.revisionOf,
    createdAt: assessment.createdAt.toISOString(),
    updatedAt: assessment.updatedAt.toISOString(),
    createdBy: assessment.createdBy,
    signedOffBy: assessment.signedOffBy,
    project: assessment.project,
    site: assessment.site,
  };

  return (
    <BiodiversityAssessmentEditor
      assessment={serialized}
      projects={projects}
      sites={sites}
      canEdit={canEdit}
      isAdmin={isAdmin}
    />
  );
}
