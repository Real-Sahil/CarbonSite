export const dynamic = "force-dynamic";

// Data completeness matrix: which facility x emission category combinations
// the org expects data for each period, graded live against actual
// ActivityRecord coverage. See lib/inventory/completeness.ts for the RAG
// grading rules and app/api/orgs/[orgId]/completeness/matrix/route.ts for
// how a period's grid is computed.

import { AuthError, requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import type { OrgRole } from "@prisma/client";
import { CompletenessMatrixClient } from "./completeness-matrix-client";

const EDIT_ROLES: OrgRole[] = ["admin", "sustainability_director", "sustainability_manager", "editor"];

interface Props {
  params: Promise<{ orgId: string }>;
}

export default async function CompletenessPage({ params }: Props) {
  const { orgId } = await params;

  let role: OrgRole;
  try {
    const result = await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);
    role = result.membership.role;
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/sign-in");
      return <AccessDenied />;
    }
    return (
      <div className="p-8">
        <p className="text-sm text-red-600">
          Failed to load page. The database may be updating — try refreshing in a moment.
        </p>
      </div>
    );
  }

  const [facilities, categories, members, reportingPeriods] = await Promise.all([
    prisma.facility.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.emissionCategory.findMany({
      select: { id: true, code: true, name: true, scope: true },
      orderBy: [{ scope: "asc" }, { name: "asc" }],
    }),
    prisma.organizationMembership.findMany({
      where: { organizationId: orgId },
      select: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.reportingPeriod.findMany({
      where: { organizationId: orgId },
      select: { id: true, label: true },
      orderBy: { startDate: "desc" },
    }),
  ]);

  return (
    <CompletenessMatrixClient
      orgId={orgId}
      canEdit={EDIT_ROLES.includes(role)}
      facilities={facilities}
      categories={categories}
      members={members.map((m) => m.user)}
      reportingPeriods={reportingPeriods}
    />
  );
}

function AccessDenied() {
  return (
    <div className="p-8">
      <p className="text-sm text-red-600">You do not have permission to view the completeness matrix.</p>
    </div>
  );
}
