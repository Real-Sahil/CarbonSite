export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { AuthError, requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { EnvironmentalIncidentEditor } from "./env-incident-editor";

interface PageProps {
  params: Promise<{ orgId: string; reportId: string }>;
}

export default async function DetailPage({ params }: PageProps) {
  const { orgId, reportId } = await params;
  let canEdit = false, isAdmin = false;
  try {
    const result = await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");
    canEdit = ["admin", "editor"].includes(result.membership.role);
    isAdmin = result.membership.role === "admin";
  } catch (err) {
    if (err instanceof AuthError) redirect("/sign-in");
    return <div className="p-8 text-sm text-red-600">Access denied.</div>;
  }

  const report = await prisma.environmentalIncident.findUnique({
    where: { id: reportId },
    include: { createdBy: { select: { id: true, name: true } }, signedOffBy: { select: { id: true, name: true } }, project: { select: { id: true, name: true } }, site: { select: { id: true, name: true } } },
  });

  if (!report || report.organizationId !== orgId) {
    return <div className="p-8 text-sm text-red-600">Not found.</div>;
  }

  const [projects, sites] = await Promise.all([
    prisma.project.findMany({ where: { organizationId: orgId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.site.findMany({ where: { organizationId: orgId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <EnvironmentalIncidentEditor
      report={{
        id: report.id, orgId, title: report.title, version: report.version, status: report.status as string,
        projectId: report.projectId, siteId: report.siteId, sectionsJson: report.sectionsJson ?? null,
        incidentDate: report.incidentDate ? report.incidentDate.toISOString().slice(0, 10) : null,
        lockedAt: report.lockedAt ? report.lockedAt.toISOString() : null, revisionOf: report.revisionOf,
        createdAt: report.createdAt.toISOString(), updatedAt: report.updatedAt.toISOString(),
        createdBy: report.createdBy, signedOffBy: report.signedOffBy, project: report.project, site: report.site,
      }}
      projects={projects}
      sites={sites}
      canEdit={canEdit}
      isAdmin={isAdmin}
    />
  );
}
