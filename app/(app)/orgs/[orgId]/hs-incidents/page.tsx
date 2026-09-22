export const dynamic = "force-dynamic";

import { AuthError, requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportIncidentButton } from "./hs-incidents-actions";

const STATUS_COLORS: Record<string, string> = {
  reported: "bg-yellow-100 text-yellow-800",
  investigating: "bg-blue-100 text-blue-800",
  action_required: "bg-orange-100 text-orange-800",
  closed: "bg-green-100 text-green-800",
};

interface PageProps {
  params: Promise<{ orgId: string }>;
}

export default async function HsIncidentsPage({ params }: PageProps) {
  const { orgId } = await params;

  let canEdit = false;
  try {
    const result = await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);
    canEdit = ["admin", "editor"].includes(result.membership.role);
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/sign-in");
      return <div className="p-8 text-sm text-red-600">Access denied.</div>;
    }
    return <div className="p-8 text-sm text-red-600">Failed to load page. Try refreshing.</div>;
  }

  const incidents = await prisma.hsIncidentReport.findMany({
    where: { organizationId: orgId },
    orderBy: { occurredAt: "desc" },
    take: 100,
    select: {
      id: true,
      reference: true,
      incidentType: true,
      status: true,
      occurredAt: true,
      description: true,
      lostTimeDays: true,
      riddorReportable: true,
      reportedBy: { select: { name: true } },
    },
  });

  const openCount = incidents.filter((i) => i.status !== "closed").length;
  const riddorCount = incidents.filter((i) => i.riddorReportable).length;
  const closedCount = incidents.filter((i) => i.status === "closed").length;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">H&S Incident Register</h1>
          <p className="text-sm text-muted-foreground mt-1">Track, investigate, and close health and safety incidents.</p>
        </div>
        {canEdit && <ReportIncidentButton orgId={orgId} />}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Open / Investigating</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{openCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">RIDDOR Reportable</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-red-600">{riddorCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Closed</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{closedCount}</div></CardContent>
        </Card>
      </div>

      {incidents.length === 0 ? (
        <div className="text-sm text-muted-foreground py-16 text-center">No incidents recorded. Use the button above to report one.</div>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-4 py-3 text-left font-medium">Reference</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Occurred</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">LTI Days</th>
                <th className="px-4 py-3 text-left font-medium">RIDDOR</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((inc) => (
                <tr key={inc.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3 font-mono text-xs">{inc.reference}</td>
                  <td className="px-4 py-3 capitalize">{inc.incidentType.replaceAll("_", " ")}</td>
                  <td className="px-4 py-3">{new Date(inc.occurredAt).toLocaleDateString("en-GB")}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[inc.status] ?? "bg-gray-100 text-gray-700"}`}>
                      {inc.status.replaceAll("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">{inc.lostTimeDays}</td>
                  <td className="px-4 py-3">{inc.riddorReportable ? <Badge variant="destructive">Yes</Badge> : <span className="text-muted-foreground">No</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
