export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { AuthError } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NewScenarioButton } from "./tcfd-actions";
import { TcfdTabs } from "./tcfd-tabs";

export default async function TcfdPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;

  let canEdit = false;
  try {
    const result = await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders);
    canEdit = ["admin", "editor"].includes(result.membership.role);
  } catch (err) {
    if (err instanceof AuthError) redirect("/sign-in");
    throw err;
  }

  const scenarios = await prisma.tcfdScenario.findMany({
    where: { organizationId: orgId },
    include: {
      riskAssessments: {
        select: { id: true, riskCategory: true, likelihood: true, impact: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const physicalCount = scenarios.filter((s) => s.scenarioType === "physical").length;
  const transitionCount = scenarios.filter((s) => s.scenarioType === "transition").length;
  const totalRisks = scenarios.reduce((sum, s) => sum + s.riskAssessments.length, 0);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">TCFD Scenarios</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Model physical and transition climate risks under the TCFD framework.
          </p>
        </div>
        {canEdit && <NewScenarioButton orgId={orgId} />}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Physical Scenarios</CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{physicalCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Transition Scenarios</CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{transitionCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Risks Assessed</CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalRisks}</div></CardContent>
        </Card>
      </div>

      <TcfdTabs
        scenarios={scenarios.map((s) => ({
          ...s,
          grossValueAtRiskLow: s.grossValueAtRiskLow != null ? Number(s.grossValueAtRiskLow) : null,
          grossValueAtRiskHigh: s.grossValueAtRiskHigh != null ? Number(s.grossValueAtRiskHigh) : null,
        }))}
        orgId={orgId}
        canEdit={canEdit}
      />
    </div>
  );
}
