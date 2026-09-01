"use client";

import React, { useState, useTransition, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Inbox, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Submission {
  id: string;
  documentType: string;
  status: string;
  createdAt: string;
  submittedBy: { name: string | null; email: string };
  reportingPeriod: { label: string };
  facility: { name: string } | null;
  emissionCategoryId: string | null;
}

interface OrgMember {
  id: string;
  name: string | null;
  email: string;
}

interface SubmissionsTableProps {
  orgId: string;
  members: OrgMember[];
  initialSubmissions: Submission[];
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  submitted: "Submitted",
  under_review: "Under review",
  approved: "Approved",
  rejected: "Rejected",
  needs_info: "Needs info",
};

const STATUS_CLASSES: Record<string, string> = {
  pending: "border-[#E5E7EB] bg-[#F0F9FF] text-[#111827]",
  submitted: "border-[#BAE6FD] bg-[#F0F9FF]/30 text-[#111827]",
  under_review: "border-[#BAE6FD] bg-[#F0F9FF]/50 text-[#111827]",
  approved: "border-[#BAE6FD] bg-[#cfe7d3] text-[#111827]",
  rejected: "border-[#E5E7EB] bg-[#e5e7eb] text-[#374151]",
  needs_info: "border-[#BAE6FD] bg-[#F0F9FF]/20 text-[#111827]",
};

const DOC_TYPE_LABELS: Record<string, string> = {
  waste_ticket: "Waste ticket",
  delivery_note: "Delivery note",
  fuel_receipt: "Fuel receipt",
  other: "Other",
};

const BULK_ELIGIBLE = new Set(["submitted", "under_review"]);

export function SubmissionsTable({ orgId, members, initialSubmissions }: SubmissionsTableProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Submission[]>(initialSubmissions);
  const [isLoading, setIsLoading] = useState(false);
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [currentPage, setCurrentPage] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [approving, startApproving] = useTransition();
  const [assigning, startAssigning] = useTransition();
  const [showAssignSelect, setShowAssignSelect] = useState(false);
  const [assigneeUserId, setAssigneeUserId] = useState(members[0]?.id ?? "");

  const fetchPage = useCallback(
    async (cursor: string | null) => {
      try {
        const params = new URLSearchParams();
        if (cursor) params.set("cursor", cursor);
        const res = await fetch(`/api/orgs/${orgId}/field-submissions?${params}`);
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

  useEffect(() => {
    if (initialSubmissions.length > 0) {
      setData(initialSubmissions);
      setNextCursor(null);
    }
  }, [initialSubmissions]);

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

  const eligible = data.filter((s) => BULK_ELIGIBLE.has(s.status));
  const allEligibleSelected =
    eligible.length > 0 && eligible.every((s) => selected.has(s.id));

  function toggleAll() {
    if (allEligibleSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(eligible.map((s) => s.id)));
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleBulkApprove() {
    if (selected.size === 0) return;
    const confirmed = window.confirm(
      `Bulk approve ${selected.size} submission(s)?\n\n` +
      "Approval creates a committed activity record for each submission. " +
      "Submissions without an emission category (or without a valid amount) " +
      "are skipped — open those individually to assign a category first."
    );
    if (!confirmed) return;
    startApproving(async () => {
      try {
        const res = await fetch(`/api/orgs/${orgId}/field-submissions/bulk-review`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: Array.from(selected), action: "approve" }),
        });
        const json = await res.json().catch(() => ({})) as {
          message?: string;
          updated?: number;
          skipped?: { id: string; reason: string }[];
        };
        if (!res.ok) {
          throw new Error(json.message ?? "Bulk approve failed");
        }
        if (json.skipped && json.skipped.length > 0) {
          setError(
            `Approved ${json.updated ?? 0}; skipped ${json.skipped.length} — ` +
            "assign emission categories to the remaining submissions and retry.",
          );
        }
        setSelected(new Set());
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Bulk approve failed");
      }
    });
  }

  function handleBulkAssign() {
    if (selected.size === 0 || !assigneeUserId) return;
    startAssigning(async () => {
      try {
        const res = await fetch(`/api/orgs/${orgId}/field-submissions/bulk-review`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: Array.from(selected), action: "assign", assigneeUserId }),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({})) as { message?: string };
          throw new Error(json.message ?? "Bulk assign failed");
        }
        setShowAssignSelect(false);
        setSelected(new Set());
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Bulk assign failed");
      }
    });
  }

  const columns: ColumnDef<Submission>[] = [
    {
      id: "checkbox",
      header: ({ table: _table }) => (
        <>
          {eligible.length > 0 && (
            <Checkbox
              checked={allEligibleSelected}
              onCheckedChange={toggleAll}
              aria-label="Select all eligible submissions"
            />
          )}
        </>
      ),
      cell: ({ row }) => {
        const isEligible = BULK_ELIGIBLE.has(row.original.status);
        return (
          <>
            {isEligible && (
              <Checkbox
                checked={selected.has(row.original.id)}
                onCheckedChange={() => toggleOne(row.original.id)}
                aria-label={`Select submission ${row.original.id}`}
                onClick={(e: React.MouseEvent<HTMLInputElement>) => e.stopPropagation()}
              />
            )}
          </>
        );
      },
    },
    {
      id: "documentType",
      header: "Document type",
      cell: ({ row }) => (
        <Link
          href={`/orgs/${orgId}/submissions/${row.original.id}`}
          className="hover:underline underline-offset-2 text-[#111827]"
        >
          {DOC_TYPE_LABELS[row.original.documentType] ?? row.original.documentType}
        </Link>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-[14px] py-[7px] text-xs font-normal tracking-[-0.36px]",
            STATUS_CLASSES[row.original.status] ??
              "border-[#E5E7EB] bg-[#F0F9FF] text-[#374151]",
          )}
        >
          {STATUS_LABELS[row.original.status] ?? row.original.status}
        </span>
      ),
    },
    {
      id: "setup",
      header: "Setup",
      cell: ({ row }) => {
        if (!row.original.emissionCategoryId &&
          (row.original.status === "submitted" || row.original.status === "under_review" || row.original.status === "needs_info")) {
          return (
            <Link
              href={`/orgs/${orgId}/submissions/${row.original.id}`}
              className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 hover:bg-amber-100 transition-colors"
              title="Assign an emission category before this can be approved"
            >
              <AlertCircle className="h-3 w-3 shrink-0" />
              Category needed
            </Link>
          );
        }
        return null;
      },
    },
    {
      id: "submittedBy",
      header: "Submitted by",
      cell: ({ row }) => (
        <span className="text-[#374151]">
          {row.original.submittedBy.name ?? row.original.submittedBy.email}
        </span>
      ),
    },
    {
      id: "reportingPeriod",
      header: "Reporting period",
      cell: ({ row }) => (
        <span className="text-[#374151]">
          {row.original.reportingPeriod.label}
        </span>
      ),
    },
    {
      id: "facility",
      header: "Facility",
      cell: ({ row }) => (
        <span className="text-[#374151]">
          {row.original.facility?.name ?? (
            <span className="text-[#374151] italic">None</span>
          )}
        </span>
      ),
    },
    {
      id: "date",
      header: "Date",
      cell: ({ row }) => (
        <span className="text-[#374151] text-sm tracking-[-0.36px]">
          {new Date(row.original.createdAt).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </span>
      ),
    },
  ];

  if (data.length === 0 && currentPage === 0) {
    return (
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="text-base">Submissions</CardTitle>
            <CardDescription className="mt-1">
              Share an invite link with your field workers to get started.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pb-8">
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#F0F9FF]">
              <Inbox aria-hidden="true" className="h-7 w-7 text-[#111827]" />
            </div>
            <div>
              <p className="font-normal text-[#111827] tracking-[-0.42px]">
                No field submissions yet
              </p>
              <p className="text-sm text-[#374151] tracking-[-0.42px] mt-[7px] max-w-sm">
                Share an invite link with your field workers to get started.
                Field workers photograph waste tickets, delivery notes, and fuel
                receipts directly from the mobile app.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">
              Submissions
              <span className="ml-2 text-sm font-normal text-[#374151]">
                ({data.length})
              </span>
            </CardTitle>
          </div>
          {selected.size > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                onClick={handleBulkApprove}
                disabled={approving || assigning}
                className="shrink-0"
              >
                {approving ? "Approving…" : `Bulk approve (${selected.size})`}
              </Button>
              {members.length > 0 && !showAssignSelect && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAssignSelect(true)}
                  disabled={approving || assigning}
                  className="shrink-0"
                >
                  Assign
                </Button>
              )}
              {members.length > 0 && showAssignSelect && (
                <div className="flex items-center gap-2">
                  <select
                    value={assigneeUserId}
                    onChange={(e) => setAssigneeUserId(e.target.value)}
                    className="h-8 rounded-md border border-[#E5E7EB] bg-white px-2 text-sm"
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name ?? m.email}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleBulkAssign}
                    disabled={assigning || !assigneeUserId}
                    className="shrink-0"
                  >
                    {assigning ? "Assigning…" : "Confirm"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowAssignSelect(false)}
                    className="shrink-0"
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {error && (
          <p className="px-4 py-3 text-sm text-red-600 tracking-[-0.42px]">{error}</p>
        )}
        <DataTable
          columns={columns}
          data={data}
          isLoading={isLoading}
          onPreviousPage={goPrev}
          onNextPage={goNext}
          hasPreviousPage={currentPage > 0}
          hasNextPage={Boolean(nextCursor)}
          pageRowCount={data.length}
          emptyMessage="No field submissions yet."
        />
      </CardContent>
    </Card>
  );
}
