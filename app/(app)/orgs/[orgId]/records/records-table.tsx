"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ColumnDef, type RowSelectionState } from "@tanstack/react-table";
import { CheckCircle2, XCircle, X } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RecordActions } from "./record-actions";
import { RecordEvidenceActions } from "./record-evidence-actions";
import { cn } from "@/lib/utils";

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

// Checkbox that renders the native indeterminate state for "select all" headers.
function SelectAllCheckbox({
  allSelected,
  someSelected,
  onToggle,
}: {
  allSelected: boolean;
  someSelected: boolean;
  onToggle: (v: boolean) => void;
}) {
  const ref = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (ref.current) ref.current.indeterminate = !allSelected && someSelected;
  }, [allSelected, someSelected]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={allSelected}
      onChange={(e) => onToggle(e.target.checked)}
      aria-label="Select all"
      className="h-4 w-4 rounded border border-[#E5E7EB] accent-[#f97316] cursor-pointer"
    />
  );
}

// Sticky action bar that slides in from the bottom when rows are selected.
function BulkActionBar({
  orgId,
  selectedIds,
  onDone,
  onClear,
}: {
  orgId: string;
  selectedIds: string[];
  onDone: () => void;
  onClear: () => void;
}) {
  const [loading, setLoading] = React.useState<"approved" | "rejected" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function bulkReview(status: "approved" | "rejected") {
    setLoading(status);
    setError(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/activity-records/bulk-review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewStatus: status, ids: selectedIds }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? "Request failed.");
      } else {
        onDone();
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 shadow-lg ring-1 ring-black/5">
        <span className="text-sm font-medium text-[#111827] tabular-nums">
          {selectedIds.length} selected
        </span>
        <div className="h-4 w-px bg-[#E5E7EB]" />
        <Button
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={() => bulkReview("approved")}
          disabled={loading !== null}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          {loading === "approved" ? "Approving…" : "Approve"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1.5 text-xs"
          onClick={() => bulkReview("rejected")}
          disabled={loading !== null}
        >
          <XCircle className="h-3.5 w-3.5" />
          {loading === "rejected" ? "Rejecting…" : "Reject"}
        </Button>
        <button
          type="button"
          onClick={onClear}
          className="ml-1 rounded p-0.5 text-[#9CA3AF] hover:text-[#374151] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
          aria-label="Clear selection"
        >
          <X className="h-4 w-4" />
        </button>
        {error && (
          <span className="text-xs text-red-600">{error}</span>
        )}
      </div>
    </div>
  );
}

export function RecordsTable({ orgId, canManageRecords }: RecordsTableProps) {
  const router = useRouter();
  const [data, setData] = React.useState<RecordRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [cursors, setCursors] = React.useState<(string | null)[]>([null]);
  const [currentPage, setCurrentPage] = React.useState(0);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [total, setTotal] = React.useState<number | undefined>(undefined);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

  const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id]);

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
    setRowSelection({});
    fetchPage(nextCursor);
  };

  const goPrev = () => {
    if (currentPage === 0) return;
    const newPage = currentPage - 1;
    setCurrentPage(newPage);
    setIsLoading(true);
    setRowSelection({});
    fetchPage(cursors[newPage]);
  };

  function handleBulkDone() {
    setRowSelection({});
    router.refresh();
    fetchPage(cursors[currentPage]);
  }

  const columns: ColumnDef<RecordRow>[] = [
    ...(canManageRecords
      ? [
          {
            id: "select",
            header: ({ table }: { table: import("@tanstack/react-table").Table<RecordRow> }) => {
              const allSelected = table.getIsAllPageRowsSelected();
              const someSelected = table.getIsSomePageRowsSelected();
              return (
                <SelectAllCheckbox
                  allSelected={allSelected}
                  someSelected={someSelected}
                  onToggle={(v) => table.toggleAllPageRowsSelected(v)}
                />
              );
            },
            cell: ({ row }: { row: import("@tanstack/react-table").Row<RecordRow> }) => (
              <Checkbox
                checked={row.getIsSelected()}
                onCheckedChange={(value) => row.toggleSelected(!!value)}
                aria-label="Select row"
                onClick={(e) => e.stopPropagation()}
              />
            ),
            enableSorting: false,
            enableHiding: false,
            size: 40,
          } as ColumnDef<RecordRow>,
        ]
      : []),
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
        <Badge
          variant={row.original.reviewStatus === "approved" ? "default" : "outline"}
          className={cn(
            row.original.reviewStatus === "draft" && "border-amber-200 text-amber-700 bg-amber-50",
            row.original.reviewStatus === "rejected" && "border-red-200 text-red-700 bg-red-50",
          )}
        >
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
    <>
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
        rowSelection={rowSelection}
        onRowSelectionChange={canManageRecords ? setRowSelection : undefined}
        getRowId={(row) => row.id}
      />

      {canManageRecords && selectedIds.length > 0 && (
        <BulkActionBar
          orgId={orgId}
          selectedIds={selectedIds}
          onDone={handleBulkDone}
          onClear={() => setRowSelection({})}
        />
      )}
    </>
  );
}
