export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { AuthError, requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { EnvironmentalPermitEditor } from "./env-permit-editor";

interface PageProps {
  params: Promise<{ orgId: string; reportId: string }>;
}

export default async function EnvironmentalPermitDetailPage({ params }: PageProps) {
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

  const permit = await prisma.environmentalPermit.findUnique({
    where: { id: reportId },
    include: {
      createdBy: { select: { id: true, name: true } },
      signedOffBy: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
      site: { select: { id: true, name: true } },
    },
  });

  if (!permit || permit.organizationId !== orgId) {
    return <div className="p-8 text-sm text-red-600">Environmental permit not found.</div>;
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
    id: permit.id,
    orgId,
    title: permit.title,
    version: permit.version,
    status: permit.status as string,
    projectId: permit.projectId,
    siteId: permit.siteId,
    sectionsJson: permit.sectionsJson ?? null,
    permitDate: permit.permitDate ? permit.permitDate.toISOString().slice(0, 10) : null,
    expiryDate: permit.expiryDate ? permit.expiryDate.toISOString().slice(0, 10) : null,
    lockedAt: permit.lockedAt ? permit.lockedAt.toISOString() : null,
    revisionOf: permit.revisionOf,
    createdAt: permit.createdAt.toISOString(),
    updatedAt: permit.updatedAt.toISOString(),
    createdBy: permit.createdBy,
    signedOffBy: permit.signedOffBy,
    project: permit.project,
    site: permit.site,
  };

  return (
    <EnvironmentalPermitEditor
      permit={serialized}
      projects={projects}
      sites={sites}
      canEdit={canEdit}
      isAdmin={isAdmin}
    />
  );
}
