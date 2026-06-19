import { AuthError, requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calculator, Play } from "lucide-react";

interface CalculationsPageProps {
  params: Promise<{ orgId: string }>;
}

const STATUS_LABELS: Record<string, string> = {
  queued: "Queued",
  running: "Running",
  succeeded: "Succeeded",
  failed: "Failed",
};

const STATUS_CLASSES: Record<string, string> = {
  queued: "bg-slate-100 text-slate-700 border-transparent",
  running: "bg-blue-100 text-blue-700 border-transparent",
  succeeded: "bg-green-100 text-green-700 border-transparent",
  failed: "bg-red-100 text-red-700 border-transparent",
};

function formatTimestamp(value: Date | null): string {
  if (!value) return "Not yet";
  return value.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function CalculationsPage({ params }: CalculationsPageProps) {
  const { orgId } = await params;

  try {
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/sign-in");
      return <AccessDenied />;
    }
    throw err;
  }

  const runs = await prisma.calculationRun.findMany({
    where: { organizationId: orgId },
    include: {
      reportingPeriod: { select: { label: true } },
      factorLibrary: { select: { name: true, version: true } },
      methodologyVersion: { select: { name: true } },
      triggeredBy: { select: { name: true, email: true } },
      _count: { select: { calculations: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="p-[42px] max-w-[1200px] mx-auto">
      <div className="mb-[42px] flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-normal tracking-[-0.36px] text-[#0f3e17] bg-[#b6ced5] rounded-full px-[14px] py-[7px] inline-flex mb-[14px]">
            Calculations
          </p>
          <h1
            className="text-[40px] leading-[1.35] tracking-[-0.4px] text-[#0f3e17]"
            style={{ fontFamily: "var(--font-fraunces, Fraunces, Georgia, serif)", fontWeight: 300 }}
          >
            Calculation runs
          </h1>
          <p className="text-sm text-[#222222] font-normal tracking-[-0.42px] mt-[7px]">
            Deterministic emission calculations from approved activity records, traceable per run.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href={`/orgs/${orgId}/dashboard#run-calculation`}>
            <Play className="h-3.5 w-3.5" />
            Run a calculation
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Runs <span className="text-sm font-normal text-slate-500">({runs.length})</span>
          </CardTitle>
          <CardDescription>
            Each run applies one factor library and methodology version to a reporting period. Results are immutable.
          </CardDescription>
        </CardHeader>
        <CardContent className={runs.length === 0 ? "pb-8" : "p-0 pb-2"}>
          {runs.length === 0 ? (
            <EmptyState
              icon={Calculator}
              title="No calculation runs yet"
              description="Approve activity records, then trigger a calculation from the dashboard to compute scope 1, 2, and 3 emissions for a reporting period."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Factor library</TableHead>
                  <TableHead>Methodology</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Triggered by</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Finished</TableHead>
                  <TableHead className="text-right">Calculations</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/orgs/${orgId}/calculations/${run.id}`}
                        className="hover:underline underline-offset-2 text-[#0f3e17]"
                      >
                        {run.reportingPeriod.label}
                      </Link>
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {run.factorLibrary.name} {run.factorLibrary.version}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {run.methodologyVersion.name}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={STATUS_CLASSES[run.status] ?? STATUS_CLASSES.queued}
                      >
                        {STATUS_LABELS[run.status] ?? run.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {run.triggeredBy.name ?? run.triggeredBy.email}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {formatTimestamp(run.startedAt)}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {formatTimestamp(run.finishedAt)}
                    </TableCell>
                    <TableCell className="text-right text-slate-600">
                      {run._count.calculations.toLocaleString("en-GB")}
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

function AccessDenied() {
  return (
    <div className="p-8">
      <p className="text-red-600">You do not have permission to view calculation runs.</p>
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
