"use client";

import React, { useState, useCallback } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

interface Submission {
  id: string;
  documentType: string;
  status: string;
  createdAt: string;
  submittedBy: { name: string | null; email: string };
  reportingPeriod: { label: string };
  facility: { name: string } | null;
}

interface OrgMember {
  id: string;
  name: string | null;
  email: string;
}

interface SubmissionsTableProps {
  orgId: string;
  members: OrgMember[];
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
  pending: "border-[#e5e7eb] bg-[#e1f4df] text-[#0f3e17]",
  submitted: "border-[#b6ced5] bg-[#b6ced5]/30 text-[#0f3e17]",
  under_review: "border-[#b6ced5] bg-[#b6ced5]/50 text-[#0f3e17]",
  approved: "border-[#b1dbb8] bg-[#cfe7d3] text-[#0f3e17]",
  rejected: "border-[#e5e7eb] bg-[#e5e7eb] text-[#333333]",
  needs_info: "border-[#b6ced5] bg-[#b6ced5]/20 text-[#0f3e17]",
};

const DOC_TYPE_LABELS: Record<string, string> = {
  waste_ticket: "Waste ticket",
  delivery_note: "Delivery note",
  fuel_receipt: "Fuel receipt",
  other: "Other",
};

const BULK_ELIGIBLE = new Set(["submitted", "under_review"]);

export function SubmissionsTable({ orgId, members }: SubmissionsTableProps) {
  const [submissions, setSubmissions] = useState<Submission[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [approving, setApproving] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [showAssignSelect, setShowAssignSelect] = useState(false);
  const [assigneeUserId, setAssigneeUserId] = useState(members[0]?.id ?? "");

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/field-submissions`);
      if (!res.ok) throw new Error("Failed to load submissions");
      const json = await res.json() as { data: Submission[] };
      setSubmissions(json.data);
      setSelected(new Set());
    } catch {
      setError("Could not load submissions. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  // Fetch on mount
  if (submissions === null && !loading && !error) {
    fetchSubmissions();
  }

  const eligible = (submissions ?? []).filter((s) => BULK_ELIGIBLE.has(s.status));
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

  async function handleBulkApprove() {
    if (selected.size === 0) return;
    setApproving(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/field-submissions/bulk-review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected), action: "approve" }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(json.message ?? "Bulk approve failed");
      }
      await fetchSubmissions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk approve failed");
    } finally {
      setApproving(false);
    }
  }

  async function handleBulkAssign() {
    if (selected.size === 0 || !assigneeUserId) return;
    setAssigning(true);
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
      await fetchSubmissions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk assign failed");
    } finally {
      setAssigning(false);
    }
  }

  const list = submissions ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">
              Submissions
              {submissions !== null && (
                <span className="ml-2 text-sm font-normal text-[#333333]">
                  ({list.length})
                </span>
              )}
            </CardTitle>
            {submissions !== null && list.length === 0 && (
              <CardDescription className="mt-1">
                Share an invite link with your field workers to get started.
              </CardDescription>
            )}
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
                    className="h-8 rounded-md border border-[#e5e7eb] bg-[#fffefc] px-2 text-sm"
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

      <CardContent className={list.length === 0 ? "pb-8" : "p-0 pb-2"}>
        {error && (
          <p className="px-4 py-3 text-sm text-red-600 tracking-[-0.42px]">{error}</p>
        )}

        {loading && (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-[#333333] tracking-[-0.42px]">Loading…</p>
          </div>
        )}

        {!loading && submissions !== null && list.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#e1f4df]">
              <Inbox aria-hidden="true" className="h-7 w-7 text-[#0f3e17]" />
            </div>
            <div>
              <p className="font-normal text-[#0f3e17] tracking-[-0.42px]">
                No field submissions yet
              </p>
              <p className="text-sm text-[#222222] tracking-[-0.42px] mt-[7px] max-w-sm">
                Share an invite link with your field workers to get started.
                Field workers photograph waste tickets, delivery notes, and fuel
                receipts directly from the mobile app.
              </p>
            </div>
          </div>
        )}

        {!loading && list.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  {eligible.length > 0 && (
                    <Checkbox
                      checked={allEligibleSelected}
                      onCheckedChange={toggleAll}
                      aria-label="Select all eligible submissions"
                    />
                  )}
                </TableHead>
                <TableHead>Document type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted by</TableHead>
                <TableHead>Reporting period</TableHead>
                <TableHead>Facility</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((s) => {
                const isEligible = BULK_ELIGIBLE.has(s.status);
                const isChecked = selected.has(s.id);
                return (
                  <TableRow
                    key={s.id}
                    data-state={isChecked ? "selected" : undefined}
                  >
                    <TableCell className="w-10">
                      {isEligible && (
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleOne(s.id)}
                          aria-label={`Select submission ${s.id}`}
                          onClick={(e: React.MouseEvent<HTMLInputElement>) => e.stopPropagation()}
                        />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link
                        href={`/orgs/${orgId}/submissions/${s.id}`}
                        className="hover:underline underline-offset-2 text-[#0f3e17]"
                      >
                        {DOC_TYPE_LABELS[s.documentType] ?? s.documentType}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-[14px] py-[7px] text-xs font-normal tracking-[-0.36px]",
                          STATUS_CLASSES[s.status] ??
                            "border-[#e5e7eb] bg-[#e1f4df] text-[#333333]",
                        )}
                      >
                        {STATUS_LABELS[s.status] ?? s.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-[#222222]">
                      {s.submittedBy.name ?? s.submittedBy.email}
                    </TableCell>
                    <TableCell className="text-[#222222]">
                      {s.reportingPeriod.label}
                    </TableCell>
                    <TableCell className="text-[#222222]">
                      {s.facility?.name ?? (
                        <span className="text-[#333333] italic">None</span>
                      )}
                    </TableCell>
                    <TableCell className="text-[#333333] text-sm tracking-[-0.36px]">
                      {new Date(s.createdAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
