export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { AuthError, requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { CrpWizard } from "./crp-wizard";

type Props = { params: Promise<{ orgId: string; planId: string }> };

export default async function CarbonReductionPlanPage({ params }: Props) {
  const { orgId, planId } = await params;
  let canEdit = false;
  let canSetBaseYear = false;
  try {
    const { membership } = await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders);
    canEdit = (ROLE_GROUPS.editor as string[]).includes(membership.role);
    canSetBaseYear = ["admin", "sustainability_director"].includes(membership.role);
  } catch (err) {
    if (err instanceof AuthError) redirect("/sign-in");
    return <div className="p-8 text-sm text-red-600">Access denied.</div>;
  }

  const plan = await prisma.carbonReductionPlan.findFirst({ where: { id: planId, organizationId: orgId }, select: { id: true } });
  if (!plan) return <div className="p-8 text-sm text-red-600">Carbon Reduction Plan not found.</div>;

  const periods = await prisma.reportingPeriod.findMany({
    where: { organizationId: orgId },
    orderBy: { startDate: "asc" },
    select: { id: true, label: true },
  });

  return <CrpWizard orgId={orgId} planId={planId} canEdit={canEdit} canSetBaseYear={canSetBaseYear} periods={periods} />;
}
