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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Camera, FileText } from "lucide-react";

interface ReportsPageProps {
  params: Promise<{ orgId: string }>;
}

const REPORT_TYPE_LABELS: Record<string, string> = {
  inventory: "Inventory",
  monthly_snapshot: "Monthly snapshot",
  audit_package: "Audit package",
};

const STATUS_LABELS: Record<string, string> = {
  queued: "Queued",
  generating: "Generating",
  ready: "Ready",
  failed: "Failed",
};

const STATUS_CLASSES: Record<string, string> = {
  queued: "bg-slate-100 text-slate-700 border-transparent",
  generating: "bg-blue-100 text-blue-700 border-transparent",
  ready: "bg-green-100 text-green-700 border-transparent",
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

export default async function ReportsPage({ params }: ReportsPageProps) {
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

  const [snapshots, reports] = await Promise.all([
    prisma.publishedSnapshot.findMany({
      where: { organizationId: orgId },
      include: {
        reportingPeriod: { select: { label: true } },
        publishedBy: { select: { name: true, email: true } },
        _count: { select: { reports: true } },
      },
      orderBy: { publishedAt: "desc" },
      take: 100,
    }),
    prisma.report.findMany({
      where: { organizationId: orgId },
      include: {
        reportingPeriod: { select: { label: true } },
        snapshot: { select: { version: true } },
        createdBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
        <p className="text-slate-500 mt-1">
          Published snapshots and generated report artefacts. Report totals always match
          dashboard totals for the same snapshot.
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">
            Published snapshots{" "}
            <span className="text-sm font-normal text-slate-500">({snapshots.length})</span>
          </CardTitle>
          <CardDescription>
            Immutable, versioned links between a reporting period and a calculation run.
            Dashboards and reports read from these.
          </CardDescription>
        </CardHeader>
        <CardContent className={snapshots.length === 0 ? "pb-8" : "p-0 pb-2"}>
          {snapshots.length === 0 ? (
            <EmptyState
              icon={Camera}
              title="No published snapshots yet"
              description="Run a calculation, review the results, then publish a snapshot to lock totals for reporting."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Version</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Published by</TableHead>
                  <TableHead>Published at</TableHead>
                  <TableHead>Calculation run</TableHead>
                  <TableHead className="text-right">Reports</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snapshots.map((snapshot) => (
                  <TableRow key={snapshot.id}>
                    <TableCell className="font-medium text-slate-900">
                      v{snapshot.version}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {snapshot.reportingPeriod.label}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {snapshot.publishedBy.name ?? snapshot.publishedBy.email}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {formatTimestamp(snapshot.publishedAt)}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/orgs/${orgId}/calculations/${snapshot.calculationRunId}`}
                        className="hover:underline underline-offset-2 text-[#0f3e17]"
                      >
                        View run
                      </Link>
                    </TableCell>
                    <TableCell className="text-right text-slate-600">
                      {snapshot._count.reports.toLocaleString("en-GB")}
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
            Reports <span className="text-sm font-normal text-slate-500">({reports.length})</span>
          </CardTitle>
          <CardDescription>
            PDF and CSV outputs generated asynchronously from published snapshots.
          </CardDescription>
        </CardHeader>
        <CardContent className={reports.length === 0 ? "pb-8" : "p-0 pb-2"}>
          {reports.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No reports requested yet"
              description="Publish a snapshot, then request inventory, monthly snapshot, or audit package outputs."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Snapshot</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created by</TableHead>
                  <TableHead>Created at</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="font-medium text-slate-900">
                      {REPORT_TYPE_LABELS[report.type] ?? report.type.replaceAll("_", " ")}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {report.reportingPeriod.label}
                    </TableCell>
                    <TableCell className="text-slate-600">v{report.snapshot.version}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={STATUS_CLASSES[report.status] ?? STATUS_CLASSES.queued}
                      >
                        {STATUS_LABELS[report.status] ?? report.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {report.createdBy.name ?? report.createdBy.email}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {formatTimestamp(report.createdAt)}
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
      <p className="text-red-600">You do not have permission to view reports.</p>
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
