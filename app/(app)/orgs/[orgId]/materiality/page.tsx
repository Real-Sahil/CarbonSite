export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { AuthError } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NewAssessmentButton } from "./materiality-actions";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  published: "default",
  approved: "default",
  in_review: "secondary",
  draft: "outline",
};

export default async function MaterialityPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;

  let canEdit = false;
  try {
    const result = await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders);
    canEdit = ["admin", "editor"].includes(result.membership.role);
  } catch (err) {
    if (err instanceof AuthError) redirect("/sign-in");
    throw err;
  }

  const assessments = await prisma.materialityAssessment.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true, name: true, status: true, esrsScope: true,
      approvedAt: true, publishedAt: true, createdAt: true,
      reportingPeriod: { select: { id: true, label: true } },
      createdBy: { select: { name: true } },
      _count: { select: { topics: true } },
    },
  });

  const publishedCount = assessments.filter((a) => a.status === "published").length;
  const inProgressCount = assessments.filter((a) => a.status !== "published").length;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Materiality Assessment</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Double materiality assessments identifying financial and impact materiality topics.
          </p>
        </div>
        {canEdit && <NewAssessmentButton orgId={orgId} />}
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Published</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{publishedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inProgressCount}</div>
          </CardContent>
        </Card>
      </div>

      {assessments.length === 0 ? (
        <div className="text-sm text-muted-foreground py-16 text-center">
          No materiality assessments yet.
        </div>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Period</th>
                <th className="px-4 py-3 text-left font-medium">Topics</th>
                <th className="px-4 py-3 text-left font-medium">ESRS Scope</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Published</th>
                <th className="px-4 py-3 text-left font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {assessments.map((a) => (
                <tr key={a.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{a.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{a.reportingPeriod?.label ?? "-"}</td>
                  <td className="px-4 py-3">{a._count.topics}</td>
                  <td className="px-4 py-3 text-muted-foreground">{a.esrsScope ?? "-"}</td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[a.status] ?? "outline"}>
                      {a.status.replaceAll("_", " ")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {a.publishedAt ? new Date(a.publishedAt).toLocaleDateString("en-GB") : "-"}
                  </td>
                  <td className="px-4 py-3">{new Date(a.createdAt).toLocaleDateString("en-GB")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
