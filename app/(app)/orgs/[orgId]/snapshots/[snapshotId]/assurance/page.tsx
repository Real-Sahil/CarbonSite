export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { AuthError, requireOrgMember } from "@/lib/auth/session";
import { AssuranceClient } from "./assurance-client";

interface Props {
  params: Promise<{ orgId: string; snapshotId: string }>;
}

export default async function SnapshotAssurancePage({ params }: Props) {
  const { orgId, snapshotId } = await params;

  let role: string;
  try {
    const { membership } = await requireOrgMember(orgId, "admin", "auditor", "reviewer");
    role = membership.role;
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/sign-in");
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-8">
          <div className="rounded-full bg-amber-50 p-4 mb-4">
            <svg className="h-6 w-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h2 className="text-sm font-semibold text-gray-900 mb-1">Auditor access required</h2>
          <p className="text-sm text-gray-500 max-w-sm">
            Reviewing snapshot assurance requires admin or auditor access.
          </p>
        </div>
      );
    }
    throw err;
  }

  const snapshot = await prisma.publishedSnapshot.findUnique({
    where: { id: snapshotId, organizationId: orgId },
    select: {
      id: true,
      version: true,
      publishedAt: true,
      reportingPeriod: { select: { label: true } },
      publishedBy: { select: { name: true, email: true } },
      assurance: {
        select: {
          id: true,
          status: true,
          notes: true,
          signedAt: true,
          createdAt: true,
          auditor: { select: { name: true, email: true } },
        },
      },
    },
  });

  if (!snapshot) {
    return (
      <div className="p-8">
        <p className="text-sm text-gray-500">Snapshot not found.</p>
      </div>
    );
  }

  return (
    <AssuranceClient
      orgId={orgId}
      snapshotId={snapshotId}
      snapshot={{
        version: snapshot.version,
        publishedAt: snapshot.publishedAt.toISOString(),
        periodLabel: snapshot.reportingPeriod.label,
        publishedBy: snapshot.publishedBy.name ?? snapshot.publishedBy.email,
      }}
      existingAssurance={
        snapshot.assurance
          ? {
              id: snapshot.assurance.id,
              status: snapshot.assurance.status as "pending" | "approved" | "rejected",
              notes: snapshot.assurance.notes,
              signedAt: snapshot.assurance.signedAt?.toISOString() ?? null,
              createdAt: snapshot.assurance.createdAt.toISOString(),
              auditorName: snapshot.assurance.auditor.name ?? snapshot.assurance.auditor.email,
            }
          : null
      }
      role={role}
    />
  );
}
