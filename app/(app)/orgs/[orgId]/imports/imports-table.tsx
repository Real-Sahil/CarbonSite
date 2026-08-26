"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { ImportBatchActions, ImportBatchEvidenceActions } from "./import-actions";
import { DeleteImportButton } from "./delete-import-button";

const STATE_CONFIG: Record<string, { label: string; className: string }> = {
  uploaded:        { label: "Uploaded",         className: "bg-zinc-100 text-[#374151] border-transparent" },
  parsing:         { label: "Parsing",           className: "bg-blue-50 text-blue-700 border-transparent animate-pulse" },
  needs_attention: { label: "Needs attention",   className: "bg-amber-50 text-amber-700 border-transparent" },
  ready_to_commit: { label: "Ready to commit",   className: "bg-[#F0F9FF] text-[#111827] border-transparent" },
  committed:       { label: "Committed",         className: "bg-[#f97316] text-white border-transparent" },
  failed:          { label: "Failed",            className: "bg-red-50 text-red-700 border-transparent" },
};

interface ImportBatchRow {
  id: string;
  sourceFilename: string;
  templateKey: string;
  reportingPeriodId: string;
  state: string;
  errorCount: number;
  warningCount: number;
  rowCount: number | null;
  errorCsvStorageKey: string | null;
  createdBy: { name: string | null; email: string } | null;
  evidence: { evidenceFile: { id: string; filename: string } }[];
  _count: { stagedRecords: number; activityRecords: number };
  stagedRecords: { validationErrors: unknown; rowNumber: number }[];
}

interface ImportsTableProps {
  orgId: string;
  isAdminOrEditor: boolean;
  periodLabelById: Record<string, string>;
}

export function ImportsTable({ orgId, isAdminOrEditor, periodLabelById }: ImportsTableProps) {
  const [data, setData] = React.useState<ImportBatchRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [cursors, setCursors] = React.useState<(string | null)[]>([null]);
  const [currentPage, setCurrentPage] = React.useState(0);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);

  const fetchPage = React.useCallback(
    async (cursor: string | null) => {
      try {
        const params = new URLSearchParams();
        if (cursor) params.set("cursor", cursor);
        const res = await fetch(`/api/orgs/${orgId}/imports?${params}`);
        if (!res.ok) throw new Error("fetch failed");
        const json = await res.json();
        setData(json.data);
        setNextCursor(json.nextCursor ?? null);
      } finally {
        setIsLoading(false);
      }
    },
    [orgId],
  );

  React.useEffect(() => {
    fetchPage(null);
  }, [fetchPage]);

  const goNext = () => {
    if (!nextCursor) return;
    const newCursors = [...cursors, nextCursor];
    setCursors(newCursors);
    setCurrentPage(newCursors.length - 1);
    setIsLoading(true);
    fetchPage(nextCursor);
  };

  const goPrev = () => {
    if (currentPage === 0) return;
    const newPage = currentPage - 1;
    setCurrentPage(newPage);
    setIsLoading(true);
    fetchPage(cursors[newPage]);
  };

  const columns: ColumnDef<ImportBatchRow>[] = [
    {
      id: "file",
      header: "File",
      cell: ({ row }) => (
        <span className="text-sm font-medium text-[#111827]">{row.original.sourceFilename}</span>
      ),
    },
    {
      id: "template",
      header: "Template",
      cell: ({ row }) => (
        <span className="text-sm text-[#9CA3AF]">{row.original.templateKey}</span>
      ),
    },
    {
      id: "period",
      header: "Period",
      cell: ({ row }) => (
        <span className="text-sm text-[#374151]">
          {periodLabelById[row.original.reportingPeriodId] ?? row.original.reportingPeriodId}
        </span>
      ),
    },
    {
      id: "rows",
      header: "Rows",
      cell: ({ row }) => (
        <span className="text-sm text-[#9CA3AF] tabular-nums">
          {(row.original.rowCount ?? row.original._count.stagedRecords).toLocaleString("en-GB")}
        </span>
      ),
    },
    {
      id: "issues",
      header: "Issues",
      cell: ({ row }) => {
        const batch = row.original;
        const inlineErrors = batch.stagedRecords
          .flatMap((record) =>
            Array.isArray(record.validationErrors)
              ? (record.validationErrors as Array<unknown>).slice(0, 1).map((e) => ({
                  row: record.rowNumber,
                  msg:
                    typeof e === "string"
                      ? e
                      : (e as { message?: string })?.message ?? JSON.stringify(e),
                }))
              : [],
          )
          .slice(0, 2);

        return (
          <div>
            <div className="text-sm text-[#9CA3AF]">
              {batch.errorCount > 0 && (
                <span className="text-red-600">
                  {batch.errorCount} error{batch.errorCount !== 1 ? "s" : ""}
                </span>
              )}
              {batch.errorCount > 0 && batch.warningCount > 0 && (
                <span className="text-zinc-300 mx-1">·</span>
              )}
              {batch.warningCount > 0 && (
                <span className="text-amber-600">
                  {batch.warningCount} warning{batch.warningCount !== 1 ? "s" : ""}
                </span>
              )}
              {batch.errorCount === 0 && batch.warningCount === 0 && (
                <span className="text-[#9CA3AF]">None</span>
              )}
            </div>
            {inlineErrors.length > 0 && (
              <ul className="mt-1.5 space-y-0.5">
                {inlineErrors.map((err, i) => (
                  <li key={i} className="text-xs text-[#9CA3AF]">
                    <span className="font-medium text-[#374151]">Row {err.row}:</span> {err.msg}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      },
    },
    {
      id: "evidence",
      header: "Evidence",
      cell: ({ row }) => (
        <ImportBatchEvidenceActions
          orgId={orgId}
          importId={row.original.id}
          files={row.original.evidence.map((item) => ({
            id: item.evidenceFile.id,
            filename: item.evidenceFile.filename,
          }))}
        />
      ),
    },
    {
      id: "uploadedBy",
      header: "Uploaded by",
      cell: ({ row }) => (
        <span className="text-sm text-[#9CA3AF]">
          {row.original.createdBy
            ? (row.original.createdBy.name ?? row.original.createdBy.email)
            : "System"}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => {
        const cfg = STATE_CONFIG[row.original.state] ?? {
          label: row.original.state,
          className: "border-zinc-200",
        };
        return (
          <Badge variant="outline" className={`text-xs font-medium ${cfg.className}`}>
            {cfg.label}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <ImportBatchActions
            orgId={orgId}
            importId={row.original.id}
            canCommit={row.original.state === "ready_to_commit"}
            hasErrorExport={Boolean(row.original.errorCsvStorageKey)}
          />
          {isAdminOrEditor && row.original.state !== "committed" && (
            <DeleteImportButton orgId={orgId} importId={row.original.id} />
          )}
        </div>
      ),
    },
  ];

  if (isLoading && data.length === 0) {
    return (
      <DataTable
        columns={columns}
        data={[]}
        isLoading
        emptyMessage="No import batches yet."
      />
    );
  }

  if (!isLoading && data.length === 0 && currentPage === 0) {
    return null;
  }

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      onPreviousPage={goPrev}
      onNextPage={goNext}
      hasPreviousPage={currentPage > 0}
      hasNextPage={Boolean(nextCursor)}
      pageRowCount={data.length}
      emptyMessage="No import batches yet."
    />
  );
}
