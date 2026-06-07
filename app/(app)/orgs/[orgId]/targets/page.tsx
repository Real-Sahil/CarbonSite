import { AuthError, requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
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

interface TargetsPageProps {
  params: Promise<{ orgId: string }>;
}

export default async function TargetsPage({ params }: TargetsPageProps) {
  const { orgId } = await params;

  try {
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/sign-in");
      return <AccessDenied label="targets" />;
    }
    throw err;
  }

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

  const memberOptions = memberships.map((membership) => ({
    userId: membership.user.id,
    label: membership.user.name ?? membership.user.email,
  }));

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Targets</h1>
        <p className="text-slate-500 mt-1">
          Reduction targets and initiatives connected to reporting periods.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Reduction targets <span className="text-sm font-normal text-slate-500">({targets.length})</span>
          </CardTitle>
          <CardDescription>
            Targets compare a baseline period with a target period.
          </CardDescription>
        </CardHeader>
        <CardContent className={targets.length === 0 ? "pb-8" : "p-0 pb-2"}>
          <div className="px-6 pb-5">
            <CreateTargetForm orgId={orgId} periods={periods} />
          </div>
          {targets.length === 0 ? (
            <EmptyState
              icon={Target}
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {targets.map((target) => (
                  <TableRow key={target.id}>
                    <TableCell className="font-medium">{target.targetType}</TableCell>
                    <TableCell className="text-slate-600">{target.baselinePeriod.label}</TableCell>
                    <TableCell className="text-slate-600">{target.targetPeriod.label}</TableCell>
                    <TableCell className="text-slate-600">
                      {Number(target.reductionAmount).toLocaleString("en-GB")} kgCO2e
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {target.createdBy.name ?? target.createdBy.email}
                    </TableCell>
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
            Reduction initiatives <span className="text-sm font-normal text-slate-500">({initiatives.length})</span>
          </CardTitle>
          <CardDescription>
            Operational actions planned or underway to reduce emissions.
          </CardDescription>
        </CardHeader>
        <CardContent className={initiatives.length === 0 ? "pb-8" : "p-0 pb-2"}>
          <div className="px-6 pb-5">
            <CreateInitiativeForm orgId={orgId} members={memberOptions} />
          </div>
          {initiatives.length === 0 ? (
            <EmptyState
              icon={Target}
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {initiatives.map((initiative) => (
                  <TableRow key={initiative.id}>
                    <TableCell className="font-medium">{initiative.name}</TableCell>
                    <TableCell>
                      <Badge variant={initiative.status === "complete" ? "default" : "outline"}>
                        {initiative.status.replaceAll("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {initiative.owner?.name ?? initiative.owner?.email ?? "Unassigned"}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {initiative.expectedImpactCo2e
                        ? `${Number(initiative.expectedImpactCo2e).toLocaleString("en-GB")} kgCO2e`
                        : "Not estimated"}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {initiative.costAmount
                        ? `${initiative.costCurrency ?? "GBP"} ${Number(initiative.costAmount).toLocaleString("en-GB")}`
                        : "Not set"}
                    </TableCell>
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

function AccessDenied({ label }: { label: string }) {
  return (
    <div className="p-8">
      <p className="text-red-600">You do not have permission to view {label}.</p>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
        <Icon className="h-7 w-7 text-slate-400" />
      </div>
      <div>
        <p className="font-medium text-slate-700">{title}</p>
        <p className="text-sm text-slate-500 mt-1 max-w-sm">{description}</p>
      </div>
    </div>
  );
}
