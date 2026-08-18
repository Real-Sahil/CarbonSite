export const dynamic = "force-dynamic";

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
import { Upload } from "lucide-react";
import { CreateImportForm } from "./import-form";
import { ImportBatchActions, ImportBatchEvidenceActions } from "./import-actions";
import { DeleteImportButton } from "./delete-import-button";

interface ImportsPageProps {
  params: Promise<{ orgId: string }>;
}

const STATE_CONFIG: Record<string, { label: string; className: string }> = {
  uploaded:        { label: "Uploaded",         className: "bg-zinc-100 text-[#374151] border-transparent" },
  parsing:         { label: "Parsing",           className: "bg-blue-50 text-blue-700 border-transparent animate-pulse" },
  needs_attention: { label: "Needs attention",   className: "bg-amber-50 text-amber-700 border-transparent" },
  ready_to_commit: { label: "Ready to commit",   className: "bg-[#F0F9FF] text-[#111827] border-transparent" },
  committed:       { label: "Committed",         className: "bg-[#0EA5E9] text-white border-transparent" },
  failed:          { label: "Failed",            className: "bg-red-50 text-red-700 border-transparent" },
};

export default async function ImportsPage({ params }: ImportsPageProps) {
  const { orgId } = await params;

  let isAdminOrEditor = false;
  try {
    const { membership } = await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");
    isAdminOrEditor = membership.role === "admin" || membership.role === "editor";
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/sign-in");
      return (
        <div className="p-8 text-sm text-[#9CA3AF]">
          You do not have permission to view imports.
        </div>
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[imports] auth/membership check failed:", msg);
    return (
      <div className="p-8">
        <p className="text-sm font-medium text-red-700">Failed to load imports (auth/db error)</p>
        <pre className="mt-2 text-xs text-red-600 whitespace-pre-wrap break-all max-w-2xl">{msg}</pre>
      </div>
    );
  }

  const importsQuery = prisma.importBatch.findMany({
    where: { organizationId: orgId },
    include: {
      createdBy: { select: { name: true, email: true } },
      evidence: {
        include: {
          evidenceFile: { select: { id: true, filename: true } },
        },
      },
      _count: { select: { stagedRecords: true, activityRecords: true, evidence: true } },
      stagedRecords: {
        where: { status: "staged" },
        take: 5,
        select: { validationErrors: true, rowNumber: true },
        orderBy: { rowNumber: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  type ImportsResult = Awaited<typeof importsQuery>;

  let imports: ImportsResult;
  try {
    imports = await importsQuery;
  } catch (dbErr) {
    const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
    console.error("[imports] query failed:", msg);
    return (
      <div className="p-8">
        <p className="text-sm font-medium text-red-700">Failed to load imports</p>
        <pre className="mt-2 text-xs text-red-600 whitespace-pre-wrap break-all max-w-2xl">{msg}</pre>
      </div>
    );
  }

  const periodIds = [...new Set(imports.map((batch) => batch.reportingPeriodId))];
  let periods: { id: string; label: string }[] = [];
  let allPeriods: { id: string; label: string }[] = [];
  try {
    [periods, allPeriods] = await Promise.all([
      periodIds.length
        ? prisma.reportingPeriod.findMany({
            where: { organizationId: orgId, id: { in: periodIds } },
            select: { id: true, label: true },
          })
        : Promise.resolve([]),
      prisma.reportingPeriod.findMany({
        where: { organizationId: orgId },
        select: { id: true, label: true },
        orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      }),
    ]);
  } catch (periodErr) {
    const msg = periodErr instanceof Error ? periodErr.message : String(periodErr);
    console.error("[imports] periods query failed:", msg);
    return (
      <div className="p-8">
        <p className="text-sm font-medium text-red-700">Failed to load periods (db error)</p>
        <pre className="mt-2 text-xs text-red-600 whitespace-pre-wrap break-all max-w-2xl">{msg}</pre>
      </div>
    );
  }
  const periodLabelById = new Map(periods.map((period) => [period.id, period.label]));

  const stats = {
    total: imports.length,
    committed: imports.filter((b) => b.state === "committed").length,
    attention: imports.filter((b) => b.state === "needs_attention" || b.state === "failed").length,
  };

  return (
    <div className="min-h-[100dvh] bg-[#f9fafb]">
      {/* Page header */}
      <div className="bg-white border-b border-[#E5E7EB]">
        <div className="max-w-[1200px] mx-auto px-8 py-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F0F9FF]">
                  <Upload className="h-4 w-4 text-[#111827]" />
                </div>
                <span className="text-xs font-medium tracking-wide text-[#111827] uppercase">
                  Data intake
                </span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-[#111827]">
                Imports
              </h1>
              <p className="mt-1 text-sm text-[#9CA3AF] max-w-[65ch]">
                Upload, validate, and commit activity data. CSV and XLSX templates accepted up to 50 MB.
              </p>
            </div>
          </div>

          {imports.length > 0 && (
            <div className="flex flex-wrap gap-3 mt-6">
              <StatPill label="Total batches" value={stats.total} />
              <StatPill label="Committed" value={stats.committed} accent="green" />
              {stats.attention > 0 && (
                <StatPill label="Need attention" value={stats.attention} accent="amber" />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1200px] mx-auto px-8 py-8 flex flex-col gap-6">
        {/* Upload card */}
        <Card className="border-[#E5E7EB] shadow-none">
          <CardHeader className="px-6 py-4 border-b border-[#E5E7EB]">
            <CardTitle className="text-sm font-semibold text-[#111827]">Upload a file</CardTitle>
            <CardDescription className="text-xs text-[#9CA3AF] mt-0.5">
              Select a reporting period and template, then drop or browse for your data file.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 py-5">
            <CreateImportForm orgId={orgId} periods={allPeriods} />
          </CardContent>
        </Card>

        {/* Batches table */}
        {imports.length === 0 ? (
          <EmptyState />
        ) : (
          <Card className="border-[#E5E7EB] shadow-none">
            <CardHeader className="px-6 py-4 border-b border-[#E5E7EB]">
              <CardTitle className="text-sm font-semibold text-[#111827]">
                Import batches
                <span className="ml-2 text-xs font-normal text-[#9CA3AF]">({imports.length})</span>
              </CardTitle>
              <CardDescription className="text-xs text-[#9CA3AF] mt-0.5">
                Source files and validation exports stored using organisation-scoped keys.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#f9fafb] border-b border-[#E5E7EB]">
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3 pl-6">File</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3">Template</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3">Period</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3">Rows</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3">Issues</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3">Evidence</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3">Uploaded by</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3">Status</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3 pr-6">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {imports.map((batch) => {
                      const cfg = STATE_CONFIG[batch.state] ?? { label: batch.state, className: "border-zinc-200" };
                      const inlineErrors = batch.stagedRecords
                        .flatMap((record) =>
                          Array.isArray(record.validationErrors)
                            ? (record.validationErrors as string[]).slice(0, 1).map((msg) => ({
                                row: record.rowNumber,
                                msg,
                              }))
                            : [],
                        )
                        .slice(0, 2);

                      return (
                        <TableRow key={batch.id} className="border-b border-[#f3f4f6] hover:bg-[#f9fafb] transition-colors">
                          <TableCell className="py-3.5 pl-6">
                            <span className="text-sm font-medium text-[#111827]">{batch.sourceFilename}</span>
                          </TableCell>
                          <TableCell className="text-sm text-[#9CA3AF] py-3.5">{batch.templateKey}</TableCell>
                          <TableCell className="text-sm text-[#374151] py-3.5">
                            {periodLabelById.get(batch.reportingPeriodId) ?? batch.reportingPeriodId}
                          </TableCell>
                          <TableCell className="text-sm text-[#9CA3AF] py-3.5 tabular-nums">
                            {(batch.rowCount ?? batch._count.stagedRecords).toLocaleString("en-GB")}
                          </TableCell>
                          <TableCell className="py-3.5">
                            <div className="text-sm text-[#9CA3AF]">
                              {batch.errorCount > 0 && (
                                <span className="text-red-600">{batch.errorCount} error{batch.errorCount !== 1 ? "s" : ""}</span>
                              )}
                              {batch.errorCount > 0 && batch.warningCount > 0 && <span className="text-zinc-300 mx-1">·</span>}
                              {batch.warningCount > 0 && (
                                <span className="text-amber-600">{batch.warningCount} warning{batch.warningCount !== 1 ? "s" : ""}</span>
                              )}
                              {batch.errorCount === 0 && batch.warningCount === 0 && (
                                <span className="text-[#9CA3AF]">None</span>
                              )}
                            </div>
                            {inlineErrors.length > 0 && (
                              <ul className="mt-1.5 space-y-0.5">
                                {inlineErrors.map((err, i) => (
                                  <li key={i} className="text-xs text-[#9CA3AF]">
                                    <span className="font-medium text-[#374151]">Row {err.row}:</span>{" "}
                                    {err.msg}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </TableCell>
                          <TableCell className="py-3.5">
                            <ImportBatchEvidenceActions
                              orgId={orgId}
                              importId={batch.id}
                              files={batch.evidence.map((item) => ({
                                id: item.evidenceFile.id,
                                filename: item.evidenceFile.filename,
                              }))}
                            />
                          </TableCell>
                          <TableCell className="text-sm text-[#9CA3AF] py-3.5">
                            {batch.createdBy.name ?? batch.createdBy.email}
                          </TableCell>
                          <TableCell className="py-3.5">
                            <Badge
                              variant="outline"
                              className={`text-xs font-medium ${cfg.className}`}
                            >
                              {cfg.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-3.5 pr-6">
                            <div className="flex items-center gap-1">
                              <ImportBatchActions
                                orgId={orgId}
                                importId={batch.id}
                                canCommit={batch.state === "ready_to_commit"}
                                hasErrorExport={Boolean(batch.errorCsvStorageKey)}
                              />
                              {isAdminOrEditor && batch.state !== "committed" && (
                                <DeleteImportButton orgId={orgId} importId={batch.id} />
                              )}
                            </div>
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
}: {
  label: string;
  value: number;
  accent?: "green" | "amber" | "red";
}) {
  const colors = {
    green: "bg-[#F0F9FF] text-[#111827]",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
  };
  const base = accent ? colors[accent] : "bg-white text-[#374151] border border-[#E5E7EB]";
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${base}`}>
      <span className="tabular-nums font-semibold">{value}</span>
      <span>{label}</span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F0F9FF] mb-5">
        <Upload className="h-7 w-7 text-[#111827]" />
      </div>
      <h3 className="text-base font-semibold text-[#111827] mb-2">No import batches yet</h3>
      <p className="text-sm text-[#9CA3AF] max-w-sm">
        Upload a CSV or Excel file above to begin importing activity data for validation and review.
      </p>
    </div>
  );
}
