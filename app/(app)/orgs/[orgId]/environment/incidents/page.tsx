export const dynamic = "force-dynamic";

import { AuthError, requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import type { OrgRole } from "@prisma/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  assessNotificationTimeliness,
  deriveActionStatus,
  isActionOpen,
  canCloseIncident,
} from "@/lib/environment/incidents";
import { ReportIncidentForm } from "./incident-form";

const REPORT_ROLES: OrgRole[] = [
  "admin",
  "sustainability_director",
  "sustainability_manager",
  "operations_manager",
  "editor",
  "reviewer",
  "contract_manager",
  "project_manager",
  "site_manager",
  "supervisor",
];

const TYPE_LABEL: Record<string, string> = {
  spill: "Spill",
  exceedance: "Exceedance",
  unauthorised_release: "Unauthorised release",
  complaint: "Complaint",
  near_miss: "Near miss",
  waste_misrouting: "Waste misrouting",
  equipment_failure: "Equipment failure",
  ecological_damage: "Ecological damage",
  other: "Other",
};

interface PageProps {
  params: Promise<{ orgId: string }>;
}

export default async function IncidentsPage({ params }: PageProps) {
  const { orgId } = await params;

  let role: OrgRole;
  try {
    const result = await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);
    role = result.membership.role;
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/sign-in");
      return <Denied />;
    }
    throw err;
  }

  const canReport = REPORT_ROLES.includes(role);

  const [incidents, facilities, permits] = await Promise.all([
    prisma.environmentalIncident.findMany({
      where: { organizationId: orgId },
      orderBy: { occurredAt: "desc" },
      take: 200,
      include: {
        facility: { select: { name: true } },
        permit: { select: { reference: true } },
        owner: { select: { name: true, email: true } },
        actions: { select: { status: true, dueOn: true } },
      },
    }),
    prisma.facility.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.environmentalPermit.findMany({
      where: { organizationId: orgId, status: { in: ["active", "applied"] } },
      orderBy: { reference: "asc" },
      select: { id: true, reference: true, title: true },
    }),
  ]);

  const now = new Date();

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Incident register</h1>
          <p className="mt-0.5 max-w-[65ch] text-sm text-zinc-500">
            Spills, exceedances, complaints and near misses, with the corrective actions that
            follow from them. An incident cannot be closed while its actions remain open.
          </p>
        </div>
        {canReport && (
          <ReportIncidentForm orgId={orgId} facilities={facilities} permits={permits} />
        )}
      </div>

      {incidents.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-sm text-zinc-500">
            No incidents recorded. A register with nothing in it usually means under-reporting
            rather than a clean record, so make sure site teams know how to raise one.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Reference</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Occurred</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Actions</TableHead>
                  <TableHead>Notification</TableHead>
                  <TableHead className="pr-4">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incidents.map((i) => {
                  const timeliness = assessNotificationTimeliness({ ...i, now });
                  const actions = i.actions.map((a) => ({
                    ...a,
                    status: deriveActionStatus(a, now),
                  }));
                  const openActions = actions.filter((a) => isActionOpen(a.status)).length;
                  const overdueActions = actions.filter((a) => a.status === "overdue").length;
                  const closure = canCloseIncident({ ...i, actions });

                  return (
                    <TableRow key={i.id} className={i.status === "closed" ? "opacity-60" : undefined}>
                      <TableCell className="pl-4">
                        <div className="font-medium text-zinc-900">{i.reference}</div>
                        <div className="max-w-[32ch] truncate text-xs text-zinc-400">
                          {i.facility?.name ?? "Organisation wide"}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-zinc-600">
                        {TYPE_LABEL[i.type] ?? i.type}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-zinc-500">
                        {i.occurredAt.toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell>
                        <SeverityBadge severity={i.severity} />
                      </TableCell>
                      <TableCell className="text-sm">
                        {actions.length === 0 ? (
                          <span className="text-zinc-400">None</span>
                        ) : overdueActions > 0 ? (
                          <span className="font-medium text-red-700">
                            {overdueActions} overdue
                          </span>
                        ) : openActions > 0 ? (
                          <span className="text-amber-700">{openActions} open</span>
                        ) : (
                          <span className="text-zinc-500">All resolved</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {!i.regulatorNotifiable ? (
                          <span className="text-xs text-zinc-400">Not notifiable</span>
                        ) : i.regulatorNotifiedAt ? (
                          <Badge variant="outline" className="text-xs">
                            Notified
                          </Badge>
                        ) : timeliness.isOverdue ? (
                          <Badge className="bg-red-100 text-xs text-red-900 hover:bg-red-100">
                            Overdue
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-xs text-amber-900 hover:bg-amber-100">
                            Due in {timeliness.targetHours}h
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="pr-4">
                        <div className="space-y-0.5">
                          <Badge variant="outline" className="text-xs capitalize">
                            {i.status.replace(/_/g, " ")}
                          </Badge>
                          {i.status !== "closed" && !closure.canClose && (
                            <p className="max-w-[28ch] text-xs leading-snug text-zinc-400">
                              {closure.reasons[0]}
                            </p>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    severe: "bg-red-100 text-red-900 hover:bg-red-100",
    major: "bg-orange-100 text-orange-900 hover:bg-orange-100",
    moderate: "bg-amber-100 text-amber-900 hover:bg-amber-100",
  };
  const style = styles[severity];
  if (!style) {
    return (
      <Badge variant="outline" className="text-xs capitalize">
        {severity}
      </Badge>
    );
  }
  return <Badge className={`text-xs capitalize ${style}`}>{severity}</Badge>;
}

function Denied() {
  return (
    <div className="p-8">
      <h1 className="text-lg font-semibold text-zinc-900">Access denied</h1>
      <p className="mt-1 text-sm text-zinc-500">
        You do not have permission to view the incident register.
      </p>
    </div>
  );
}
