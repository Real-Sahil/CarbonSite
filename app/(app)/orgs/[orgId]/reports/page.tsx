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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarChart2 } from "lucide-react";
import { CreateReportForm } from "./report-form";

interface ReportsPageProps {
  params: Promise<{ orgId: string }>;
}

const STATUS_LABELS: Record<string, string> = {
  queued: "Queued",
  generating: "Generating",
  ready: "Ready",
  failed: "Failed",
};

export default async function ReportsPage({ params }: ReportsPageProps) {
  const { orgId } = await params;

  try {
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/sign-in");
      return <AccessDenied label="reports" />;
    }
    throw err;
  }

  const [reports, snapshots] = await Promise.all([
    prisma.report.findMany({
      where: { organizationId: orgId },
      include: {
        reportingPeriod: { select: { label: true } },
        snapshot: { select: { version: true, publishedAt: true } },
        createdBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.publishedSnapshot.findMany({
      where: { organizationId: orgId },
      include: {
        reportingPeriod: { select: { id: true, label: true } },
      },
      orderBy: { publishedAt: "desc" },
      take: 100,
    }),
  ]);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
        <p className="text-slate-500 mt-1">
          Published snapshot reports with signed PDF and CSV artefacts.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Report requests <span className="text-sm font-normal text-slate-500">({reports.length})</span>
          </CardTitle>
          <CardDescription>
            Reports are generated from immutable published snapshots.
          </CardDescription>
        </CardHeader>
        <CardContent className={reports.length === 0 ? "pb-8" : "p-0 pb-2"}>
          <div className="px-6 pb-5">
            <CreateReportForm
              orgId={orgId}
              snapshots={snapshots.map((snapshot) => ({
                id: snapshot.id,
                reportingPeriodId: snapshot.reportingPeriodId,
                label: `${snapshot.reportingPeriod.label} - snapshot v${snapshot.version}`,
              }))}
            />
          </div>
          {reports.length === 0 ? (
            <EmptyState
              icon={BarChart2}
              title="No reports requested yet"
              description="Publish a calculation snapshot before generating inventory, monthly, or audit reports."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Snapshot</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Artefacts</TableHead>
                  <TableHead>Created by</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="font-medium">{report.type.replaceAll("_", " ")}</TableCell>
                    <TableCell className="text-slate-600">{report.reportingPeriod.label}</TableCell>
                    <TableCell className="text-slate-600">
                      Snapshot v{report.snapshot.version}
                    </TableCell>
                    <TableCell className="text-slate-600">v{report.version}</TableCell>
                    <TableCell className="text-slate-600">
                      {report.pdfStorageKey ? "PDF" : "No PDF"}
                      {report.csvStorageKey ? " + CSV" : ""}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {report.createdBy.name ?? report.createdBy.email}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          report.status === "failed"
                            ? "destructive"
                            : report.status === "ready"
                              ? "default"
                              : "outline"
                        }
                      >
                        {STATUS_LABELS[report.status] ?? report.status}
                      </Badge>
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
