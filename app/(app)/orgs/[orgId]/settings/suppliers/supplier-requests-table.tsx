"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  CheckCircle2,
  CircleAlert,
  Clock,
  Eye,
  ArrowRight,
  MailOpen,
  Send,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type RequestStatus = "sent" | "opened" | "submitted" | "expired" | "flagged" | "approved" | "rejected";

interface SubmittedData {
  quantity: number;
  unit: string;
  description?: string | null;
}

interface QualityFlag {
  field: string;
  severity: "warning" | "critical" | "info";
  message: string;
  suggestedRange?: { min: number; max: number };
}

interface RequestRow {
  id: string;
  supplierEmail: string;
  supplierName: string | null;
  categoryCode: string;
  categoryName: string;
  status: RequestStatus;
  sentAt: string;
  openedAt: string | null;
  submittedAt: string | null;
  expiresAt: string;
  expired: boolean;
  notes: string | null;
  submittedData: SubmittedData | null;
  qualityFlags: QualityFlag[] | null;
  rejectionReason: string | null;
  reviewedAt: string | null;
  periodId: string;
  periodLabel: string;
  sentBy: string;
}

interface Props {
  orgId: string;
  rows: RequestRow[];
  counts: Record<string, number>;
  periods: { id: string; label: string }[];
  currentStatus: string;
  currentPeriod: string;
}

const STATUS_FILTERS = [
  { value: "all",       label: "All" },
  { value: "submitted", label: "Submitted" },
  { value: "opened",    label: "Opened" },
  { value: "sent",      label: "Awaiting" },
  { value: "expired",   label: "Expired" },
];

function statusBadge(row: RequestRow) {
  if (row.expired) {
    return <Badge variant="outline" className="text-slate-400">Expired</Badge>;
  }
  if (row.status === "approved") {
    return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Approved</Badge>;
  }
  if (row.status === "rejected") {
    return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Rejected</Badge>;
  }
  if (row.status === "flagged") {
    return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Flagged</Badge>;
  }
  if (row.status === "submitted") {
    return <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100">Submitted</Badge>;
  }
  if (row.status === "opened") {
    return <Badge className="bg-slate-100 text-slate-800 hover:bg-slate-100">Opened</Badge>;
  }
  return <Badge variant="outline" className="text-slate-500">Awaiting</Badge>;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export function SupplierRequestsTable({
  orgId,
  rows,
  counts,
  periods,
  currentStatus,
  currentPeriod,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [reviewRow, setReviewRow] = useState<RequestRow | null>(null);
  const [convertQty, setConvertQty] = useState("");
  const [convertUnit, setConvertUnit] = useState("");
  const [convertNotes, setConvertNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [reviewAction, setReviewAction] = useState<"approve" | "reject" | null>(null);
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState("");
  const [convertedIds, setConvertedIds] = useState<Set<string>>(new Set());

  function setFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    startTransition(() => router.replace(`${pathname}?${params.toString()}`));
  }

  function openReview(row: RequestRow) {
    setReviewRow(row);
    setConvertQty(String(row.submittedData?.quantity ?? ""));
    setConvertUnit(row.submittedData?.unit ?? "tonne");
    setConvertNotes(row.submittedData?.description ?? "");
    setRejectionReason("");
    setReviewAction(null);
    setConvertError("");
  }

  async function handleReviewAction(action: "approve" | "reject") {
    if (!reviewRow) return;
    setConvertError("");

    if (action === "reject" && !rejectionReason.trim()) {
      setConvertError("Rejection reason is required.");
      return;
    }

    setConverting(true);
    try {
      const endpoint =
        action === "approve"
          ? `/api/orgs/${orgId}/supplier-data-requests/${reviewRow.id}/convert`
          : `/api/orgs/${orgId}/supplier-data-requests/${reviewRow.id}`;

      if (action === "approve") {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quantity: Number(convertQty),
            unit: convertUnit || reviewRow.submittedData?.unit,
            notes: convertNotes.trim() || undefined,
          }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          setConvertError(body?.message ?? "Approval failed.");
          return;
        }

        setConvertedIds((prev) => new Set([...prev, reviewRow.id]));
        setReviewRow(null);
        startTransition(() => router.refresh());
      } else {
        const res = await fetch(endpoint, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "reject",
            rejectionReason: rejectionReason.trim(),
          }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          setConvertError(body?.message ?? "Rejection failed.");
          return;
        }

        setReviewRow(null);
        startTransition(() => router.refresh());
      }
    } catch {
      setConvertError("Network error. Please try again.");
    } finally {
      setConverting(false);
    }
  }

  // Apply client-side expired filter (the server doesn't store "expired" as a DB status).
  const filtered = rows.filter((r) => {
    if (currentStatus === "expired") return r.expired;
    if (currentStatus === "all") return true;
    if (currentStatus === "sent") return r.status === "sent" && !r.expired;
    if (currentStatus === "opened") return r.status === "opened" && !r.expired;
    return r.status === currentStatus;
  });

  const pendingCount = counts.submitted || 0;

  return (
    <div className="flex flex-col gap-6 max-w-7xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Supplier data requests</h2>
        <p className="mt-1 text-sm text-slate-500">
          Review emissions data submitted by your suppliers and convert approved
          submissions into activity records.
        </p>
      </div>

      {/* Action banner when there are pending reviews */}
      {pendingCount > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
          <span className="text-green-800">
            <strong>{pendingCount}</strong> supplier submission{pendingCount !== 1 ? "s" : ""} ready to review.
          </span>
          <Button
            size="sm"
            variant="outline"
            className="ml-auto border-green-300 text-green-800 hover:bg-green-100"
            onClick={() => setFilter("status", "submitted")}
          >
            View submitted
          </Button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-slate-200 bg-white p-1 gap-0.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter("status", f.value)}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                currentStatus === f.value
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {f.label}
              {counts[f.value] > 0 && (
                <span className={`ml-1.5 text-xs ${
                  currentStatus === f.value ? "text-slate-300" : "text-slate-400"
                }`}>
                  {counts[f.value]}
                </span>
              )}
            </button>
          ))}
        </div>

        {periods.length > 1 && (
          <Select
            value={currentPeriod || "all"}
            onValueChange={(v) => setFilter("period", v === "all" ? "" : v)}
          >
            <SelectTrigger className="h-9 w-[200px] text-sm">
              <SelectValue placeholder="All periods" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All periods</SelectItem>
              {periods.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Send className="mx-auto mb-3 h-8 w-8 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">No requests found</p>
            <p className="mt-1 text-xs text-slate-400">
              {currentStatus !== "all"
                ? "Try changing the filter above."
                : "Send a supplier data campaign from the Supplier Data Requests API."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      {filtered.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-medium text-slate-500">
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Submitted data</th>
                <th className="px-4 py-3">Sent</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((row) => {
                const alreadyConverted = convertedIds.has(row.id);
                return (
                  <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">
                        {row.supplierName ?? row.supplierEmail}
                      </p>
                      {row.supplierName && (
                        <p className="text-xs text-slate-400">{row.supplierEmail}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="capitalize text-slate-700">{row.categoryName}</span>
                      <p className="text-xs text-slate-400">{row.categoryCode}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{row.periodLabel}</td>
                    <td className="px-4 py-3">{statusBadge(row)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {row.submittedData ? (
                          <span className="font-mono text-slate-800">
                            {row.submittedData.quantity.toLocaleString("en-GB")} {row.submittedData.unit}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                        {row.qualityFlags && row.qualityFlags.length > 0 && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            row.qualityFlags.some((f) => f.severity === "critical")
                              ? "bg-red-100 text-red-700"
                              : "bg-amber-100 text-amber-700"
                          }`}>
                            {row.qualityFlags.length} flag{row.qualityFlags.length !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      <div className="flex items-center gap-1">
                        {row.status === "opened" || row.status === "submitted"
                          ? <MailOpen className="h-3 w-3" />
                          : <Clock className="h-3 w-3" />
                        }
                        {fmtDate(row.sentAt)}
                      </div>
                      {row.submittedAt && (
                        <div className="flex items-center gap-1 text-green-600 mt-0.5">
                          <CheckCircle2 className="h-3 w-3" />
                          {fmtDate(row.submittedAt)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.status === "approved" || alreadyConverted ? (
                        <span className="flex items-center justify-end gap-1 text-xs text-green-600">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Converted
                        </span>
                      ) : row.status === "submitted" || row.status === "flagged" ? (
                        <Button size="sm" onClick={() => openReview(row)}>
                          <Eye className="mr-1.5 h-3.5 w-3.5" />
                          Review
                        </Button>
                      ) : row.status === "rejected" ? (
                        <span className="text-xs text-red-600">Rejected</span>
                      ) : (
                        <span className="text-xs text-slate-300">
                          {row.expired ? "Expired" : "Pending"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Review / convert dialog */}
      <Dialog open={!!reviewRow} onOpenChange={(open) => !open && setReviewRow(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review supplier submission</DialogTitle>
            <DialogDescription>
              Review the submitted data and decide whether to approve, reject, or convert to activity record.
            </DialogDescription>
          </DialogHeader>

          {reviewRow && (
            <div className="flex flex-col gap-4 py-2 max-h-[60vh] overflow-y-auto">
              {/* Submission summary */}
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <dt className="text-slate-400 text-xs">Supplier</dt>
                    <dd className="font-medium">{reviewRow.supplierName ?? reviewRow.supplierEmail}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400 text-xs">Category</dt>
                    <dd className="capitalize">{reviewRow.categoryName}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400 text-xs">Period</dt>
                    <dd>{reviewRow.periodLabel}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400 text-xs">Submitted</dt>
                    <dd>{fmtDate(reviewRow.submittedAt)}</dd>
                  </div>
                </dl>
                {reviewRow.submittedData?.description && (
                  <p className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-500">
                    {reviewRow.submittedData.description}
                  </p>
                )}
              </div>

              {/* Quality flags */}
              {reviewRow.qualityFlags && reviewRow.qualityFlags.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-sm font-medium text-amber-900 mb-2">Quality flags ({reviewRow.qualityFlags.length})</p>
                  <ul className="space-y-2">
                    {reviewRow.qualityFlags.map((flag, i) => (
                      <li key={i} className="flex gap-2 text-xs">
                        <span className={`px-2 py-0.5 rounded font-bold whitespace-nowrap ${
                          flag.severity === "critical" ? "bg-red-200 text-red-700" : flag.severity === "warning" ? "bg-amber-200 text-amber-700" : "bg-slate-200 text-slate-700"
                        }`}>
                          {flag.severity.toUpperCase()}
                        </span>
                        <div className="flex-1">
                          <p className="font-medium text-slate-900">{flag.field}</p>
                          <p className="text-slate-600">{flag.message}</p>
                          {flag.suggestedRange && (
                            <p className="text-slate-500 mt-0.5">Expected: {flag.suggestedRange.min} – {flag.suggestedRange.max}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Rejection reason (if rejected) */}
              {reviewRow.status === "rejected" && reviewRow.rejectionReason && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-sm font-medium text-red-900 mb-1">Previous rejection reason</p>
                  <p className="text-sm text-red-700">{reviewRow.rejectionReason}</p>
                </div>
              )}

              {/* Review action tabs */}
              {reviewRow.status === "submitted" || reviewRow.status === "flagged" ? (
                <>
                  {!reviewAction ? (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setReviewAction("approve")}
                        className="flex-1"
                      >
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setReviewAction("reject")}
                        className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                      >
                        Reject
                      </Button>
                    </div>
                  ) : reviewAction === "approve" ? (
                    <>
                      {/* Approve: show convert form */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="convert-qty">Quantity</Label>
                          <Input
                            id="convert-qty"
                            type="number"
                            min="0"
                            step="any"
                            value={convertQty}
                            onChange={(e) => setConvertQty(e.target.value)}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="convert-unit">Unit</Label>
                          <Input
                            id="convert-unit"
                            value={convertUnit}
                            onChange={(e) => setConvertUnit(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="convert-notes">
                          Notes{" "}
                          <span className="font-normal text-slate-400">(optional)</span>
                        </Label>
                        <Textarea
                          id="convert-notes"
                          rows={2}
                          placeholder="Override the source description if needed."
                          value={convertNotes}
                          onChange={(e) => setConvertNotes(e.target.value)}
                        />
                      </div>

                      <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                        The record will be created with <strong>draft</strong> review status and must be approved before inclusion in a calculation run.
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Reject: show reason field */}
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="rejection-reason">Reason for rejection *</Label>
                        <Textarea
                          id="rejection-reason"
                          rows={3}
                          placeholder="Explain why this submission is being rejected and what the supplier should correct."
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          maxLength={500}
                        />
                        <p className="text-right text-xs text-slate-400">
                          {rejectionReason.length}/500
                        </p>
                      </div>

                      <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                        The supplier will receive an email with this rejection reason and be asked to resubmit.
                      </div>
                    </>
                  )}
                </>
              ) : null}

              {convertError && (
                <p className="flex items-center gap-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
                  <CircleAlert className="h-4 w-4 shrink-0" />
                  {convertError}
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewRow(null)} disabled={converting}>
              Cancel
            </Button>
            {reviewAction ? (
              <Button onClick={() => handleReviewAction(reviewAction)} disabled={converting}>
                {converting
                  ? `${reviewAction === "approve" ? "Approving" : "Rejecting"}...`
                  : reviewAction === "approve"
                    ? "Approve & Create Record"
                    : "Reject Submission"}
                {!converting && <ArrowRight className="ml-1.5 h-4 w-4" />}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
