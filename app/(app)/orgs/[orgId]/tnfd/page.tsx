export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { Leaf } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { AuthError } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NewTnfdScenarioButton } from "./tnfd-actions";

const RISK_CLASSES: Record<string, string> = {
  low: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

export default async function TnfdPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;

  let canEdit = false;
  try {
    const result = await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders);
    canEdit = ["admin", "editor"].includes(result.membership.role);
  } catch (err) {
    if (err instanceof AuthError) redirect("/sign-in");
    throw err;
  }

  const scenarios = await prisma.tnfdScenario.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true, name: true, riskRating: true, timeHorizon: true,
      gbfTarget: true, sectorScope: true,
      financialImpactLow: true, financialImpactHigh: true,
      createdAt: true,
      createdBy: { select: { name: true } },
    },
  });

  const criticalCount = scenarios.filter((s) => s.riskRating === "critical" || s.riskRating === "high").length;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">TNFD Scenarios</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Nature-related financial disclosure scenarios using the LEAP framework.
          </p>
        </div>
        {canEdit && <NewTnfdScenarioButton orgId={orgId} />}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Scenarios</CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{scenarios.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">High / Critical Risk</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${criticalCount > 0 ? "text-red-600" : ""}`}>{criticalCount}</div>
          </CardContent>
        </Card>
      </div>

      {scenarios.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-3 text-center">
          <Leaf className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            No TNFD scenarios yet. Use the LEAP framework to assess nature-related risks and opportunities.
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-4 py-3 text-left font-medium">Scenario</th>
                <th className="px-4 py-3 text-left font-medium">GBF Target</th>
                <th className="px-4 py-3 text-left font-medium">Sector Scope</th>
                <th className="px-4 py-3 text-left font-medium">Time Horizon</th>
                <th className="px-4 py-3 text-left font-medium">Risk Rating</th>
                <th className="px-4 py-3 text-left font-medium">Financial Impact</th>
                <th className="px-4 py-3 text-left font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((s) => (
                <tr key={s.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.gbfTarget ?? "-"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.sectorScope ?? "-"}</td>
                  <td className="px-4 py-3 capitalize">{s.timeHorizon?.replaceAll("_", " ") ?? "-"}</td>
                  <td className="px-4 py-3">
                    {s.riskRating ? (
                      <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${RISK_CLASSES[s.riskRating] ?? "bg-gray-100 text-gray-700"}`}>
                        {s.riskRating}
                      </span>
                    ) : "-"}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {s.financialImpactLow != null || s.financialImpactHigh != null ? (
                      <>
                        {s.financialImpactLow != null ? `£${Number(s.financialImpactLow).toLocaleString()}` : ""}
                        {s.financialImpactLow != null && s.financialImpactHigh != null ? " - " : ""}
                        {s.financialImpactHigh != null ? `£${Number(s.financialImpactHigh).toLocaleString()}` : ""}
                      </>
                    ) : "-"}
                  </td>
                  <td className="px-4 py-3">{new Date(s.createdAt).toLocaleDateString("en-GB")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
