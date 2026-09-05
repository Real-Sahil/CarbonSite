export const dynamic = "force-dynamic";

// Biodiversity Net Gain register.
//
// BNG has been mandatory for development in England since February 2024: at
// least a 10% uplift in biodiversity units, in each of three modules
// independently, secured for 30 years.

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
import { Leaf, AlertTriangle, ChevronRight, ShieldOff } from "lucide-react";
import { assessNetGain, MODULE_LABEL, REQUIRED_NET_GAIN_PERCENT } from "@/lib/ecology/biodiversity-metric";
import { totalsFromAssessment } from "@/lib/ecology/assessment";
import { CreateAssessmentForm } from "./assessment-form";

const MANAGE_ROLES: OrgRole[] = [
  "admin",
  "sustainability_director",
  "sustainability_manager",
  "operations_manager",
  "project_manager",
  "editor",
];

const SECURING_LABEL: Record<string, string> = {
  section_106: "s106 planning obligation",
  conservation_covenant: "Conservation covenant",
  planning_condition: "Planning condition",
  statutory_credits: "Statutory credits",
  not_yet_secured: "Not yet secured",
};

interface PageProps {
  params: Promise<{ orgId: string }>;
}

export default async function BiodiversityPage({ params }: PageProps) {
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

  const canManage = MANAGE_ROLES.includes(role);

  const [assessments, projects, sites, speciesRecords, overdueMonitoring] = await Promise.all([
    prisma.biodiversityAssessment.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      include: {
        project: { select: { id: true, name: true } },
        site: { select: { id: true, name: true } },
        managementPlan: { select: { id: true, endsOn: true } },
        _count: { select: { parcels: true, speciesRecords: true } },
      },
    }),
    prisma.project.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.site.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.protectedSpeciesRecord.findMany({
      where: { organizationId: orgId },
      select: { licenceStatus: true, licenceExpiresOn: true, species: true },
    }),
    prisma.ecologicalMonitoringEvent.count({
      where: {
        organizationId: orgId,
        status: { in: ["scheduled", "due"] },
        dueOn: { lt: new Date() },
      },
    }),
  ]);

  const now = new Date();

  // A licence needed but not held is a criminal exposure, not a paperwork gap,
  // so it is counted separately from everything else on this page.
  const blockingSpecies = speciesRecords.filter((r) => {
    if (r.licenceStatus === "granted") {
      return r.licenceExpiresOn !== null && r.licenceExpiresOn.getTime() < now.getTime();
    }
    return ["required", "applied", "refused", "expired"].includes(r.licenceStatus);
  });

  const rows = assessments.map((a) => ({
    assessment: a,
    netGain: assessNetGain(totalsFromAssessment(a)),
  }));

  const failing = rows.filter((r) => !r.netGain.meetsRequirement && r.assessment._count.parcels > 0);
  const unsecured = rows.filter(
    (r) => r.netGain.meetsRequirement && r.assessment.securingMechanism === "not_yet_secured",
  );

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100">
            <Leaf className="h-5 w-5 text-zinc-700" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">Biodiversity Net Gain</h1>
            <p className="mt-0.5 max-w-[65ch] text-sm text-zinc-500">
              Mandatory for development in England since February 2024. A scheme must deliver at
              least {REQUIRED_NET_GAIN_PERCENT}% more biodiversity units than it started with, in
              each of three modules independently, and secure it for 30 years.
            </p>
          </div>
        </div>
        {canManage && (
          <CreateAssessmentForm orgId={orgId} projects={projects} sites={sites} />
        )}
      </header>

      {blockingSpecies.length > 0 && (
        <div className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3">
          <ShieldOff className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <div className="text-sm text-red-900">
            <p className="font-medium">
              {blockingSpecies.length} protected species record
              {blockingSpecies.length === 1 ? "" : "s"} without a licence in place
            </p>
            <p className="mt-0.5 leading-relaxed text-red-800">
              Works affecting {[...new Set(blockingSpecies.map((s) => s.species))].join(", ")}{" "}
              cannot lawfully proceed until the licence is granted and in date.
            </p>
          </div>
        </div>
      )}

      {failing.length > 0 && (
        <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="text-sm text-amber-900">
            <p className="font-medium">
              {failing.length} assessment{failing.length === 1 ? "" : "s"} do not yet deliver net
              gain
            </p>
            <p className="mt-0.5 leading-relaxed text-amber-800">
              The {REQUIRED_NET_GAIN_PERCENT}% must be met in each module separately, so a surplus
              in area habitats cannot make up a hedgerow shortfall.
            </p>
          </div>
        </div>
      )}

      {overdueMonitoring > 0 && (
        <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-sm leading-relaxed text-amber-900">
            {overdueMonitoring} monitoring visit{overdueMonitoring === 1 ? " is" : "s are"} past
            due against a 30 year management obligation. Missing them puts the planning obligation
            at risk.
          </p>
        </div>
      )}

      {unsecured.length > 0 && (
        <div className="flex items-start gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
          <p className="text-sm leading-relaxed text-zinc-700">
            {unsecured.length} assessment{unsecured.length === 1 ? "" : "s"} deliver net gain but
            have no securing mechanism recorded. A gain that is not secured by a planning
            obligation or a conservation covenant does not discharge the requirement.
          </p>
        </div>
      )}

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-sm text-zinc-500">
            No assessments yet. Create one to record the habitat baseline for a site, then add the
            habitat proposed after development to see the net gain position.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {rows.map(({ assessment: a, netGain }) => (
            <Card key={a.id} className={netGain.meetsRequirement ? undefined : "border-amber-200"}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">
                      <Link
                        href={`/orgs/${orgId}/biodiversity/${a.id}`}
                        className="hover:underline"
                      >
                        {a.name}
                      </Link>
                    </CardTitle>
                    <CardDescription>
                      {[a.project?.name, a.site?.name, a.planningReference]
                        .filter(Boolean)
                        .join(" · ") || "No project or planning reference recorded"}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {a._count.parcels === 0 ? (
                      <Badge variant="outline" className="text-xs">
                        No habitat recorded
                      </Badge>
                    ) : netGain.meetsRequirement ? (
                      <Badge className="bg-green-100 text-xs text-green-900 hover:bg-green-100">
                        Delivers net gain
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-xs text-amber-900 hover:bg-amber-100">
                        Shortfall
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs capitalize">
                      {a.status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  {netGain.modules.map((m) => (
                    <div
                      key={m.module}
                      className={
                        m.baselineIsZero && m.postInterventionUnits === 0
                          ? "rounded-md border border-zinc-200 p-3 opacity-50"
                          : m.meetsRequirement
                            ? "rounded-md border border-zinc-200 p-3"
                            : "rounded-md border border-amber-200 bg-amber-50 p-3"
                      }
                    >
                      <p className="text-xs font-medium text-zinc-500">
                        {MODULE_LABEL[m.module]}
                      </p>
                      {m.baselineIsZero && m.postInterventionUnits === 0 ? (
                        <p className="mt-1 text-sm text-zinc-500">Not engaged</p>
                      ) : (
                        <>
                          <p
                            className={
                              m.meetsRequirement
                                ? "mt-1 font-mono text-lg font-semibold tabular-nums text-zinc-900"
                                : "mt-1 font-mono text-lg font-semibold tabular-nums text-amber-700"
                            }
                          >
                            {m.netGainPercent >= 0 ? "+" : ""}
                            {m.netGainPercent.toFixed(1)}%
                          </p>
                          <p className="text-xs tabular-nums text-zinc-500">
                            {m.baselineUnits.toFixed(2)} to {m.postInterventionUnits.toFixed(2)}{" "}
                            units
                          </p>
                          {!m.meetsRequirement && (
                            <p className="mt-1 text-xs font-medium tabular-nums text-amber-700">
                              {m.unitsShortfall.toFixed(2)} units short
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-3 text-sm">
                  <div className="flex flex-wrap gap-4 text-zinc-500">
                    <span>{a._count.parcels} habitat parcels</span>
                    <span>{a._count.speciesRecords} species records</span>
                    <span>{SECURING_LABEL[a.securingMechanism]}</span>
                    {a.managementPlan && (
                      <span>
                        Managed to{" "}
                        {a.managementPlan.endsOn.toLocaleDateString("en-GB", {
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    )}
                  </div>
                  <Link
                    href={`/orgs/${orgId}/biodiversity/${a.id}`}
                    className="flex items-center gap-1 font-medium text-zinc-600 hover:text-zinc-900"
                  >
                    Open assessment
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Denied() {
  return (
    <div className="p-8">
      <h1 className="text-lg font-semibold text-zinc-900">Access denied</h1>
      <p className="mt-1 text-sm text-zinc-500">
        You do not have permission to view biodiversity assessments.
      </p>
    </div>
  );
}
