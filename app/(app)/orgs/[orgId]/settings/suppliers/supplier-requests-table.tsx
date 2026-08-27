"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  CheckCircle2,
  CircleAlert,
  Clock,
  Eye,
  MailOpen,
  Send,
  MoreHorizontal,
  Flag,
  XCircle,
  Upload,
  AlertTriangle,
  ShieldCheck,
  ThumbsDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type RequestStatus = "sent" | "opened" | "submitted" | "expired" | "flagged" | "approved" | "rejected";

interface QualityFlag {
  field: string;
  severity: "warning" | "critical";
  message: string;
  suggestedRange?: { min: number; max: number };
}

interface SubmittedData {
  quantity: number;
  unit: string;
  description?: string | null;
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
  reviewedAt: string | null;
  expiresAt: string;
  expired: boolean;
  notes: string | null;
  submittedData: SubmittedData | null;
  qualityFlags: QualityFlag[] | null;
  rejectionReason: string | null;
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
  { value: "flagged",   label: "Flagged" },
  { value: "approved",  label: "Approved" },
  { value: "rejected",  label: "Rejected" },
  { value: "opened",    label: "Opened" },
  { value: "sent",      label: "Awaiting" },
  { value: "expired",   label: "Expired" },
];

function statusBadge(row: RequestRow) {
  if (row.expired && row.status !== "submitted" && row.status !== "approved" && row.status !== "rejected") {
    return <Badge variant="outline" className="text-slate-400">Expired</Badge>;
  }
  if (row.status === "approved") {
<<<<<<< HEAD
    return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Approved</Badge>;
=======
    return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Approved</Badge>;
>>>>>>> main
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

function QualityFlagsBadge({ flags }: { flags: QualityFlag[] | null }) {
  if (!flags || flags.length === 0) return <span className="text-slate-300">—</span>;

  const criticalCount = flags.filter((f) => f.severity === "critical").length;
  const warningCount = flags.filter((f) => f.severity === "warning").length;

  if (criticalCount > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
        <CircleAlert className="h-3 w-3" />
        {criticalCount} critical
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
      <AlertTriangle className="h-3 w-3" />
      {warningCount} warning{warningCount !== 1 ? "s" : ""}
    </span>
  );
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

// Bulk upload dialog
function BulkUploadDialog({ orgId, open, onClose }: { orgId: string; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number; errors: { row: number; email: string; error: string }[] } | null>(null);
  const [error, setError] = useState("");

  function handleFile(f: File) {
    if (!f.name.endsWith(".csv")) { setError("Only CSV files are supported."); return; }
    setFile(f);
    setError("");
    setResult(null);
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/orgs/${orgId}/supplier-data-requests/bulk`, {
        method: "POST",
        body: fd,
      });
      const body = await res.json();
      if (!res.ok) { setError(body?.message ?? "Upload failed."); return; }
      setResult(body);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  function reset() {
    setFile(null);
    setResult(null);
    setError("");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk import suppliers</DialogTitle>
          <DialogDescription>
            Upload a CSV with columns: email, name (optional), categoryCode, periodId, notes (optional).
            One row per supplier request.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="flex flex-col gap-4 py-2">
            <div
              className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 transition-colors cursor-pointer ${
                dragOver ? "border-amber-400 bg-amber-50" : "border-slate-200 hover:border-slate-300"
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-8 w-8 text-slate-300 mb-3" />
              {file ? (
                <p className="text-sm font-medium text-slate-700">{file.name}</p>
              ) : (
                <>
                  <p className="text-sm font-medium text-slate-600">Drop CSV here or click to browse</p>
                  <p className="mt-1 text-xs text-slate-400">email, name, categoryCode, periodId columns required</p>
                </>
              )}
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </div>

            {error && (
              <p className="flex items-center gap-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
                <CircleAlert className="h-4 w-4 shrink-0" /> {error}
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3 py-2">
            <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span><strong>{result.created}</strong> requests created, <strong>{result.skipped}</strong> skipped (already exist).</span>
            </div>
            {result.errors.length > 0 && (
              <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3">
                <p className="text-xs font-medium text-red-700 mb-2">{result.errors.length} row{result.errors.length !== 1 ? "s" : ""} with errors:</p>
                <div className="max-h-40 overflow-y-auto text-xs text-red-600 space-y-1">
                  {result.errors.map((e, i) => (
                    <p key={i}>Row {e.row}: {e.email} — {e.error}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>
            {result ? "Close" : "Cancel"}
          </Button>
          {!result && (
            <Button onClick={handleUpload} disabled={!file || uploading}>
              {uploading ? "Uploading..." : "Upload CSV"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Review dialog (approve / reject / flag)
function ReviewDialog({
  row,
  orgId,
  onClose,
  onDone,
}: {
  row: RequestRow;
  orgId: string;
  onClose: () => void;
  onDone: (newStatus: string) => void;
}) {
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function callPatch(action: "approve" | "reject" | "flag_for_review") {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/orgs/${orgId}/supplier-data-requests/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ...(action === "reject" ? { rejectionReason: rejectionReason.trim() || undefined } : {}),
        }),
      });
      const body = await res.json();
      if (!res.ok) { setError(body?.message ?? "Action failed."); return; }
      onDone(body.status);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const flags = row.qualityFlags ?? [];
  const criticalFlags = flags.filter((f) => f.severity === "critical");
  const warningFlags = flags.filter((f) => f.severity === "warning");

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Review supplier submission</DialogTitle>
          <DialogDescription>
            {row.supplierName ?? row.supplierEmail} &mdash; {row.categoryName} &mdash; {row.periodLabel}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Submitted data */}
          <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <dt className="text-slate-400 text-xs">Supplier</dt>
                <dd className="font-medium">{row.supplierName ?? row.supplierEmail}</dd>
              </div>
              <div>
                <dt className="text-slate-400 text-xs">Submitted</dt>
                <dd>{fmtDate(row.submittedAt)}</dd>
              </div>
              {row.submittedData && (
                <div className="col-span-2">
                  <dt className="text-slate-400 text-xs">Data</dt>
                  <dd className="font-mono font-medium text-slate-900">
                    {row.submittedData.quantity.toLocaleString("en-GB")} {row.submittedData.unit}
                  </dd>
                </div>
              )}
            </dl>
            {row.submittedData?.description && (
              <p className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-500">
                {row.submittedData.description}
              </p>
            )}
          </div>

          {/* Quality flags */}
          {flags.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-slate-600">Quality checks</p>
              {criticalFlags.map((f, i) => (
                <div key={i} className="flex items-start gap-2 rounded border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-800">
                  <CircleAlert className="h-3.5 w-3.5 mt-0.5 shrink-0 text-red-600" />
                  <div>
                    <span className="font-medium uppercase tracking-wide">{f.field}</span>
                    {" — "}{f.message}
                    {f.suggestedRange && (
                      <span className="text-red-600"> (expected {f.suggestedRange.min}–{f.suggestedRange.max})</span>
                    )}
                  </div>
                </div>
              ))}
              {warningFlags.map((f, i) => (
                <div key={i} className="flex items-start gap-2 rounded border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-600" />
                  <div>
                    <span className="font-medium uppercase tracking-wide">{f.field}</span>
                    {" — "}{f.message}
                    {f.suggestedRange && (
                      <span className="text-amber-700"> (expected {f.suggestedRange.min}–{f.suggestedRange.max})</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {flags.length === 0 && row.status === "submitted" && (
            <div className="flex items-center gap-2 rounded border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              No quality issues detected.
            </div>
          )}

          {/* Rejection reason form */}
          {showRejectForm && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rejection-reason">
                Rejection reason <span className="font-normal text-slate-400">(optional)</span>
              </Label>
              <Textarea
                id="rejection-reason"
                rows={3}
                placeholder="Explain why this submission is being rejected..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            </div>
          )}

          {error && (
            <p className="flex items-center gap-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
              <CircleAlert className="h-4 w-4 shrink-0" /> {error}
            </p>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={onClose} disabled={loading} className="sm:mr-auto">
            Cancel
          </Button>

          {!showRejectForm ? (
            <>
              <Button
                variant="outline"
                onClick={() => callPatch("flag_for_review")}
                disabled={loading}
                className="border-amber-200 text-amber-700 hover:bg-amber-50"
              >
                <Flag className="mr-1.5 h-3.5 w-3.5" />
                Flag for review
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowRejectForm(true)}
                disabled={loading}
                className="border-red-200 text-red-700 hover:bg-red-50"
              >
                <ThumbsDown className="mr-1.5 h-3.5 w-3.5" />
                Reject
              </Button>
              <Button
                onClick={() => callPatch("approve")}
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                {loading ? "Approving..." : "Approve"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setShowRejectForm(false)} disabled={loading}>
                Back
              </Button>
              <Button
                onClick={() => callPatch("reject")}
                disabled={loading}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <XCircle className="mr-1.5 h-3.5 w-3.5" />
                {loading ? "Rejecting..." : "Confirm rejection"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
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
<<<<<<< HEAD
  const [convertQty, setConvertQty] = useState("");
  const [convertUnit, setConvertUnit] = useState("");
  const [convertNotes, setConvertNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [reviewAction, setReviewAction] = useState<"approve" | "reject" | null>(null);
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState("");
  const [convertedIds, setConvertedIds] = useState<Set<string>>(new Set());
=======
  const [bulkOpen, setBulkOpen] = useState(false);
  const [updatedIds, setUpdatedIds] = useState<Map<string, string>>(new Map());
>>>>>>> main

  function setFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    startTransition(() => router.replace(`${pathname}?${params.toString()}`));
  }

<<<<<<< HEAD
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
=======
  async function flagRow(row: RequestRow) {
    try {
      const res = await fetch(`/api/orgs/${orgId}/supplier-data-requests/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "flag_for_review" }),
      });
      if (res.ok) {
        setUpdatedIds((prev) => new Map(prev).set(row.id, "flagged"));
        startTransition(() => router.refresh());
      }
    } catch { /* ignore */ }
>>>>>>> main
  }

  const filtered = rows.filter((r) => {
    const effectiveStatus = updatedIds.get(r.id) ?? (r.expired && r.status !== "submitted" && r.status !== "approved" && r.status !== "rejected" ? "expired" : r.status);
    if (currentStatus === "expired") return effectiveStatus === "expired" || (r.expired && !["submitted","approved","rejected"].includes(r.status));
    if (currentStatus === "all") return true;
    if (currentStatus === "sent") return r.status === "sent" && !r.expired;
    if (currentStatus === "opened") return r.status === "opened" && !r.expired;
    return effectiveStatus === currentStatus;
  });

<<<<<<< HEAD
  const pendingCount = counts.submitted || 0;
=======
  const pendingCount = counts.submitted ?? 0;
  const flaggedCount = counts.flagged ?? 0;
>>>>>>> main

  return (
    <div className="flex flex-col gap-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Supplier data requests</h2>
          <p className="mt-1 text-sm text-slate-500">
            Review and approve emissions data submitted by your suppliers.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setBulkOpen(true)}
          className="shrink-0"
        >
          <Upload className="mr-1.5 h-3.5 w-3.5" />
          Import CSV
        </Button>
      </div>

      {/* Banners */}
      {(pendingCount > 0 || flaggedCount > 0) && (
        <div className="flex flex-col gap-2">
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
          {flaggedCount > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
              <Flag className="h-4 w-4 shrink-0 text-amber-600" />
              <span className="text-amber-800">
                <strong>{flaggedCount}</strong> submission{flaggedCount !== 1 ? "s" : ""} flagged for review.
              </span>
              <Button
                size="sm"
                variant="outline"
                className="ml-auto border-amber-300 text-amber-800 hover:bg-amber-100"
                onClick={() => setFilter("status", "flagged")}
              >
                View flagged
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap rounded-lg border border-slate-200 bg-white p-1 gap-0.5">
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
              {(counts[f.value] ?? 0) > 0 && (
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
                : "Import a CSV or send requests via the supplier form."}
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
                <th className="px-4 py-3">Quality</th>
                <th className="px-4 py-3">Sent</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((row) => {
                const effectiveStatus = updatedIds.get(row.id) ?? row.status;
                const isActionable = row.submittedData != null && effectiveStatus !== "approved" && effectiveStatus !== "rejected";

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
                    <td className="px-4 py-3">{statusBadge({ ...row, status: effectiveStatus as RequestStatus })}</td>
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
                    <td className="px-4 py-3">
                      <QualityFlagsBadge flags={row.qualityFlags} />
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
                      {row.reviewedAt && (
                        <div className="flex items-center gap-1 text-slate-400 mt-0.5">
                          <Eye className="h-3 w-3" />
                          {fmtDate(row.reviewedAt)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
<<<<<<< HEAD
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
=======
                      {effectiveStatus === "approved" ? (
                        <span className="flex items-center justify-end gap-1 text-xs text-emerald-600">
                          <ShieldCheck className="h-3.5 w-3.5" /> Approved
                        </span>
                      ) : effectiveStatus === "rejected" ? (
                        <span className="flex items-center justify-end gap-1 text-xs text-red-500">
                          <XCircle className="h-3.5 w-3.5" /> Rejected
                        </span>
                      ) : isActionable ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline" className="h-7 w-7 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setReviewRow(row)}>
                              <Eye className="mr-2 h-3.5 w-3.5" />
                              Review and approve
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => flagRow(row)}
                              className="text-amber-700 focus:text-amber-700"
                            >
                              <Flag className="mr-2 h-3.5 w-3.5" />
                              Flag for review
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
>>>>>>> main
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

<<<<<<< HEAD
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
=======
      {/* Rejection reason tooltip shown inline in table for rejected rows */}
      {rows.some((r) => r.status === "rejected" && r.rejectionReason) && currentStatus !== "all" && currentStatus !== "rejected" ? null : (
        rows
          .filter((r) => (updatedIds.get(r.id) ?? r.status) === "rejected" && r.rejectionReason && filtered.includes(r))
          .map((r) => (
            <div key={`reason-${r.id}`} className="rounded-lg border border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">
              <span className="font-medium">{r.supplierName ?? r.supplierEmail}:</span> {r.rejectionReason}
>>>>>>> main
            </div>
          ))
      )}

<<<<<<< HEAD
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
=======
      {/* Bulk upload dialog */}
      <BulkUploadDialog orgId={orgId} open={bulkOpen} onClose={() => setBulkOpen(false)} />

      {/* Review dialog */}
      {reviewRow && (
        <ReviewDialog
          row={reviewRow}
          orgId={orgId}
          onClose={() => setReviewRow(null)}
          onDone={(newStatus) => {
            setUpdatedIds((prev) => new Map(prev).set(reviewRow.id, newStatus));
            setReviewRow(null);
            startTransition(() => router.refresh());
          }}
        />
      )}
>>>>>>> main
    </div>
  );
}
