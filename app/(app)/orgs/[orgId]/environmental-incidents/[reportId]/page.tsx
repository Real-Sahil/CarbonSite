export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AuthError, requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { asSections, lookupPeople } from "@/lib/structured-forms/people";
import { isLockedStatus } from "@/lib/structured-forms/workflows";
import { EnvironmentalIncidentEditor } from "./env-incident-editor";

interface PageProps {
  params: Promise<{ orgId: string; reportId: string }>;
}

export default async function EnvironmentalIncidentDetailPage({ params }: PageProps) {
  const { orgId, reportId } = await params;

  let canEdit = false;
  let isAdmin = false;
  try {
    const result = await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders);
    canEdit = ["admin", "editor"].includes(result.membership.role);
    isAdmin = result.membership.role === "admin";
  } catch (err) {
    if (err instanceof AuthError) redirect("/sign-in");
    return <div className="p-8 text-sm text-red-600">Access denied.</div>;
  }

  const report = await prisma.environmentalIncident.findFirst({
    where: { id: reportId, organizationId: orgId },
  });

  if (!report || report.organizationId !== orgId) {
    return <div className="p-8 text-sm text-red-600">Environmental incident not found.</div>;
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

  const person = await lookupPeople([report.createdByUserId, report.signedOffByUserId]);

  const serialized = {
    id: report.id,
    orgId,
    title: report.title ?? "",
    version: report.version,
    status: report.status as string,
    projectId: report.projectId,
    siteId: report.siteId,
    sectionsJson: asSections(report.sectionsJson),
    incidentDate: report.occurredAt ? report.occurredAt.toISOString().slice(0, 10) : null,
    lockedAt: isLockedStatus("environmental-incidents", report.status) ? (report.lockedAt ?? report.updatedAt).toISOString() : null,
    revisionOf: report.revisionOf,
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString(),
    createdBy: person(report.createdByUserId),
    signedOffBy: person(report.signedOffByUserId),
    project: projects.find((p) => p.id === report.projectId) ?? null,
    site: sites.find((x) => x.id === report.siteId) ?? null,
  };

  return (
    <>
      <div className="border-b bg-white px-4 py-2">
        <Link href={`/orgs/${orgId}/environment/incidents`} className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Incident register
        </Link>
      </div>
      <EnvironmentalIncidentEditor
        report={serialized}
        projects={projects}
        sites={sites}
        canEdit={canEdit}
        isAdmin={isAdmin}
      />
    </>
  );
}
