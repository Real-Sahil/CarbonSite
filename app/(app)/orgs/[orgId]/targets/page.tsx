export const dynamic = "force-dynamic";

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
    return (
      <div className="p-8">
        <p className="text-red-600 text-sm">
          Failed to load page. The database may be updating — try refreshing in a moment.
        </p>
      </div>
    );
  }

  const canEdit = role === "admin" || role === "editor";

  const dbResult = await Promise.all([
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
  ]).catch(() => null);

  if (!dbResult) {
    return (
      <div className="p-8"><p className="text-red-600 text-sm">Failed to load targets. The database may be updating — try refreshing in a moment.</p></div>
    );
  }
  const [targets, initiatives, periods, memberships] = dbResult;

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
    <div className="min-h-[100dvh] bg-[#F9FAFB]">
      {/* Page header */}
      <div className="bg-white border-b border-[#E5E7EB]">
        <div className="max-w-[1200px] mx-auto px-8 py-8">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F0F9FF]">
              <Target className="h-4 w-4 text-[#111827]" />
            </div>
            <span className="text-xs font-medium tracking-wide text-[#111827] uppercase">
              Strategy
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111827]">
            Targets
          </h1>
          <p className="mt-1 text-sm text-[#374151] max-w-[65ch]">
            Reduction targets and initiatives connected to reporting periods.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1200px] mx-auto px-8 py-8 flex flex-col gap-6">
        <TargetProgressSection targets={targetsWithProgress} />

        <Card className="border-[#E5E7EB] shadow-none">
          <CardHeader className="px-6 py-4 border-b border-[#E5E7EB]">
            <CardTitle className="text-sm font-semibold text-[#111827]">
              Reduction targets{" "}
              <span className="ml-1 text-xs font-normal text-[#9CA3AF]">({targets.length})</span>
            </CardTitle>
            <CardDescription className="text-xs text-[#9CA3AF] mt-0.5">
              Targets compare a baseline period with a target period.
            </CardDescription>
          </CardHeader>
          <CardContent className={targets.length === 0 ? "pb-8" : "p-0 pb-2"}>
            {canEdit && (
              <div className="px-6 py-5 border-b border-[#E5E7EB]">
                <CreateTargetForm orgId={orgId} periods={periods} />
              </div>
            )}
            {targets.length === 0 ? (
              <EmptyState
                title="No reduction targets yet"
                description="Create targets after reporting periods and calculation snapshots are available."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3 pl-6">Type</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3">Baseline</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3">Target period</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3">Reduction</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3">Created by</TableHead>
                      {canEdit && <TableHead className="text-xs font-medium text-[#9CA3AF] py-3 pr-6">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {targets.map((target) => (
                      <TableRow key={target.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors">
                        <TableCell className="text-sm font-medium text-[#111827] capitalize py-3.5 pl-6">
                          {target.targetType}
                        </TableCell>
                        <TableCell className="text-sm text-[#374151] py-3.5">{target.baselinePeriod.label}</TableCell>
                        <TableCell className="text-sm text-[#374151] py-3.5">{target.targetPeriod.label}</TableCell>
                        <TableCell className="text-sm text-[#374151] py-3.5 tabular-nums">
                          {Number(target.reductionAmount).toLocaleString("en-GB")} kgCO2e
                        </TableCell>
                        <TableCell className="text-sm text-[#9CA3AF] py-3.5">
                          {target.createdBy.name ?? target.createdBy.email}
                        </TableCell>
                        {canEdit && (
                          <TableCell className="py-3.5 pr-6">
                            <DeleteTargetButton
                              orgId={orgId}
                              targetId={target.id}
                              label={`${target.targetType} - ${target.baselinePeriod.label} to ${target.targetPeriod.label}`}
                            />
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

        <Card className="border-[#E5E7EB] shadow-none">
          <CardHeader className="px-6 py-4 border-b border-[#E5E7EB]">
            <CardTitle className="text-sm font-semibold text-[#111827]">
              Reduction initiatives{" "}
              <span className="ml-1 text-xs font-normal text-[#9CA3AF]">({initiatives.length})</span>
            </CardTitle>
            <CardDescription className="text-xs text-[#9CA3AF] mt-0.5">
              Operational actions planned or underway to reduce emissions.
            </CardDescription>
          </CardHeader>
          <CardContent className={initiatives.length === 0 ? "pb-8" : "p-0 pb-2"}>
            {canEdit && (
              <div className="px-6 py-5 border-b border-[#E5E7EB]">
                <CreateInitiativeForm orgId={orgId} members={memberOptions} />
              </div>
            )}
            {initiatives.length === 0 ? (
              <EmptyState
                title="No initiatives yet"
                description="Add initiatives once owners, costs, expected dates, and estimated impact are known."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3 pl-6">Name</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3">Status</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3">Owner</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3">Expected impact</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3">Cost</TableHead>
                      {canEdit && <TableHead className="text-xs font-medium text-[#9CA3AF] py-3 pr-6">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {initiatives.map((initiative) => (
                      <TableRow key={initiative.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors">
                        <TableCell className="text-sm font-medium text-[#111827] py-3.5 pl-6">{initiative.name}</TableCell>
                        <TableCell className="py-3.5">
                          <Badge variant={initiative.status === "complete" ? "default" : "outline"}>
                            {initiative.status.replaceAll("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-[#374151] py-3.5">
                          {initiative.owner?.name ?? initiative.owner?.email ?? "Unassigned"}
                        </TableCell>
                        <TableCell className="text-sm text-[#374151] py-3.5 tabular-nums">
                          {initiative.expectedImpactCo2e
                            ? `${Number(initiative.expectedImpactCo2e).toLocaleString("en-GB")} kgCO2e`
                            : "Not estimated"}
                        </TableCell>
                        <TableCell className="text-sm text-[#374151] py-3.5 tabular-nums">
                          {initiative.costAmount
                            ? `${initiative.costCurrency ?? "GBP"} ${Number(initiative.costAmount).toLocaleString("en-GB")}`
                            : "Not set"}
                        </TableCell>
                        {canEdit && (
                          <TableCell className="py-3.5 pr-6">
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
      <p className="text-sm text-red-600">You do not have permission to view targets.</p>
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
