export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { AuthError, requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { MsEditor } from "./ms-editor";

interface PageProps {
  params: Promise<{ orgId: string; msId: string }>;
}

export default async function MethodStatementDetailPage({ params }: PageProps) {
  const { orgId, msId } = await params;

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

  const ms = await prisma.methodStatement.findUnique({
    where: { id: msId },
    include: {
      createdBy: { select: { id: true, name: true } },
      signedOffBy: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
      site: { select: { id: true, name: true } },
    },
  });

  if (!ms || ms.organizationId !== orgId) {
    return <div className="p-8 text-sm text-red-600">Method statement not found.</div>;
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
    id: ms.id,
    orgId,
    title: ms.title,
    version: ms.version,
    status: ms.status as string,
    projectId: ms.projectId,
    siteId: ms.siteId,
    riskAssessmentText: ms.riskAssessmentText,
    methodText: ms.methodText,
    ppeRequired: ms.ppeRequired,
    sectionsJson: ms.sectionsJson ?? null,
    issuedAt: ms.issuedAt ? ms.issuedAt.toISOString().slice(0, 10) : null,
    expiresAt: ms.expiresAt ? ms.expiresAt.toISOString().slice(0, 10) : null,
    lockedAt: ms.lockedAt ? ms.lockedAt.toISOString() : null,
    revisionOf: ms.revisionOf,
    createdAt: ms.createdAt.toISOString(),
    updatedAt: ms.updatedAt.toISOString(),
    createdBy: ms.createdBy,
    signedOffBy: ms.signedOffBy,
    project: ms.project,
    site: ms.site,
  };

  return (
    <MsEditor
      ms={serialized}
      projects={projects}
      sites={sites}
      canEdit={canEdit}
      isAdmin={isAdmin}
    />
  );
}
