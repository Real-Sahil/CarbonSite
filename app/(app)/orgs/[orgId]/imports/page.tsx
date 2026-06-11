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

export default async function ImportsPage({ params }: ImportsPageProps) {
  const { orgId } = await params;

  try {
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/sign-in");
      return <AccessDenied label="imports" />;
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
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Imports</h1>
        <p className="text-slate-500 mt-1">
          Upload, validate, stage, and commit activity data batches.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Import batches <span className="text-sm font-normal text-slate-500">({imports.length})</span>
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
            <EmptyState
              icon={Upload}
              title="No import batches yet"
              description="Create an import batch to upload CSV or XLSX activity data for validation."
            />
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
                {imports.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell className="font-medium">{batch.sourceFilename}</TableCell>
                    <TableCell className="text-slate-600">{batch.templateKey}</TableCell>
                    <TableCell className="text-slate-600">
                      {periodLabelById.get(batch.reportingPeriodId) ?? batch.reportingPeriodId}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {(batch.rowCount ?? batch._count.stagedRecords).toLocaleString("en-GB")}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      <div>
                        {batch.errorCount} errors, {batch.warningCount} warnings
                      </div>
                      {batch.errorCsvStorageKey && (
                        <div className="text-xs text-slate-500">
                          Error export ready
                        </div>
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
                    <TableCell className="text-slate-600">
                      {batch.createdBy.name ?? batch.createdBy.email}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          batch.state === "failed" || batch.state === "needs_attention"
                            ? "destructive"
                            : batch.state === "committed"
                              ? "default"
                              : "outline"
                        }
                      >
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
