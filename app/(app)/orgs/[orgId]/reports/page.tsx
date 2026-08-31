export const dynamic = "force-dynamic";

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
import { FileText, Layers, Clock, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { CreateReportForm } from "./report-form";
import { ReportDownloadActions } from "./report-download-actions";
import { StatusPoller } from "@/components/ui/status-poller";

interface ReportsPageProps {
  params: Promise<{ orgId: string }>;
}

const REPORT_TYPE_LABELS: Record<string, string> = {
  inventory:       "Inventory",
  monthly_snapshot: "Monthly snapshot",
  audit_package:   "Audit package",
  secr:            "SECR",
  ppn_06_21:       "PPN 06/21",
  ppn_006_crp:     "PPN 006 CRP",
  nhs_evergreen:   "NHS Evergreen L1",
  breeam_evidence: "BREEAM Evidence",
  national_toms:   "National TOMS",
  csrd_esrs_e1:    "CSRD ESRS E1",
  contract_carbon: "Contract Carbon",
  ghg_protocol:    "GHG Protocol",
  cdp:             "CDP Climate",
  cbam:            "CBAM",
};

function statusConfig(status: string) {
  switch (status) {
    case "queued":
      return { label: "Queued", className: "bg-zinc-100 text-[#374151] border-transparent", icon: Clock };
    case "generating":
      return { label: "Generating", className: "bg-blue-50 text-blue-700 border-transparent animate-pulse", icon: Loader2 };
    case "ready":
      return { label: "Ready", className: "bg-[#F0F9FF] text-[#111827] border-transparent", icon: CheckCircle2 };
    case "failed":
      return { label: "Failed", className: "bg-red-50 text-red-700 border-transparent", icon: AlertTriangle };
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

export default async function ReportsPage({ params }: ReportsPageProps) {
  const { orgId } = await params;

  try {
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/sign-in");
      return (
        <div className="p-8 text-sm text-[#9CA3AF]">
          You do not have permission to view reports.
        </div>
      );
    }
    return (
      <div className="p-8">
        <p className="text-red-600 text-sm">
          Failed to load page. The database may be updating — try refreshing in a moment.
        </p>
      </div>
    );
  }

  const dbResult = await Promise.all([
    prisma.publishedSnapshot.findMany({
      where: { organizationId: orgId },
      include: {
        reportingPeriod: { select: { label: true } },
        publishedBy: { select: { name: true, email: true } },
        _count: { select: { reports: true } },
      },
      orderBy: { publishedAt: "desc" },
      take: 20,
    }),
    prisma.report.findMany({
      where: { organizationId: orgId },
      include: {
        reportingPeriod: { select: { label: true } },
        snapshot: { select: { version: true } },
        createdBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.contract.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]).catch(() => null);

  if (!dbResult) {
    return (
      <div className="p-8"><p className="text-red-600 text-sm">Failed to load reports. The database may be updating — try refreshing in a moment.</p></div>
    );
  }
  const [snapshots, reports, contracts] = dbResult;
  const hasInFlight = reports.some((r) => r.status === "queued" || r.status === "generating");
  const stats = {
    total: reports.length,
    ready: reports.filter((r) => r.status === "ready").length,
    generating: reports.filter((r) => r.status === "queued" || r.status === "generating").length,
  };

  return (
    <div className="min-h-[100dvh] bg-[#f9fafb]">
      <StatusPoller active={hasInFlight} intervalMs={5000} />

      {/* Page header */}
      <div className="bg-white border-b border-[#E5E7EB]">
        <div className="max-w-[1200px] mx-auto px-8 py-8">
          <div className="flex items-start gap-3 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F0F9FF] shrink-0 mt-0.5">
              <FileText className="h-4 w-4 text-[#111827]" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium tracking-wide text-[#111827] uppercase">Reporting</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-[#111827]">Reports</h1>
              <p className="mt-1 text-sm text-[#9CA3AF] max-w-[65ch]">
                Generate PDF and CSV reports from published snapshots. Totals are guaranteed to match dashboard figures for the same snapshot.
              </p>
            </div>
          </div>

          {reports.length > 0 && (
            <div className="flex flex-wrap gap-3 mt-6">
              <StatPill label="Total reports" value={stats.total} />
              <StatPill label="Ready" value={stats.ready} accent="green" />
              {stats.generating > 0 && (
                <StatPill label="Generating" value={stats.generating} accent="blue" pulse />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1200px] mx-auto px-8 py-8 flex flex-col gap-6">
        {/* Snapshots */}
        <Card className="border-[#E5E7EB] shadow-none">
          <CardHeader className="px-6 py-4 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-[#9CA3AF]" />
              <CardTitle className="text-sm font-semibold text-[#111827]">
                Published snapshots
                <span className="ml-2 text-xs font-normal text-[#9CA3AF]">({snapshots.length})</span>
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-[#9CA3AF] mt-0.5">
              Immutable links between a reporting period and a calculation run. Dashboards and reports read from these.
            </CardDescription>
          </CardHeader>
          <CardContent className={snapshots.length === 0 ? "py-12" : "p-0"}>
            {snapshots.length === 0 ? (
              <EmptyState
                icon={Layers}
                title="No published snapshots yet"
                description="Run a calculation, review the results, then publish a snapshot to lock totals for reporting."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#f9fafb] border-b border-[#E5E7EB]">
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3 pl-6">Version</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3">Period</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3">Published by</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3">Published at</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3">Calculation run</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3">Assurance</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3 text-right pr-6">Reports</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {snapshots.map((snapshot) => (
                      <TableRow key={snapshot.id} className="border-b border-[#f3f4f6] hover:bg-[#f9fafb] transition-colors">
                        <TableCell className="py-3.5 pl-6">
                          <span className="font-semibold text-sm text-[#111827]">v{snapshot.version}</span>
                        </TableCell>
                        <TableCell className="text-sm text-[#374151] py-3.5">
                          {snapshot.reportingPeriod.label}
                        </TableCell>
                        <TableCell className="text-sm text-[#9CA3AF] py-3.5">
                          {snapshot.publishedBy.name ?? snapshot.publishedBy.email}
                        </TableCell>
                        <TableCell className="text-sm text-[#9CA3AF] py-3.5 tabular-nums">
                          {formatTimestamp(snapshot.publishedAt)}
                        </TableCell>
                        <TableCell className="py-3.5">
                          <Link
                            href={`/orgs/${orgId}/calculations/${snapshot.calculationRunId}`}
                            className="text-sm text-[#111827] hover:underline underline-offset-2"
                          >
                            View run
                          </Link>
                        </TableCell>
                        <TableCell className="py-3.5">
                          <Link
                            href={`/orgs/${orgId}/snapshots/${snapshot.id}/assurance`}
                            className="text-sm text-[#111827] hover:underline underline-offset-2"
                          >
                            Review
                          </Link>
                        </TableCell>
                        <TableCell className="py-3.5 text-right pr-6 text-sm text-[#9CA3AF] tabular-nums">
                          {snapshot._count.reports.toLocaleString("en-GB")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reports */}
        <Card className="border-[#E5E7EB] shadow-none">
          <CardHeader className="px-6 py-4 border-b border-[#E5E7EB]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#9CA3AF]" />
                <CardTitle className="text-sm font-semibold text-[#111827]">
                  Reports
                  <span className="ml-2 text-xs font-normal text-[#9CA3AF]">({reports.length})</span>
                </CardTitle>
              </div>
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
            <CardDescription className="text-xs text-[#9CA3AF] mt-0.5">
              PDF and CSV outputs generated asynchronously from published snapshots.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="px-6 py-5 border-b border-[#f3f4f6]">
              <CreateReportForm
                orgId={orgId}
                snapshots={snapshots.map((s) => ({
                  id: s.id,
                  reportingPeriodId: s.reportingPeriodId,
                  label: `${s.reportingPeriod.label} v${s.version}`,
                }))}
                contracts={contracts}
              />
            </div>
            {reports.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No reports requested yet"
                description="Select a snapshot and report type above to generate your first report."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#f9fafb] border-b border-[#E5E7EB]">
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3 pl-6">Type</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3">Period</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3">Snapshot</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3">Status</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3">Requested by</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3">Requested at</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3 pr-6">Download</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports.map((report) => {
                      const cfg = statusConfig(report.status);
                      const StatusIcon = cfg.icon;
                      return (
                        <TableRow key={report.id} className="border-b border-[#f3f4f6] hover:bg-[#f9fafb] transition-colors">
                          <TableCell className="py-3.5 pl-6">
                            <span className="text-sm font-medium text-[#111827]">
                              {REPORT_TYPE_LABELS[report.type] ?? report.type.replaceAll("_", " ")}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-[#374151] py-3.5">
                            {report.reportingPeriod.label}
                          </TableCell>
                          <TableCell className="text-sm text-[#9CA3AF] py-3.5">
                            v{report.snapshot.version}
                          </TableCell>
                          <TableCell className="py-3.5">
                            <Badge
                              variant="outline"
                              className={`inline-flex items-center gap-1 text-xs font-medium ${cfg.className}`}
                            >
                              <StatusIcon className="h-3 w-3" />
                              {cfg.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-[#9CA3AF] py-3.5">
                            {report.createdBy.name ?? report.createdBy.email}
                          </TableCell>
                          <TableCell className="text-sm text-[#9CA3AF] py-3.5 tabular-nums">
                            {formatTimestamp(report.createdAt)}
                          </TableCell>
                          <TableCell className="py-3.5 pr-6">
                            <ReportDownloadActions
                              orgId={orgId}
                              reportId={report.id}
                              hasPdf={!!report.pdfStorageKey}
                              hasCsv={!!report.csvStorageKey}
                              hasXml={!!report.xmlStorageKey}
                              ready={report.status === "ready"}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
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

function StatPill({
  label,
  value,
  accent,
  pulse,
}: {
  label: string;
  value: number;
  accent?: "green" | "blue";
  pulse?: boolean;
}) {
  const colors = {
    green: "bg-[#F0F9FF] text-[#111827]",
    blue: "bg-blue-50 text-blue-700",
  };
  const base = accent ? colors[accent] : "bg-white text-[#374151] border border-[#E5E7EB]";
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${base} ${pulse ? "animate-pulse" : ""}`}>
      <span className="tabular-nums font-semibold">{value}</span>
      <span>{label}</span>
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
    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F0F9FF] mb-4">
        <Icon className="h-6 w-6 text-[#111827]" />
      </div>
      <h3 className="text-sm font-semibold text-[#111827] mb-1">{title}</h3>
      <p className="text-sm text-[#9CA3AF] max-w-sm">{description}</p>
    </div>
  );
}
