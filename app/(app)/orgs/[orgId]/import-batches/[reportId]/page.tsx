export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { AuthError, requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { ImportBatchEditor } from "./import-batch-editor";

interface PageProps {
  params: Promise<{ orgId: string; reportId: string }>;
}

export default async function ImportBatchDetailPage({ params }: PageProps) {
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

  const batch = await prisma.importBatch.findUnique({
    where: { id: reportId },
    include: {
      createdBy: { select: { id: true, name: true } },
      signedOffBy: { select: { id: true, name: true } },
    },
  });

  if (!batch || batch.organizationId !== orgId) {
    return <div className="p-8 text-sm text-red-600">Import batch not found.</div>;
  }

  const serialized = {
    id: batch.id,
    orgId,
    title: batch.title,
    version: batch.version,
    status: batch.status as string,
    sectionsJson: batch.sectionsJson ?? null,
    lockedAt: batch.lockedAt ? batch.lockedAt.toISOString() : null,
    revisionOf: batch.revisionOf,
    createdAt: batch.createdAt.toISOString(),
    updatedAt: batch.updatedAt.toISOString(),
    createdBy: batch.createdBy,
    signedOffBy: batch.signedOffBy,
  };

  return (
    <ImportBatchEditor
      batch={serialized}
      canEdit={canEdit}
      isAdmin={isAdmin}
    />
  );
}
