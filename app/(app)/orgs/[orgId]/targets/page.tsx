import { AuthError, requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import type { OrgRole } from "@prisma/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreateInitiativeForm, CreateTargetForm } from "./target-forms";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Target } from "lucide-react";
import { DeleteInitiativeButton, DeleteTargetButton } from "./target-actions";
import { TargetProgressSection, type TargetWithProgress } from "./target-progress";

interface TargetsPageProps {
  params: Promise<{ orgId: string }>;
}

export default async function TargetsPage({ params }: TargetsPageProps) {
  const { orgId } = await params;

  let role: OrgRole;
  try {
    const result = await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");
    role = result.membership.role;
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/sign-in");
      return <AccessDenied />;
    }
    throw err;
  }

  const canEdit = role === "admin" || role === "editor";

  const [targets, initiatives, periods, memberships] = await Promise.all([
    prisma.reductionTarget.findMany({
      where: { organizationId: orgId },
      include: {
        baselinePeriod: { select: { label: true } },
        targetPeriod: { select: { label: true } },
        createdBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.reductionInitiative.findMany({
      where: { organizationId: orgId },
      include: {
        owner: { select: { name: true, email: true } },
        createdBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.reportingPeriod.findMany({
      where: { organizationId: orgId },
      select: { id: true, label: true },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    }),
    prisma.organizationMembership.findMany({
      where: { organizationId: orgId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // Fetch aggregate totals for all periods referenced by targets
  const periodIds = [
    ...new Set(targets.flatMap((t) => [t.baselinePeriodId, t.targetPeriodId])),
  ];

  // Aggregate totalCo2e (kgCO2e) across all scopes per period.
  // We group in application code: sum all rows for a period regardless of scope/category/facility.
  const aggregateRows =
    periodIds.length > 0
      ? await prisma.dashboardAggregate.findMany({
          where: { organizationId: orgId, reportingPeriodId: { in: periodIds } },
          select: { reportingPeriodId: true, totalCo2e: true },
        })
      : [];

  // Sum kgCO2e per period then convert to tonnes
  const aggregateByPeriod = new Map<string, number>();
  for (const row of aggregateRows) {
    const prev = aggregateByPeriod.get(row.reportingPeriodId) ?? 0;
    aggregateByPeriod.set(row.reportingPeriodId, prev + Number(row.totalCo2e));
  }

  const targetsWithProgress: TargetWithProgress[] = targets.map((t) => {
    const baselineKg = aggregateByPeriod.get(t.baselinePeriodId) ?? null;
    const currentKg = aggregateByPeriod.get(t.targetPeriodId) ?? null;
    return {
      id: t.id,
      targetType: t.targetType,
      baselinePeriodLabel: t.baselinePeriod.label,
      baselineTonnes: baselineKg !== null ? baselineKg / 1000 : null,
      targetPeriodLabel: t.targetPeriod.label,
      currentTonnes: currentKg !== null ? currentKg / 1000 : null,
      reductionAmountKg: Number(t.reductionAmount),
    };
  });

  const memberOptions = memberships.map((membership) => ({
    userId: membership.user.id,
    label: membership.user.name ?? membership.user.email,
  }));

  return (
    <div className="p-[42px] max-w-[1200px] mx-auto flex flex-col gap-[42px]">
      <div>
        <p className="text-xs font-normal tracking-[-0.36px] text-[#111827] bg-[#F0F9FF] rounded-full px-[14px] py-[7px] inline-flex mb-[14px]">
          Strategy
        </p>
        <h1
          className="text-2xl font-bold tracking-tight text-[#111827]"
          
        >
          Targets
        </h1>
        <p className="text-sm text-[#374151] font-normal tracking-[-0.42px] mt-[7px]">
          Reduction targets and initiatives connected to reporting periods.
        </p>
      </div>

      <TargetProgressSection targets={targetsWithProgress} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Reduction targets{" "}
            <span className="text-sm font-normal text-[#374151]">({targets.length})</span>
          </CardTitle>
          <CardDescription>
            Targets compare a baseline period with a target period.
          </CardDescription>
        </CardHeader>
        <CardContent className={targets.length === 0 ? "pb-8" : "p-0 pb-2"}>
          {canEdit && (
            <div className="px-6 pb-5">
              <CreateTargetForm orgId={orgId} periods={periods} />
            </div>
          )}
          {targets.length === 0 ? (
            <EmptyState
              title="No reduction targets yet"
              description="Create targets after reporting periods and calculation snapshots are available."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Baseline</TableHead>
                  <TableHead>Target period</TableHead>
                  <TableHead>Reduction</TableHead>
                  <TableHead>Created by</TableHead>
                  {canEdit && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {targets.map((target) => (
                  <TableRow key={target.id}>
                    <TableCell className="font-normal text-[#000000] capitalize">
                      {target.targetType}
                    </TableCell>
                    <TableCell className="text-[#374151]">{target.baselinePeriod.label}</TableCell>
                    <TableCell className="text-[#374151]">{target.targetPeriod.label}</TableCell>
                    <TableCell className="text-[#374151]">
                      {Number(target.reductionAmount).toLocaleString("en-GB")} kgCO2e
                    </TableCell>
                    <TableCell className="text-[#374151]">
                      {target.createdBy.name ?? target.createdBy.email}
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <DeleteTargetButton
                          orgId={orgId}
                          targetId={target.id}
                          label={`${target.targetType} — ${target.baselinePeriod.label} to ${target.targetPeriod.label}`}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Reduction initiatives{" "}
            <span className="text-sm font-normal text-[#374151]">({initiatives.length})</span>
          </CardTitle>
          <CardDescription>
            Operational actions planned or underway to reduce emissions.
          </CardDescription>
        </CardHeader>
        <CardContent className={initiatives.length === 0 ? "pb-8" : "p-0 pb-2"}>
          {canEdit && (
            <div className="px-6 pb-5">
              <CreateInitiativeForm orgId={orgId} members={memberOptions} />
            </div>
          )}
          {initiatives.length === 0 ? (
            <EmptyState
              title="No initiatives yet"
              description="Add initiatives once owners, costs, expected dates, and estimated impact are known."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Expected impact</TableHead>
                  <TableHead>Cost</TableHead>
                  {canEdit && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {initiatives.map((initiative) => (
                  <TableRow key={initiative.id}>
                    <TableCell className="font-normal text-[#000000]">{initiative.name}</TableCell>
                    <TableCell>
                      <Badge variant={initiative.status === "complete" ? "default" : "outline"}>
                        {initiative.status.replaceAll("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[#374151]">
                      {initiative.owner?.name ?? initiative.owner?.email ?? "Unassigned"}
                    </TableCell>
                    <TableCell className="text-[#374151]">
                      {initiative.expectedImpactCo2e
                        ? `${Number(initiative.expectedImpactCo2e).toLocaleString("en-GB")} kgCO2e`
                        : "Not estimated"}
                    </TableCell>
                    <TableCell className="text-[#374151]">
                      {initiative.costAmount
                        ? `${initiative.costCurrency ?? "GBP"} ${Number(initiative.costAmount).toLocaleString("en-GB")}`
                        : "Not set"}
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <DeleteInitiativeButton
                          orgId={orgId}
                          initiativeId={initiative.id}
                          label={initiative.name}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="p-[42px]">
      <p className="text-sm text-[#374151] tracking-[-0.42px]">
        You do not have permission to view targets.
      </p>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#F0F9FF]">
        <Target className="h-7 w-7 text-[#111827]" />
      </div>
      <div>
        <p className="font-normal text-[#111827] tracking-[-0.42px]">{title}</p>
        <p className="text-sm text-[#374151] tracking-[-0.42px] mt-[7px] max-w-sm">{description}</p>
      </div>
    </div>
  );
}
