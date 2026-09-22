export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { AuthError, requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { asSections, lookupPeople } from "@/lib/structured-forms/people";
import { isLockedStatus } from "@/lib/structured-forms/workflows";
import { AssuranceEngagementEditor } from "./assurance-engagement-editor";

interface PageProps {
  params: Promise<{ orgId: string; reportId: string }>;
}

export default async function AssuranceEngagementDetailPage({ params }: PageProps) {
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

  const engagement = await prisma.assuranceEngagement.findFirst({
    where: { id: reportId, organizationId: orgId },
  });

  if (!engagement || engagement.organizationId !== orgId) {
    return <div className="p-8 text-sm text-red-600">Assurance engagement not found.</div>;
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

  const person = await lookupPeople([engagement.createdByUserId, engagement.signedOffByUserId]);

  const serialized = {
    id: engagement.id,
    orgId,
    title: engagement.title ?? "",
    version: engagement.version,
    status: engagement.status as string,
    projectId: null as string | null,
    siteId: null as string | null,
    sectionsJson: asSections(engagement.sectionsJson),
    engagementDate: engagement.plannedStartDate ? engagement.plannedStartDate.toISOString().slice(0, 10) : null,
    lockedAt: isLockedStatus("assurance-engagements", engagement.status) ? (engagement.lockedAt ?? engagement.updatedAt).toISOString() : null,
    revisionOf: engagement.revisionOf,
    createdAt: engagement.createdAt.toISOString(),
    updatedAt: engagement.updatedAt.toISOString(),
    createdBy: person(engagement.createdByUserId),
    signedOffBy: person(engagement.signedOffByUserId),
    project: null,
    site: null,
  };

  return (
    <AssuranceEngagementEditor
      engagement={serialized}
      projects={projects}
      sites={sites}
      canEdit={canEdit}
      isAdmin={isAdmin}
    />
  );
}
