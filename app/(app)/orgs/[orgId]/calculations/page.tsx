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
import { Calculator, Play, RefreshCw, AlertTriangle, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { StatusPoller } from "@/components/ui/status-poller";
import { RetryCalculationButton } from "./retry-button";

interface CalculationsPageProps {
  params: Promise<{ orgId: string }>;
}

function statusConfig(status: string) {
  switch (status) {
    case "queued":
      return {
        label: "Queued",
        className: "bg-zinc-100 text-zinc-600 border-transparent",
        icon: Clock,
      };
    case "running":
      return {
        label: "Running",
        className: "bg-blue-50 text-blue-700 border-transparent animate-pulse",
        icon: Loader2,
      };
    case "succeeded":
      return {
        label: "Succeeded",
        className: "bg-[#e1f4df] text-[#0f3e17] border-transparent",
        icon: CheckCircle2,
      };
    case "failed":
      return {
        label: "Failed",
        className: "bg-red-50 text-red-700 border-transparent",
        icon: AlertTriangle,
      };
    default:
      return { label: status, className: "border-zinc-200", icon: Clock };
  }
}

function formatTimestamp(value: Date | null): string {
  if (!value) return "-";
  return value.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(start: Date | null, end: Date | null): string {
  if (!start) return "-";
  const finish = end ?? new Date();
  const ms = finish.getTime() - start.getTime();
  if (ms < 1000) return "<1s";
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60_000)}m`;
}

export default async function CalculationsPage({ params }: CalculationsPageProps) {
  const { orgId } = await params;

  try {
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/sign-in");
      return (
        <div className="p-8 text-sm text-zinc-500">
          You do not have permission to view calculation runs.
        </div>
      );
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
    take: 50,
  });

  const hasInFlight = runs.some((r) => r.status === "queued" || r.status === "running");
  const stats = {
    total: runs.length,
    succeeded: runs.filter((r) => r.status === "succeeded").length,
    failed: runs.filter((r) => r.status === "failed").length,
    running: runs.filter((r) => r.status === "running" || r.status === "queued").length,
  };

  return (
    <div className="min-h-[100dvh] bg-[#f9fafb]">
      <StatusPoller active={hasInFlight} intervalMs={4000} />

      {/* Page header */}
      <div className="bg-white border-b border-[#e5e7eb]">
        <div className="max-w-[1200px] mx-auto px-8 py-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e1f4df]">
                  <Calculator className="h-4 w-4 text-[#0f3e17]" />
                </div>
                <span className="text-xs font-medium tracking-wide text-[#0f3e17] uppercase">
                  Calculations
                </span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
                Calculation runs
              </h1>
              <p className="mt-1 text-sm text-zinc-500 max-w-[65ch]">
                Deterministic emission calculations from approved activity records. Results are immutable per run.
              </p>
            </div>
            <Button asChild size="sm" className="bg-[#0f3e17] hover:bg-[#1a5c26] text-white shrink-0">
              <Link href={`/orgs/${orgId}/dashboard#run-calculation`}>
                <Play className="h-3.5 w-3.5 mr-1.5" />
                Run calculation
              </Link>
            </Button>
          </div>

          {/* Stat pills */}
          {runs.length > 0 && (
            <div className="flex flex-wrap gap-3 mt-6">
              <StatPill label="Total runs" value={stats.total} />
              <StatPill label="Succeeded" value={stats.succeeded} accent="green" />
              {stats.running > 0 && (
                <StatPill label="In progress" value={stats.running} accent="blue" pulse />
              )}
              {stats.failed > 0 && (
                <StatPill label="Failed" value={stats.failed} accent="red" />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1200px] mx-auto px-8 py-8">
        {runs.length === 0 ? (
          <EmptyState orgId={orgId} />
        ) : (
          <Card className="border-[#e5e7eb] shadow-none">
            <CardHeader className="px-6 py-4 border-b border-[#e5e7eb]">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-zinc-900">
                  All runs
                  <span className="ml-2 text-xs font-normal text-zinc-400">
                    ({runs.length})
                  </span>
                </CardTitle>
                {hasInFlight && (
                  <div className="flex items-center gap-1.5 text-xs text-blue-600">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                    </span>
                    Live
                  </div>
                )}
              </div>
              <CardDescription className="text-xs text-zinc-400 mt-0.5">
                Each run applies one factor library and methodology version to a reporting period.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#f9fafb] border-b border-[#e5e7eb]">
                      <TableHead className="text-xs font-medium text-zinc-500 py-3 pl-6">Period</TableHead>
                      <TableHead className="text-xs font-medium text-zinc-500 py-3">Factor library</TableHead>
                      <TableHead className="text-xs font-medium text-zinc-500 py-3">Methodology</TableHead>
                      <TableHead className="text-xs font-medium text-zinc-500 py-3">Status</TableHead>
                      <TableHead className="text-xs font-medium text-zinc-500 py-3">Triggered by</TableHead>
                      <TableHead className="text-xs font-medium text-zinc-500 py-3">Started</TableHead>
                      <TableHead className="text-xs font-medium text-zinc-500 py-3">Duration</TableHead>
                      <TableHead className="text-xs font-medium text-zinc-500 py-3 text-right">Records</TableHead>
                      <TableHead className="text-xs font-medium text-zinc-500 py-3 pr-6" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runs.map((run) => {
                      const cfg = statusConfig(run.status);
                      const StatusIcon = cfg.icon;
                      return (
                        <TableRow key={run.id} className="border-b border-[#f3f4f6] hover:bg-[#f9fafb] transition-colors">
                          <TableCell className="py-3.5 pl-6">
                            <Link
                              href={`/orgs/${orgId}/calculations/${run.id}`}
                              className="font-medium text-[#0f3e17] hover:underline underline-offset-2 text-sm"
                            >
                              {run.reportingPeriod.label}
                            </Link>
                          </TableCell>
                          <TableCell className="text-sm text-zinc-600 py-3.5">
                            {run.factorLibrary.name}{" "}
                            <span className="text-zinc-400">{run.factorLibrary.version}</span>
                          </TableCell>
                          <TableCell className="text-sm text-zinc-600 py-3.5">
                            {run.methodologyVersion.name}
                          </TableCell>
                          <TableCell className="py-3.5">
                            <div className="flex flex-col gap-1">
                              <Badge
                                variant="outline"
                                className={`inline-flex items-center gap-1 text-xs font-medium ${cfg.className}`}
                              >
                                <StatusIcon className="h-3 w-3" />
                                {cfg.label}
                              </Badge>
                              {run.status === "failed" && run.errorMessage && (
                                <p className="text-xs text-red-600 max-w-[200px] leading-tight">
                                  {run.errorMessage.slice(0, 100)}
                                  {run.errorMessage.length > 100 ? "..." : ""}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-zinc-500 py-3.5">
                            {run.triggeredBy.name ?? run.triggeredBy.email}
                          </TableCell>
                          <TableCell className="text-sm text-zinc-500 py-3.5 tabular-nums">
                            {formatTimestamp(run.startedAt)}
                          </TableCell>
                          <TableCell className="text-sm text-zinc-500 py-3.5 tabular-nums">
                            {run.status === "running"
                              ? <span className="text-blue-600">{formatDuration(run.startedAt, null)}</span>
                              : formatDuration(run.startedAt, run.finishedAt)
                            }
                          </TableCell>
                          <TableCell className="text-sm text-zinc-500 py-3.5 text-right tabular-nums">
                            {run._count.calculations.toLocaleString("en-GB")}
                          </TableCell>
                          <TableCell className="py-3.5 pr-6">
                            {run.status === "failed" && (
                              <RetryCalculationButton
                                orgId={orgId}
                                reportingPeriodId={run.reportingPeriodId}
                                methodologyVersionId={run.methodologyVersionId}
                                factorLibraryId={run.factorLibraryId}
                              />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function StatPill({
  label,
  value,
  accent,
  pulse,
}: {
  label: string;
  value: number;
  accent?: "green" | "blue" | "red";
  pulse?: boolean;
}) {
  const colors = {
    green: "bg-[#e1f4df] text-[#0f3e17]",
    blue: "bg-blue-50 text-blue-700",
    red: "bg-red-50 text-red-700",
  };
  const base = accent ? colors[accent] : "bg-white text-zinc-700 border border-[#e5e7eb]";
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${base} ${pulse ? "animate-pulse" : ""}`}>
      <span className="tabular-nums font-semibold">{value}</span>
      <span>{label}</span>
    </div>
  );
}

function EmptyState({ orgId }: { orgId: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e1f4df] mb-5">
        <Calculator className="h-7 w-7 text-[#0f3e17]" />
      </div>
      <h3 className="text-base font-semibold text-zinc-900 mb-2">No calculation runs yet</h3>
      <p className="text-sm text-zinc-500 max-w-sm mb-6">
        Approve activity records, then trigger a calculation from the dashboard to compute scope 1, 2, and 3 emissions.
      </p>
      <Button asChild size="sm" className="bg-[#0f3e17] hover:bg-[#1a5c26] text-white">
        <Link href={`/orgs/${orgId}/dashboard#run-calculation`}>
          <Play className="h-3.5 w-3.5 mr-1.5" />
          Go to dashboard
        </Link>
      </Button>
    </div>
  );
}
