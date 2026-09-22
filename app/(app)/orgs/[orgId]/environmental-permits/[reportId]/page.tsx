export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { AuthError, requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { asSections, lookupPeople } from "@/lib/structured-forms/people";
import { isLockedStatus } from "@/lib/structured-forms/workflows";
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

  const permit = await prisma.environmentalPermit.findFirst({
    where: { id: reportId, organizationId: orgId },
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

  const person = await lookupPeople([permit.createdByUserId, permit.signedOffByUserId]);

  const serialized = {
    id: permit.id,
    orgId,
    title: permit.title ?? "",
    version: permit.version,
    status: permit.status as string,
    projectId: null as string | null,
    siteId: permit.siteId,
    sectionsJson: asSections(permit.sectionsJson),
    permitDate: permit.issuedOn ? permit.issuedOn.toISOString().slice(0, 10) : null,
    expiryDate: permit.expiresOn ? permit.expiresOn.toISOString().slice(0, 10) : null,
    lockedAt: isLockedStatus("environmental-permits", permit.status) ? (permit.lockedAt ?? permit.updatedAt).toISOString() : null,
    revisionOf: permit.revisionOf,
    createdAt: permit.createdAt.toISOString(),
    updatedAt: permit.updatedAt.toISOString(),
    createdBy: person(permit.createdByUserId),
    signedOffBy: person(permit.signedOffByUserId),
    project: null,
    site: sites.find((x) => x.id === permit.siteId) ?? null,
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
