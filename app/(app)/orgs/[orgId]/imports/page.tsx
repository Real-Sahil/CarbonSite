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

interface ImportsPageProps {
  params: Promise<{ orgId: string }>;
}

const STATE_LABELS: Record<string, string> = {
  uploaded: "Uploaded",
  parsing: "Parsing",
  mapped: "Mapped",
  validating: "Validating",
  needs_attention: "Needs attention",
  ready_to_commit: "Ready to commit",
  committed: "Committed",
  failed: "Failed",
};

const STATE_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  committed: "default",
  ready_to_commit: "secondary",
  needs_attention: "destructive",
  failed: "destructive",
};

export default async function ImportsPage({ params }: ImportsPageProps) {
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

  const imports = await prisma.importBatch.findMany({
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
    take: 100,
  });

  const periodIds = [...new Set(imports.map((batch) => batch.reportingPeriodId))];
  const [periods, allPeriods] = await Promise.all([
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
  const periodLabelById = new Map(periods.map((period) => [period.id, period.label]));

  return (
    <div className="p-[42px] max-w-[1200px] mx-auto">
      <div className="mb-[42px]">
        <p className="text-xs font-normal tracking-[-0.36px] text-[#0f3e17] bg-[#b6ced5] rounded-full px-[14px] py-[7px] inline-flex mb-[14px]">
          Data intake
        </p>
        <h1
          className="text-[40px] leading-[1.35] tracking-[-0.4px] text-[#0f3e17]"
          style={{ fontFamily: "var(--font-fraunces, Fraunces, Georgia, serif)", fontWeight: 300 }}
        >
          Imports
        </h1>
        <p className="text-sm text-[#222222] font-normal tracking-[-0.42px] mt-[7px]">
          Upload, validate, stage, and commit activity data batches.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Import batches{" "}
            <span className="text-sm font-normal text-[#333333]">({imports.length})</span>
          </CardTitle>
          <CardDescription>
            Source files and validation exports are stored using organisation-scoped storage keys.
          </CardDescription>
        </CardHeader>
        <CardContent className={imports.length === 0 ? "pb-8" : "p-0 pb-2"}>
          <div className="px-6 pb-5">
            <CreateImportForm orgId={orgId} periods={allPeriods} />
          </div>
          {imports.length === 0 ? (
            <EmptyState />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Rows</TableHead>
                  <TableHead>Issues</TableHead>
                  <TableHead>Evidence</TableHead>
                  <TableHead>Created by</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {imports.map((batch) => {
                  const inlineErrors = batch.stagedRecords
                    .flatMap((record) =>
                      Array.isArray(record.validationErrors)
                        ? (record.validationErrors as string[]).slice(0, 1).map((msg) => ({
                            row: record.rowNumber,
                            msg,
                          }))
                        : [],
                    )
                    .slice(0, 3);

                  return (
                    <TableRow key={batch.id}>
                      <TableCell className="font-normal text-[#000000]">
                        {batch.sourceFilename}
                      </TableCell>
                      <TableCell className="text-[#222222]">{batch.templateKey}</TableCell>
                      <TableCell className="text-[#222222]">
                        {periodLabelById.get(batch.reportingPeriodId) ?? batch.reportingPeriodId}
                      </TableCell>
                      <TableCell className="text-[#222222]">
                        {(batch.rowCount ?? batch._count.stagedRecords).toLocaleString("en-GB")}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-[#222222] tracking-[-0.42px]">
                          {batch.errorCount} errors, {batch.warningCount} warnings
                        </div>
                        {inlineErrors.length > 0 && (
                          <ul className="mt-1.5 space-y-1">
                            {inlineErrors.map((err, i) => (
                              <li key={i} className="text-xs text-[#333333] tracking-[-0.36px]">
                                <span className="font-normal text-[#0f3e17]">Row {err.row}:</span>{" "}
                                {err.msg}
                              </li>
                            ))}
                            {batch.errorCount > inlineErrors.length && (
                              <li className="text-xs text-[#333333] tracking-[-0.36px] italic">
                                +{batch.errorCount - inlineErrors.length} more — download error export
                              </li>
                            )}
                          </ul>
                        )}
                        {!inlineErrors.length && batch.errorCsvStorageKey && (
                          <p className="mt-1 text-xs text-[#333333] tracking-[-0.36px]">
                            Error export ready
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <ImportBatchEvidenceActions
                          orgId={orgId}
                          importId={batch.id}
                          files={batch.evidence.map((item) => ({
                            id: item.evidenceFile.id,
                            filename: item.evidenceFile.filename,
                          }))}
                        />
                      </TableCell>
                      <TableCell className="text-[#222222]">
                        {batch.createdBy.name ?? batch.createdBy.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATE_VARIANT[batch.state] ?? "outline"}>
                          {STATE_LABELS[batch.state] ?? batch.state}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <ImportBatchActions
                          orgId={orgId}
                          importId={batch.id}
                          canCommit={batch.state === "ready_to_commit"}
                          hasErrorExport={Boolean(batch.errorCsvStorageKey)}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
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
      <p className="text-sm text-[#222222] tracking-[-0.42px]">
        You do not have permission to view imports.
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#e1f4df]">
        <Upload className="h-7 w-7 text-[#0f3e17]" />
      </div>
      <div>
        <p className="font-normal text-[#0f3e17] tracking-[-0.42px]">No import batches yet</p>
        <p className="text-sm text-[#222222] tracking-[-0.42px] mt-[7px] max-w-sm">
          Create an import batch to upload CSV or XLSX activity data for validation.
        </p>
      </div>
    </div>
  );
}
