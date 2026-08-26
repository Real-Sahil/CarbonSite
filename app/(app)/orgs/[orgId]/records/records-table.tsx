"use client";

import * as React from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { RecordActions } from "./record-actions";
import { RecordEvidenceActions } from "./record-evidence-actions";

const REVIEW_LABELS: Record<string, string> = {
  draft: "Draft",
  in_review: "In review",
  approved: "Approved",
  rejected: "Rejected",
};

interface RecordRow {
  id: string;
  sourceDescription: string | null;
  supplierName: string | null;
  amount: number | string;
  unit: string;
  distanceAmount: number | string | null;
  distanceUnit: string | null;
  country: string | null;
  reviewStatus: string;
  evidenceStatus: string;
  emissionCategory: { scope: number | string; name: string };
  reportingPeriod: { label: string };
  facility: { name: string } | null;
  businessUnit: { name: string } | null;
  evidence: { evidenceFile: { id: string; filename: string } }[];
  _count: { calculations: number };
}

interface RecordsTableProps {
  orgId: string;
  canManageRecords: boolean;
}

export function RecordsTable({ orgId, canManageRecords }: RecordsTableProps) {
  const [data, setData] = React.useState<RecordRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [cursors, setCursors] = React.useState<(string | null)[]>([null]);
  const [currentPage, setCurrentPage] = React.useState(0);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [total, setTotal] = React.useState<number | undefined>(undefined);

  const fetchPage = React.useCallback(
    async (cursor: string | null) => {
      try {
        const params = new URLSearchParams();
        if (cursor) params.set("cursor", cursor);
        const res = await fetch(`/api/orgs/${orgId}/activity-records?${params}`);
        if (!res.ok) throw new Error("fetch failed");
        const json = await res.json();
        setData(json.data);
        setNextCursor(json.nextCursor ?? null);
        if (json.total != null) setTotal(json.total);
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

  const columns: ColumnDef<RecordRow>[] = [
    {
      id: "source",
      header: "Source",
      cell: ({ row }) => (
        <Link
          href={`/orgs/${orgId}/records/${row.original.id}`}
          className="font-medium text-sm text-[#111827] hover:underline underline-offset-2"
        >
          {row.original.sourceDescription ?? row.original.supplierName ?? "Activity record"}
        </Link>
      ),
    },
    {
      id: "category",
      header: "Category",
      cell: ({ row }) => (
        <div>
          <div className="text-sm font-medium text-[#111827]">
            Scope {row.original.emissionCategory.scope}
          </div>
          <div className="text-xs text-[#9CA3AF]">{row.original.emissionCategory.name}</div>
        </div>
      ),
    },
    {
      id: "amount",
      header: "Amount",
      cell: ({ row }) => (
        <span className="text-sm text-[#374151] tabular-nums">
          {Number(row.original.amount).toLocaleString("en-GB")} {row.original.unit}
        </span>
      ),
    },
    {
      id: "period",
      header: "Period",
      cell: ({ row }) => (
        <span className="text-sm text-[#374151]">{row.original.reportingPeriod.label}</span>
      ),
    },
    {
      id: "location",
      header: "Location",
      cell: ({ row }) => (
        <span className="text-sm text-[#374151]">
          {row.original.facility?.name ??
            row.original.businessUnit?.name ??
            row.original.country ??
            "Not assigned"}
        </span>
      ),
    },
    {
      id: "distance",
      header: "Distance",
      cell: ({ row }) =>
        row.original.distanceAmount ? (
          <span className="text-sm text-[#374151] tabular-nums">
            {Number(row.original.distanceAmount).toLocaleString("en-GB", {
              maximumFractionDigits: 2,
            })}{" "}
            {row.original.distanceUnit ?? "km"}
          </span>
        ) : (
          <span className="text-sm text-[#9CA3AF]">Not set</span>
        ),
    },
    {
      id: "evidence",
      header: "Evidence",
      cell: ({ row }) => (
        <div>
          <RecordEvidenceActions
            orgId={orgId}
            recordId={row.original.id}
            files={row.original.evidence.map((item) => ({
              id: item.evidenceFile.id,
              filename: item.evidenceFile.filename,
            }))}
            canManage={canManageRecords}
          />
          <div className="text-xs text-[#9CA3AF]">
            {row.original.evidenceStatus.replaceAll("_", " ")}
          </div>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.reviewStatus === "approved" ? "default" : "outline"}>
          {REVIEW_LABELS[row.original.reviewStatus] ?? row.original.reviewStatus}
        </Badge>
      ),
    },
    ...(canManageRecords
      ? [
          {
            id: "actions",
            header: "Actions",
            cell: ({ row }: { row: { original: RecordRow } }) => (
              <RecordActions
                orgId={orgId}
                recordId={row.original.id}
                label={
                  row.original.sourceDescription ??
                  row.original.supplierName ??
                  row.original.id
                }
                reviewStatus={row.original.reviewStatus}
                evidenceStatus={row.original.evidenceStatus}
                canDelete={row.original._count.calculations === 0}
              />
            ),
          } as ColumnDef<RecordRow>,
        ]
      : []),
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      onPreviousPage={goPrev}
      onNextPage={goNext}
      hasPreviousPage={currentPage > 0}
      hasNextPage={Boolean(nextCursor)}
      totalCount={total}
      pageRowCount={data.length}
      emptyMessage="No activity records yet."
      showColumnVisibility
    />
  );
}
