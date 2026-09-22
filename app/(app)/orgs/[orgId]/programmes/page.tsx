export const dynamic = "force-dynamic";

import { AuthError, requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NewProgrammeButton } from "./programmes-actions";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  on_hold: "bg-yellow-100 text-yellow-800",
  completed: "bg-blue-100 text-blue-800",
  cancelled: "bg-gray-100 text-gray-700",
};

interface PageProps {
  params: Promise<{ orgId: string }>;
}

export default async function ProgrammesPage({ params }: PageProps) {
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

  const programmes = await prisma.programme.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true, name: true, status: true, clientName: true,
      startDate: true, endDate: true, budgetTco2e: true,
      programmeManager: { select: { name: true } },
      _count: { select: { projects: true } },
    },
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Programmes</h1>
          <p className="text-sm text-muted-foreground mt-1">Group projects under programmes for portfolio-level carbon tracking.</p>
        </div>
        {canEdit && <NewProgrammeButton orgId={orgId} />}
      </div>

      {programmes.length === 0 ? (
        <div className="text-sm text-muted-foreground py-16 text-center">No programmes yet.</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {programmes.map((p) => (
            <Card key={p.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{p.name}</CardTitle>
                  <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[p.status] ?? "bg-gray-100 text-gray-700"}`}>
                    {p.status.replaceAll("_", " ")}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                {p.clientName && <div>Client: {p.clientName}</div>}
                {p.programmeManager?.name && <div>Manager: {p.programmeManager.name}</div>}
                <div>Projects: {p._count.projects}</div>
                {p.startDate && <div>Start: {new Date(p.startDate).toLocaleDateString("en-GB")}</div>}
                {p.endDate && <div>End: {new Date(p.endDate).toLocaleDateString("en-GB")}</div>}
                {p.budgetTco2e && <div>Budget: {Number(p.budgetTco2e).toLocaleString()} tCO2e</div>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
