export const dynamic = "force-dynamic";

// The environmental management dashboard. Carbon is one obligation among
// several; this is the rest of them: permits and consents, the legal register,
// the incident register and the ISO 14001 aspects register.

import { AuthError, requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { OrgRole } from "@prisma/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ShieldAlert, FileWarning, Scale, Siren, ChevronRight } from "lucide-react";
import {
  permitUrgency,
  permitSortRank,
  summarisePermitRegister,
  daysUntil,
  type PermitUrgency,
} from "@/lib/environment/permits";
import {
  summariseIncidentRegister,
  assessNotificationTimeliness,
} from "@/lib/environment/incidents";
import { summariseAspectRegister } from "@/lib/environment/aspects";

const PERMIT_TYPE_LABEL: Record<string, string> = {
  environmental_permit: "Environmental permit",
  discharge_consent: "Discharge consent",
  abstraction_licence: "Abstraction licence",
  waste_carrier_licence: "Waste carrier licence",
  waste_management_licence: "Waste management licence",
  air_emissions_permit: "Air emissions permit",
  radioactive_substances: "Radioactive substances",
  species_licence: "Species licence",
  planning_condition: "Planning condition",
  other: "Other",
};

const INCIDENT_TYPE_LABEL: Record<string, string> = {
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

export default async function EnvironmentPage({ params }: PageProps) {
  const { orgId } = await params;

  try {
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/sign-in");
      return <AccessDenied />;
    }
    throw err;
  }

  const [permits, incidents, legalEntries, aspects] = await Promise.all([
    prisma.environmentalPermit.findMany({
      where: { organizationId: orgId },
      include: {
        facility: { select: { name: true } },
        conditions: { select: { complianceStatus: true, nextDueOn: true } },
      },
    }),
    prisma.environmentalIncident.findMany({
      where: { organizationId: orgId },
      orderBy: { occurredAt: "desc" },
      take: 100,
      include: {
        facility: { select: { name: true } },
        actions: { select: { status: true, dueOn: true } },
      },
    }),
    prisma.legalRegisterEntry.findMany({
      where: { organizationId: orgId },
      select: { complianceStatus: true, nextReviewOn: true },
    }),
    prisma.environmentalAspect.findMany({
      where: { organizationId: orgId },
      select: {
        significance: true,
        existingControls: true,
        furtherAction: true,
        nextReviewOn: true,
      },
    }),
  ]);

  const now = new Date();
  const permitSummary = summarisePermitRegister(permits, now);
  const incidentSummary = summariseIncidentRegister(incidents, now);
  const aspectSummary = summariseAspectRegister(aspects, now);

  const legalBreaches = legalEntries.filter((e) => e.complianceStatus === "breach").length;
  const legalOverdue = legalEntries.filter(
    (e) => e.nextReviewOn !== null && e.nextReviewOn.getTime() < now.getTime(),
  ).length;

  const urgentPermits = permits
    .map((p) => ({ ...p, urgency: permitUrgency(p, now) }))
    .filter((p) => p.urgency === "expired" || p.urgency === "renewal_due")
    .sort((a, b) => permitSortRank(a.urgency) - permitSortRank(b.urgency))
    .slice(0, 8);

  const openIncidents = incidents.filter((i) => i.status !== "closed").slice(0, 8);

  // Everything that needs someone to act, ordered by how bad it is to ignore.
  const alerts: Array<{ text: string; severity: "critical" | "warning" }> = [];
  if (permitSummary.operatingOnExpired > 0) {
    alerts.push({
      severity: "critical",
      text: `${permitSummary.operatingOnExpired} permit${permitSummary.operatingOnExpired === 1 ? " is" : "s are"} recorded as active but past expiry. Operating without a valid permit is an offence in its own right.`,
    });
  }
  if (incidentSummary.overdueNotifications > 0) {
    alerts.push({
      severity: "critical",
      text: `${incidentSummary.overdueNotifications} notifiable incident${incidentSummary.overdueNotifications === 1 ? " has" : "s have"} passed the notification window without the regulator being recorded as told.`,
    });
  }
  if (permitSummary.conditionsInBreach > 0) {
    alerts.push({
      severity: "critical",
      text: `${permitSummary.conditionsInBreach} permit condition${permitSummary.conditionsInBreach === 1 ? " is" : "s are"} in breach.`,
    });
  }
  if (legalBreaches > 0) {
    alerts.push({
      severity: "critical",
      text: `${legalBreaches} legal register ${legalBreaches === 1 ? "entry is" : "entries are"} recorded as in breach.`,
    });
  }
  if (permitSummary.renewalDue > 0) {
    alerts.push({
      severity: "warning",
      text: `${permitSummary.renewalDue} permit${permitSummary.renewalDue === 1 ? "" : "s"} inside the renewal lead time.`,
    });
  }
  if (incidentSummary.overdueActions > 0) {
    alerts.push({
      severity: "warning",
      text: `${incidentSummary.overdueActions} corrective action${incidentSummary.overdueActions === 1 ? " is" : "s are"} past its due date.`,
    });
  }
  if (aspectSummary.uncontrolledSignificant > 0) {
    alerts.push({
      severity: "warning",
      text: `${aspectSummary.uncontrolledSignificant} significant environmental aspect${aspectSummary.uncontrolledSignificant === 1 ? " has" : "s have"} no control or action recorded.`,
    });
  }
  if (legalOverdue > 0) {
    alerts.push({
      severity: "warning",
      text: `${legalOverdue} legal register ${legalOverdue === 1 ? "entry is" : "entries are"} past their compliance review date.`,
    });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <header className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100">
          <ShieldAlert className="h-5 w-5 text-zinc-700" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Environmental management</h1>
          <p className="mt-0.5 max-w-[65ch] text-sm text-zinc-500">
            Permits and consents, compliance obligations, the incident register and the aspects
            and impacts register.
          </p>
        </div>
      </header>

      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, i) => (
            <div
              key={i}
              className={
                alert.severity === "critical"
                  ? "flex items-start gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3"
                  : "flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3"
              }
            >
              <Siren
                className={
                  alert.severity === "critical"
                    ? "mt-0.5 h-4 w-4 shrink-0 text-red-600"
                    : "mt-0.5 h-4 w-4 shrink-0 text-amber-600"
                }
              />
              <p
                className={
                  alert.severity === "critical"
                    ? "text-sm leading-relaxed text-red-900"
                    : "text-sm leading-relaxed text-amber-900"
                }
              >
                {alert.text}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={FileWarning}
          label="Permits"
          value={permitSummary.active}
          caption={`${permitSummary.renewalDue} due for renewal`}
          alarm={permitSummary.operatingOnExpired > 0}
        />
        <StatCard
          icon={Siren}
          label="Open incidents"
          value={incidentSummary.open}
          caption={`${incidentSummary.openActions} open actions`}
          alarm={incidentSummary.overdueNotifications > 0}
        />
        <StatCard
          icon={Scale}
          label="Legal register"
          value={legalEntries.length}
          caption={`${legalBreaches} in breach, ${legalOverdue} overdue review`}
          alarm={legalBreaches > 0}
        />
        <StatCard
          icon={ShieldAlert}
          label="Significant aspects"
          value={aspectSummary.bySignificance.significant}
          caption={`${aspectSummary.uncontrolledSignificant} without a control`}
          alarm={aspectSummary.uncontrolledSignificant > 0}
        />
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">Permits needing attention</h2>
          <Link
            href={`/orgs/${orgId}/environment/permits`}
            className="flex items-center gap-1 text-sm font-medium text-zinc-600 hover:text-zinc-900"
          >
            Full register
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {urgentPermits.length === 0 ? (
          <EmptyCard text="No permits are expired or inside their renewal lead time." />
        ) : (
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Permit</TableHead>
                    <TableHead>Authority</TableHead>
                    <TableHead>Facility</TableHead>
                    <TableHead className="pr-4 text-right">Expiry</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {urgentPermits.map((p) => {
                    const days = p.expiresOn ? daysUntil(p.expiresOn, now) : null;
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="pl-4">
                          <div className="font-medium text-zinc-900">{p.title}</div>
                          <div className="text-xs text-zinc-400">
                            {PERMIT_TYPE_LABEL[p.type] ?? p.type} · {p.reference}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-zinc-500">
                          {p.issuingAuthority}
                        </TableCell>
                        <TableCell className="text-sm text-zinc-500">
                          {p.facility?.name ?? "Organisation wide"}
                        </TableCell>
                        <TableCell className="pr-4 text-right">
                          <UrgencyBadge urgency={p.urgency} days={days} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">Open incidents</h2>
          <Link
            href={`/orgs/${orgId}/environment/incidents`}
            className="flex items-center gap-1 text-sm font-medium text-zinc-600 hover:text-zinc-900"
          >
            Full register
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {openIncidents.length === 0 ? (
          <EmptyCard text="No open incidents." />
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
                    <TableHead className="pr-4">Notification</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {openIncidents.map((i) => {
                    const timeliness = assessNotificationTimeliness({ ...i, now });
                    return (
                      <TableRow key={i.id}>
                        <TableCell className="pl-4">
                          <div className="font-medium text-zinc-900">{i.reference}</div>
                          <div className="text-xs text-zinc-400">
                            {i.facility?.name ?? "Organisation wide"}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-zinc-600">
                          {INCIDENT_TYPE_LABEL[i.type] ?? i.type}
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
                        <TableCell className="pr-4">
                          {!i.regulatorNotifiable ? (
                            <span className="text-xs text-zinc-400">Not notifiable</span>
                          ) : i.regulatorNotifiedAt ? (
                            <Badge variant="outline" className="text-xs">
                              Notified
                            </Badge>
                          ) : timeliness.isOverdue ? (
                            <Badge className="bg-red-100 text-xs text-red-900 hover:bg-red-100">
                              Overdue by{" "}
                              {Math.round(timeliness.hoursElapsed - (timeliness.targetHours ?? 0))}h
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-xs text-amber-900 hover:bg-amber-100">
                              Due within {timeliness.targetHours}h
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Compliance obligations</CardTitle>
            <CardDescription>
              ISO 14001 clause 6.1.3 legal register, re-evaluated periodically under 9.1.2.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <StatRow label="Entries" value={String(legalEntries.length)} />
            <StatRow label="In breach" value={String(legalBreaches)} alarm={legalBreaches > 0} />
            <StatRow
              label="Not yet assessed"
              value={String(legalEntries.filter((e) => e.complianceStatus === "not_assessed").length)}
            />
            <StatRow label="Overdue review" value={String(legalOverdue)} alarm={legalOverdue > 0} />
            <Link
              href={`/orgs/${orgId}/environment/legal-register`}
              className="inline-flex items-center gap-1 pt-1 text-sm font-medium text-zinc-600 hover:text-zinc-900"
            >
              Open register
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Aspects and impacts</CardTitle>
            <CardDescription>
              ISO 14001 clause 6.1.2. Significant and high aspects need a documented control.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <StatRow label="Aspects" value={String(aspectSummary.total)} />
            <StatRow
              label="Significant"
              value={String(aspectSummary.bySignificance.significant)}
            />
            <StatRow label="High" value={String(aspectSummary.bySignificance.high)} />
            <StatRow
              label="Without a control"
              value={String(aspectSummary.uncontrolledSignificant)}
              alarm={aspectSummary.uncontrolledSignificant > 0}
            />
            <Link
              href={`/orgs/${orgId}/environment/aspects`}
              className="inline-flex items-center gap-1 pt-1 text-sm font-medium text-zinc-600 hover:text-zinc-900"
            >
              Open register
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  caption,
  alarm,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  caption: string;
  alarm?: boolean;
}) {
  return (
    <Card className={alarm ? "border-red-200" : undefined}>
      <CardContent className="space-y-1 py-5">
        <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </div>
        <p
          className={
            alarm
              ? "font-mono text-2xl font-semibold tabular-nums text-red-700"
              : "font-mono text-2xl font-semibold tabular-nums text-zinc-900"
          }
        >
          {value}
        </p>
        <p className="text-xs text-zinc-500">{caption}</p>
      </CardContent>
    </Card>
  );
}

function StatRow({ label, value, alarm }: { label: string; value: string; alarm?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-zinc-500">{label}</span>
      <span
        className={
          alarm
            ? "font-mono font-semibold tabular-nums text-red-700"
            : "font-mono tabular-nums text-zinc-900"
        }
      >
        {value}
      </span>
    </div>
  );
}

function UrgencyBadge({ urgency, days }: { urgency: PermitUrgency; days: number | null }) {
  if (urgency === "expired") {
    return (
      <Badge className="bg-red-100 text-xs text-red-900 hover:bg-red-100">
        Expired {days !== null ? `${Math.abs(days)}d ago` : ""}
      </Badge>
    );
  }
  if (urgency === "renewal_due") {
    return (
      <Badge className="bg-amber-100 text-xs text-amber-900 hover:bg-amber-100">
        {days} days left
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs">
      {days !== null ? `${days} days` : "No expiry"}
    </Badge>
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

function EmptyCard({ text }: { text: string }) {
  return (
    <Card>
      <CardContent className="py-6 text-sm text-zinc-500">{text}</CardContent>
    </Card>
  );
}

function AccessDenied() {
  return (
    <div className="p-8">
      <h1 className="text-lg font-semibold text-zinc-900">Access denied</h1>
      <p className="mt-1 text-sm text-zinc-500">
        You do not have permission to view environmental management.
      </p>
    </div>
  );
}
