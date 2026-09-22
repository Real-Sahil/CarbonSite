export const dynamic = "force-dynamic";

import { AuthError, requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import type { OrgRole } from "@prisma/client";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { ResolveAlertButton, CreateAlertButton } from "./alerts-actions";

interface Props {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ resolved?: string; severity?: string }>;
}

const VIEW_ROLES: OrgRole[] = [
  "admin", "sustainability_director", "sustainability_manager",
  "editor", "reviewer", "viewer", "auditor",
];

const MANAGE_ROLES: OrgRole[] = ["admin", "sustainability_director", "sustainability_manager"];

const SEVERITY_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  low: "outline",
  medium: "secondary",
  high: "default",
  critical: "destructive",
};

export default async function AlertsPage({ params, searchParams }: Props) {
  const { orgId } = await params;
  const { resolved, severity } = await searchParams;

  let role: OrgRole;
  try {
    const result = await requireOrgMember(orgId, ...VIEW_ROLES);
    role = result.membership.role;
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/sign-in");
      return <AccessDenied />;
    }
    throw err;
  }

  const canManage = MANAGE_ROLES.includes(role);
  const showResolved = resolved === "true";

  const alerts = await prisma.impactAlert.findMany({
    where: {
      organizationId: orgId,
      resolvedAt: showResolved ? { not: null } : null,
      ...(severity && { severity }),
    },
    include: {
      resolvedBy: { select: { id: true, name: true } },
    },
    orderBy: [
      { resolvedAt: showResolved ? "desc" : "asc" },
      { createdAt: "desc" },
    ],
    take: 100,
  });

  const openCount = await prisma.impactAlert.count({ where: { organizationId: orgId, resolvedAt: null } });
  const resolvedCount = await prisma.impactAlert.count({ where: { organizationId: orgId, resolvedAt: { not: null } } });

  return (
    <div className="min-h-[100dvh] bg-[#F9FAFB]">
      <div className="bg-white border-b border-[#E5E7EB]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-8">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EFF6FF]">
              <AlertTriangle className="h-4 w-4 text-[#111827]" />
            </div>
            <span className="text-xs font-medium tracking-wide text-[#111827] uppercase">Carbon Intelligence</span>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#111827]">Impact Alerts</h1>
              <p className="mt-1 text-sm text-[#374151] max-w-[65ch]">
                Threshold breaches, anomalies, and environment alerts.
              </p>
            </div>
            {canManage && <CreateAlertButton orgId={orgId} />}
          </div>

          <div className="mt-6 flex gap-6">
            <a href={`/orgs/${orgId}/carbon-intelligence/alerts`} className={`flex items-baseline gap-2 pb-0.5 border-b-2 ${!showResolved ? "border-[#111827]" : "border-transparent hover:border-[#E5E7EB]"}`}>
              <span className="text-xl font-bold text-[#111827] tabular-nums">{openCount}</span>
              <span className="text-xs text-[#9CA3AF] uppercase tracking-wide font-medium">Open</span>
            </a>
            <a href={`/orgs/${orgId}/carbon-intelligence/alerts?resolved=true`} className={`flex items-baseline gap-2 pb-0.5 border-b-2 ${showResolved ? "border-[#111827]" : "border-transparent hover:border-[#E5E7EB]"}`}>
              <span className="text-xl font-bold text-[#111827] tabular-nums">{resolvedCount}</span>
              <span className="text-xs text-[#9CA3AF] uppercase tracking-wide font-medium">Resolved</span>
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-8">
        <Card className="border-[#E5E7EB] shadow-none">
          <CardHeader className="px-6 py-4 border-b border-[#E5E7EB]">
            <CardTitle className="text-sm font-semibold text-[#111827]">
              {showResolved ? "Resolved" : "Open"} alerts
              <span className="ml-2 text-xs font-normal text-[#9CA3AF]">({alerts.length})</span>
            </CardTitle>
            <CardDescription className="text-xs text-[#9CA3AF] mt-0.5">
              Up to 100 shown.
            </CardDescription>
          </CardHeader>
          <CardContent className={alerts.length === 0 ? "py-10" : "p-0"}>
            {alerts.length === 0 ? (
              <div className="text-center">
                <p className="text-sm text-[#9CA3AF]">
                  {showResolved ? "No resolved alerts." : "No open alerts. All clear."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3 pl-6">Alert</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3">Type</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3">Severity</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3">Raised</TableHead>
                      {showResolved && (
                        <>
                          <TableHead className="text-xs font-medium text-[#9CA3AF] py-3">Resolved</TableHead>
                          <TableHead className="text-xs font-medium text-[#9CA3AF] py-3">By</TableHead>
                        </>
                      )}
                      {canManage && !showResolved && (
                        <TableHead className="text-xs font-medium text-[#9CA3AF] py-3 pr-6" />
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alerts.map((a) => (
                      <TableRow key={a.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors">
                        <TableCell className="py-3.5 pl-6 max-w-[280px]">
                          <p className="text-sm font-medium text-[#111827] truncate">{a.title}</p>
                          <p className="text-xs text-[#9CA3AF] truncate">{a.message}</p>
                        </TableCell>
                        <TableCell className="text-sm text-[#374151] py-3.5">
                          <span className="font-mono text-xs">{a.alertType}</span>
                        </TableCell>
                        <TableCell className="py-3.5">
                          <Badge variant={SEVERITY_VARIANTS[a.severity] ?? "outline"} className="text-xs capitalize">
                            {a.severity}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-[#9CA3AF] tabular-nums py-3.5">
                          {new Date(a.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                        </TableCell>
                        {showResolved && (
                          <>
                            <TableCell className="text-sm text-[#9CA3AF] tabular-nums py-3.5">
                              {a.resolvedAt
                                ? new Date(a.resolvedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                                : "-"}
                            </TableCell>
                            <TableCell className="text-sm text-[#374151] py-3.5">
                              {a.resolvedBy?.name ?? "-"}
                            </TableCell>
                          </>
                        )}
                        {canManage && !showResolved && (
                          <TableCell className="py-3.5 pr-6">
                            <ResolveAlertButton orgId={orgId} alertId={a.id} title={a.title} />
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="p-8">
      <p className="text-sm text-red-600">You do not have permission to view alerts.</p>
    </div>
  );
}
