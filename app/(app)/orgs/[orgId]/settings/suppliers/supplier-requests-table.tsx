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

type RequestStatus = "sent" | "opened" | "submitted" | "expired";

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
  expiresAt: string;
  expired: boolean;
  notes: string | null;
  submittedData: SubmittedData | null;
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
  if (row.status === "submitted") {
    return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Submitted</Badge>;
  }
  if (row.status === "opened") {
    return <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100">Opened</Badge>;
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
    setConvertError("");
  }

  async function handleConvert() {
    if (!reviewRow) return;
    setConvertError("");

    const qty = Number(convertQty);
    if (!convertQty || isNaN(qty) || qty <= 0) {
      setConvertError("Enter a valid quantity.");
      return;
    }

    setConverting(true);
    try {
      const res = await fetch(
        `/api/orgs/${orgId}/supplier-data-requests/${reviewRow.id}/convert`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quantity: qty,
            unit: convertUnit || reviewRow.submittedData?.unit,
            notes: convertNotes.trim() || undefined,
          }),
        },
      );

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setConvertError(body?.message ?? "Conversion failed.");
        return;
      }

      setConvertedIds((prev) => new Set([...prev, reviewRow.id]));
      setReviewRow(null);
      startTransition(() => router.refresh());
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

  const pendingCount = counts.submitted;

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
                      {row.submittedData ? (
                        <span className="font-mono text-slate-800">
                          {row.submittedData.quantity.toLocaleString("en-GB")} {row.submittedData.unit}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
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
                      {alreadyConverted ? (
                        <span className="flex items-center justify-end gap-1 text-xs text-green-600">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Converted
                        </span>
                      ) : row.status === "submitted" ? (
                        <Button size="sm" onClick={() => openReview(row)}>
                          <Eye className="mr-1.5 h-3.5 w-3.5" />
                          Review
                        </Button>
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Convert to activity record</DialogTitle>
            <DialogDescription>
              Review the submitted data and adjust if needed before committing it
              as a draft activity record.
            </DialogDescription>
          </DialogHeader>

          {reviewRow && (
            <div className="flex flex-col gap-4 py-2">
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

              {/* Editable quantity + unit */}
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

              {/* Notes */}
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

              {convertError && (
                <p className="flex items-center gap-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
                  <CircleAlert className="h-4 w-4 shrink-0" />
                  {convertError}
                </p>
              )}

              <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                The record will be created with <strong>draft</strong> review
                status and must be approved before it is included in a
                calculation run.
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewRow(null)} disabled={converting}>
              Cancel
            </Button>
            <Button onClick={handleConvert} disabled={converting}>
              {converting ? "Converting..." : "Create activity record"}
              {!converting && <ArrowRight className="ml-1.5 h-4 w-4" />}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
