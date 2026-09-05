export const dynamic = "force-dynamic";

import { AuthError, requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
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
import { ArrowLeft, AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  assessNetGain,
  checkTradingRule,
  MODULE_LABEL,
  MODULE_UNIT,
  DISTINCTIVENESS_LABEL,
  REQUIRED_NET_GAIN_PERCENT,
} from "@/lib/ecology/biodiversity-metric";
import { totalsFromAssessment } from "@/lib/ecology/assessment";
import { AddParcelForm } from "./parcel-form";
import { ManagementPlanPanel } from "./management-plan-panel";

const MANAGE_ROLES: OrgRole[] = [
  "admin",
  "sustainability_director",
  "sustainability_manager",
  "operations_manager",
  "project_manager",
  "editor",
];

const STAGE_LABEL: Record<string, string> = {
  baseline: "Baseline",
  retained: "Retained",
  enhanced: "Enhanced",
  created: "Created",
};

interface PageProps {
  params: Promise<{ orgId: string; assessmentId: string }>;
}

export default async function AssessmentDetailPage({ params }: PageProps) {
  const { orgId, assessmentId } = await params;

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

  const assessment = await prisma.biodiversityAssessment.findFirst({
    where: { id: assessmentId, organizationId: orgId },
    include: {
      project: { select: { name: true } },
      site: { select: { name: true } },
      parcels: { orderBy: [{ stage: "asc" }, { module: "asc" }, { habitatType: "asc" }] },
      speciesRecords: { orderBy: { species: "asc" } },
      managementPlan: {
        include: { events: { orderBy: { monitoringYear: "asc" } } },
      },
    },
  });
  if (!assessment) notFound();

  const netGain = assessNetGain(totalsFromAssessment(assessment));
  const locked = assessment.status === "approved" || assessment.status === "superseded";

  const baselineParcels = assessment.parcels.filter((p) => p.stage === "baseline");
  const replacements = assessment.parcels.filter(
    (p) => p.stage === "created" || p.stage === "enhanced",
  );

  // Trading rules, checked per lost parcel. A planning officer works through
  // these one habitat at a time, so the page presents them the same way.
  const tradingChecks = baselineParcels.map((lost) => {
    const candidates = replacements.filter((r) => r.module === lost.module);
    const best = candidates.reduce<{
      check: ReturnType<typeof checkTradingRule>;
      habitatType: string;
    } | null>((acc, candidate) => {
      const check = checkTradingRule({
        lostDistinctiveness: lost.distinctiveness,
        lostBroadHabitat: lost.broadHabitat,
        replacementDistinctiveness: candidate.distinctiveness,
        replacementBroadHabitat: candidate.broadHabitat,
      });
      if (!acc || (check.satisfied && !acc.check.satisfied)) {
        return { check, habitatType: candidate.habitatType };
      }
      return acc;
    }, null);

    return {
      id: lost.id,
      habitatType: lost.habitatType,
      distinctiveness: lost.distinctiveness,
      satisfied: best?.check.satisfied ?? lost.distinctiveness === "very_low",
      reason:
        best?.check.reason ??
        (lost.distinctiveness === "very_low"
          ? "Very low distinctiveness habitat carries no compensation requirement."
          : "No replacement habitat has been proposed in this module."),
      replacement: best?.habitatType ?? null,
    };
  });

  const tradingFailures = tradingChecks.filter((c) => !c.satisfied);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <Link
        href={`/orgs/${orgId}/biodiversity`}
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All assessments
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">{assessment.name}</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            {[
              assessment.project?.name,
              assessment.site?.name,
              assessment.planningAuthority,
              assessment.planningReference,
            ]
              .filter(Boolean)
              .join(" · ") || "No project or planning reference recorded"}
          </p>
          {assessment.ecologistName && (
            <p className="mt-0.5 text-xs text-zinc-500">
              Surveyed by {assessment.ecologistName}
              {assessment.ecologistOrganisation ? `, ${assessment.ecologistOrganisation}` : ""}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs capitalize">
            {assessment.status}
          </Badge>
          {netGain.meetsRequirement && assessment.parcels.length > 0 && (
            <Badge className="bg-green-100 text-xs text-green-900 hover:bg-green-100">
              Delivers net gain
            </Badge>
          )}
        </div>
      </header>

      <Card className={netGain.meetsRequirement ? undefined : "border-amber-200"}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Net gain position</CardTitle>
          <CardDescription>{netGain.summary}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            {netGain.modules.map((m) => {
              const notEngaged = m.baselineIsZero && m.postInterventionUnits === 0;
              return (
                <div
                  key={m.module}
                  className={
                    notEngaged
                      ? "rounded-md border border-zinc-200 p-3 opacity-50"
                      : m.meetsRequirement
                        ? "rounded-md border border-zinc-200 p-3"
                        : "rounded-md border border-amber-200 bg-amber-50 p-3"
                  }
                >
                  <p className="text-xs font-medium text-zinc-500">{MODULE_LABEL[m.module]}</p>
                  {notEngaged ? (
                    <p className="mt-1 text-sm text-zinc-500">Not engaged by this scheme</p>
                  ) : (
                    <>
                      <p
                        className={
                          m.meetsRequirement
                            ? "mt-1 font-mono text-xl font-semibold tabular-nums text-zinc-900"
                            : "mt-1 font-mono text-xl font-semibold tabular-nums text-amber-700"
                        }
                      >
                        {m.netGainPercent >= 0 ? "+" : ""}
                        {m.netGainPercent.toFixed(1)}%
                      </p>
                      <p className="text-xs tabular-nums text-zinc-500">
                        {m.baselineUnits.toFixed(3)} to {m.postInterventionUnits.toFixed(3)} units
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        Requires {(m.baselineUnits * 1.1).toFixed(3)} units for{" "}
                        {REQUIRED_NET_GAIN_PERCENT}%
                      </p>
                      {!m.meetsRequirement && (
                        <p className="mt-1 text-xs font-medium tabular-nums text-amber-700">
                          {m.unitsShortfall.toFixed(3)} units short
                        </p>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {tradingChecks.length > 0 && (
        <Card className={tradingFailures.length > 0 ? "border-amber-200" : undefined}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Trading rules</CardTitle>
            <CardDescription>
              Habitat lost must be compensated like for like or better. The constraint tightens as
              distinctiveness rises, and very high distinctiveness habitat cannot be traded through
              the metric at all.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {tradingChecks.map((c) => (
              <div key={c.id} className="flex items-start gap-2 text-sm">
                {c.satisfied ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                )}
                <div>
                  <span className="font-medium text-zinc-900">{c.habitatType}</span>
                  <span className="text-zinc-500">
                    {" "}
                    ({DISTINCTIVENESS_LABEL[c.distinctiveness]} distinctiveness)
                  </span>
                  <p className="text-xs leading-relaxed text-zinc-500">{c.reason}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-zinc-900">Habitat parcels</h2>
          {canManage && !locked && <AddParcelForm orgId={orgId} assessmentId={assessmentId} />}
        </div>

        {locked && (
          <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
            This assessment is {assessment.status} and forms the basis of a planning position, so
            its parcels can no longer be edited. Create a revision if the scheme changes.
          </p>
        )}

        {assessment.parcels.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-zinc-500">
              No habitat recorded. Start with the baseline: every parcel on the site as surveyed,
              including hardstanding and buildings, which score zero but define the site area.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Habitat</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Module</TableHead>
                    <TableHead className="text-right">Size</TableHead>
                    <TableHead>Distinctiveness</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead className="pr-4 text-right">Units</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assessment.parcels.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="pl-4">
                        <div className="font-medium text-zinc-900">{p.habitatType}</div>
                        <div className="text-xs text-zinc-500">{p.broadHabitat}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {STAGE_LABEL[p.stage] ?? p.stage}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-zinc-500">
                        {MODULE_LABEL[p.module]}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums text-zinc-600">
                        {Number(p.size).toFixed(3)} {MODULE_UNIT[p.module]}
                      </TableCell>
                      <TableCell className="text-sm capitalize text-zinc-600">
                        {DISTINCTIVENESS_LABEL[p.distinctiveness]}
                      </TableCell>
                      <TableCell className="text-sm capitalize text-zinc-500">
                        {p.condition.replace(/_/g, " ")}
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        <div className="font-mono text-sm font-semibold tabular-nums text-zinc-900">
                          {Number(p.units).toFixed(3)}
                        </div>
                        {p.calculation && (
                          <div className="max-w-[34ch] text-xs leading-snug text-zinc-500">
                            {p.calculation}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </section>

      <ManagementPlanPanel
        orgId={orgId}
        assessmentId={assessmentId}
        canManage={canManage}
        meetsRequirement={netGain.meetsRequirement}
        plan={
          assessment.managementPlan
            ? {
                id: assessment.managementPlan.id,
                title: assessment.managementPlan.title,
                responsibleParty: assessment.managementPlan.responsibleParty,
                commencesOn: assessment.managementPlan.commencesOn.toISOString(),
                endsOn: assessment.managementPlan.endsOn.toISOString(),
                events: assessment.managementPlan.events.map((e) => ({
                  id: e.id,
                  monitoringYear: e.monitoringYear,
                  dueOn: e.dueOn.toISOString(),
                  status: e.status,
                  onTrack: e.onTrack,
                })),
              }
            : null
        }
      />

      {assessment.speciesRecords.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900">Protected species</h2>
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Species</TableHead>
                    <TableHead>Findings</TableHead>
                    <TableHead>Licence</TableHead>
                    <TableHead className="pr-4">Constraint</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assessment.speciesRecords.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="pl-4">
                        <div className="font-medium text-zinc-900">{r.species}</div>
                        <div className="text-xs text-zinc-500">{r.legalProtection}</div>
                      </TableCell>
                      <TableCell className="max-w-[36ch] text-xs leading-relaxed text-zinc-600">
                        {r.findings}
                      </TableCell>
                      <TableCell>
                        <LicenceBadge
                          status={r.licenceStatus}
                          expiresOn={r.licenceExpiresOn}
                        />
                      </TableCell>
                      <TableCell className="pr-4 text-xs text-zinc-500">
                        {r.seasonalConstraint ?? "None recorded"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}

function LicenceBadge({ status, expiresOn }: { status: string; expiresOn: Date | null }) {
  const expired =
    status === "granted" && expiresOn !== null && expiresOn.getTime() < Date.now();

  if (expired) {
    return <Badge className="bg-red-100 text-xs text-red-900 hover:bg-red-100">Expired</Badge>;
  }
  if (status === "granted") {
    return <Badge className="bg-green-100 text-xs text-green-900 hover:bg-green-100">Granted</Badge>;
  }
  if (status === "not_required") {
    return (
      <Badge variant="outline" className="text-xs">
        Not required
      </Badge>
    );
  }
  return (
    <Badge className="bg-amber-100 text-xs capitalize text-amber-900 hover:bg-amber-100">
      {status}
    </Badge>
  );
}

function Denied() {
  return (
    <div className="p-8">
      <h1 className="text-lg font-semibold text-zinc-900">Access denied</h1>
      <p className="mt-1 text-sm text-zinc-500">
        You do not have permission to view this assessment.
      </p>
    </div>
  );
}
