"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2, XCircle, Clock, AlertTriangle, ChevronDown, ChevronRight,
  Building2, Calendar, Package, TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Report {
  id: string;
  supplierEmail: string;
  supplierName: string | null;
  supplierDomain: string | null;
  reportingYear: number;
  totalAmount: string;
  unit: string;
  calculationMethod: string;
  qualityScore: number | null;
  qualityFlags: unknown;
  status: string;
  submittedAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
  convertedToRecordId: string | null;
  notes: string | null;
  emissionCategory: { code: string; name: string; scope: number } | null;
  reviewedBy: { name: string | null; email: string } | null;
}

interface ReportingPeriod {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
}

interface Props {
  orgId: string;
  reports: Report[];
  nextCursor: string | null;
  status: string;
  role: string;
  reportingPeriods: ReportingPeriod[];
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; class: string }> = {
  submitted:    { label: "Pending",    icon: Clock,         class: "bg-amber-50 text-amber-700 border-amber-200" },
  under_review: { label: "In review",  icon: Clock,         class: "bg-blue-50 text-blue-700 border-blue-200" },
  accepted:     { label: "Accepted",   icon: CheckCircle2,  class: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected:     { label: "Rejected",   icon: XCircle,       class: "bg-red-50 text-red-700 border-red-200" },
};

const METHOD_LABELS: Record<string, string> = {
  spend_based:          "Spend-based",
  activity_based:       "Activity-based",
  direct_measurement:   "Direct measurement",
};

function qualityColor(score: number | null) {
  if (score === null) return "text-slate-500";
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-amber-600";
  return "text-red-600";
}

function formatAmount(amount: string, unit: string) {
  const n = parseFloat(amount);
  const formatted = n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return `${formatted} ${unit}`;
}

export function SupplierReportsClient({ orgId, reports, nextCursor, status, role, reportingPeriods }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [acceptDialog, setAcceptDialog] = useState<Report | null>(null);
  const [rejectDialog, setRejectDialog] = useState<Report | null>(null);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [isActing, setIsActing] = useState(false);

  const canReview = ["admin", "editor", "reviewer"].includes(role);

  async function patchReport(reportId: string, body: Record<string, unknown>) {
    setActionError(null);
    setIsActing(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/supplier-reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message ?? "Request failed");
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setIsActing(false);
    }
  }

  async function handleMarkUnderReview(report: Report) {
    await patchReport(report.id, { action: "under_review" });
  }

  async function handleAccept() {
    if (!acceptDialog || !selectedPeriodId) return;
    await patchReport(acceptDialog.id, { action: "accept", reportingPeriodId: selectedPeriodId });
    setAcceptDialog(null);
    setSelectedPeriodId("");
  }

  async function handleReject() {
    if (!rejectDialog || !rejectionReason.trim()) return;
    await patchReport(rejectDialog.id, { action: "reject", rejectionReason: rejectionReason.trim() });
    setRejectDialog(null);
    setRejectionReason("");
  }

  if (reports.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 text-center px-4">
        <div className="rounded-full bg-slate-100 p-4 mb-4">
          <Package className="h-8 w-8 text-slate-500" />
        </div>
        <p className="text-sm font-medium text-slate-700">No supplier reports</p>
        <p className="mt-1 text-xs text-slate-500 max-w-xs">
          {status === "submitted"
            ? "No supplier reports are awaiting review. Reports appear here when suppliers submit data via their invite link."
            : `No reports with status "${status}".`}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="space-y-2">
          {reports.map((report) => {
            const cfg = STATUS_CONFIG[report.status] ?? STATUS_CONFIG.submitted;
            const StatusIcon = cfg.icon;
            const isExpanded = expandedId === report.id;
            const flags = Array.isArray(report.qualityFlags) ? report.qualityFlags as { type: string; message: string; severity: string }[] : [];

            return (
              <div
                key={report.id}
                className="rounded-xl border border-[#E5E7EB] bg-white shadow-sm overflow-hidden"
              >
                {/* Row header */}
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : report.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="shrink-0">
                    {isExpanded
                      ? <ChevronDown className="h-4 w-4 text-slate-500" />
                      : <ChevronRight className="h-4 w-4 text-slate-500" />}
                  </div>

                  {/* Supplier */}
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                      <Building2 className="h-3.5 w-3.5 text-slate-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {report.supplierName ?? report.supplierEmail}
                      </p>
                      {report.supplierName && (
                        <p className="text-[11px] text-slate-500 truncate">{report.supplierEmail}</p>
                      )}
                    </div>
                  </div>

                  {/* Category */}
                  <div className="hidden sm:block shrink-0 text-xs text-slate-600 w-36 truncate">
                    {report.emissionCategory?.name ?? "—"}
                  </div>

                  {/* Amount */}
                  <div className="hidden md:block shrink-0 text-sm font-mono text-slate-600 w-32 text-right">
                    {formatAmount(report.totalAmount, report.unit)}
                  </div>

                  {/* Quality */}
                  <div className={`hidden lg:block shrink-0 text-sm font-semibold w-10 text-right ${qualityColor(report.qualityScore)}`}>
                    {report.qualityScore !== null ? `${report.qualityScore}` : "—"}
                  </div>

                  {/* Year */}
                  <div className="hidden sm:flex shrink-0 items-center gap-1 text-xs text-slate-600 w-12">
                    <Calendar className="h-3 w-3" />
                    {report.reportingYear}
                  </div>

                  {/* Status badge */}
                  <div className="shrink-0">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${cfg.class}`}>
                      <StatusIcon className="h-3 w-3" aria-hidden="true" />
                      {cfg.label}
                    </span>
                  </div>

                  {/* Actions */}
                  {canReview && report.status === "submitted" && (
                    <div className="shrink-0 flex items-center gap-1.5 ml-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        onClick={() => handleMarkUnderReview(report)}
                        disabled={isActing}
                      >
                        Review
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 px-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => { setAcceptDialog(report); setSelectedPeriodId(reportingPeriods[0]?.id ?? ""); }}
                        disabled={isActing}
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => setRejectDialog(report)}
                        disabled={isActing}
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                  {canReview && report.status === "under_review" && (
                    <div className="shrink-0 flex items-center gap-1.5 ml-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        className="h-7 px-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => { setAcceptDialog(report); setSelectedPeriodId(reportingPeriods[0]?.id ?? ""); }}
                        disabled={isActing}
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => setRejectDialog(report)}
                        disabled={isActing}
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-[#E5E7EB] px-4 py-4 bg-slate-50">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                      <div>
                        <p className="text-slate-500 mb-0.5">Method</p>
                        <p className="text-slate-700">{METHOD_LABELS[report.calculationMethod] ?? report.calculationMethod}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 mb-0.5">Scope</p>
                        <p className="text-slate-700">Scope {report.emissionCategory?.scope ?? "—"} — {report.emissionCategory?.code ?? "—"}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 mb-0.5">Submitted</p>
                        <p className="text-slate-700">{new Date(report.submittedAt).toLocaleDateString()}</p>
                      </div>
                      {report.reviewedAt && (
                        <div>
                          <p className="text-slate-500 mb-0.5">Reviewed</p>
                          <p className="text-slate-700">
                            {new Date(report.reviewedAt).toLocaleDateString()}
                            {report.reviewedBy && (
                              <span className="text-slate-500"> by {report.reviewedBy.name ?? report.reviewedBy.email}</span>
                            )}
                          </p>
                        </div>
                      )}
                    </div>

                    {report.notes && (
                      <div className="mt-3">
                        <p className="text-[11px] text-slate-500 mb-1">Supplier notes</p>
                        <p className="text-xs text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2">{report.notes}</p>
                      </div>
                    )}

                    {report.rejectionReason && (
                      <div className="mt-3">
                        <p className="text-[11px] text-slate-500 mb-1">Rejection reason</p>
                        <p className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2">{report.rejectionReason}</p>
                      </div>
                    )}

                    {report.convertedToRecordId && (
                      <div className="mt-3">
                        <p className="text-[11px] text-slate-500 mb-1">Converted to activity record</p>
                        <p className="text-xs text-emerald-600 font-mono">{report.convertedToRecordId}</p>
                      </div>
                    )}

                    {flags.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        <p className="text-[11px] text-slate-500">Quality flags</p>
                        {flags.map((flag, i) => (
                          <div key={i} className={[
                            "flex items-start gap-2 text-xs rounded-lg px-3 py-2",
                            flag.severity === "error" ? "bg-red-50 text-red-700" :
                            flag.severity === "warning" ? "bg-amber-50 text-amber-700" :
                            "bg-blue-50 text-blue-700",
                          ].join(" ")}>
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                            <span>{flag.message}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {nextCursor && (
          <div className="mt-4 flex justify-center">
            <a
              href={`?status=${status}&cursor=${nextCursor}`}
              className="text-xs text-slate-600 hover:text-slate-900 px-4 py-2 rounded-lg border border-[#E5E7EB] hover:bg-slate-50 transition-colors"
            >
              Load more
            </a>
          </div>
        )}

        {actionError && (
          <div className="mt-3 text-xs text-red-600 text-center">{actionError}</div>
        )}
      </div>

      {/* Accept dialog */}
      <Dialog open={!!acceptDialog} onOpenChange={(open) => { if (!open) { setAcceptDialog(null); setSelectedPeriodId(""); } }}>
        <DialogContent className="bg-white border-slate-200 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-slate-900">Accept supplier report</DialogTitle>
            <DialogDescription className="text-slate-500 text-sm">
              This will convert the report into an activity record. Select a reporting period to assign it to.
            </DialogDescription>
          </DialogHeader>

          {acceptDialog && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs space-y-1">
                <p className="text-slate-900 font-medium">{acceptDialog.supplierName ?? acceptDialog.supplierEmail}</p>
                <p className="text-slate-500">{formatAmount(acceptDialog.totalAmount, acceptDialog.unit)} via {METHOD_LABELS[acceptDialog.calculationMethod] ?? acceptDialog.calculationMethod}</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-600">Reporting period</Label>
                <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
                  <SelectTrigger className="bg-white border-[#E5E7EB] text-slate-900 text-sm">
                    <SelectValue placeholder="Select a reporting period" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200">
                    {reportingPeriods.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-slate-900 focus:bg-slate-100 focus:text-slate-900">
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {actionError && <p className="text-xs text-red-600">{actionError}</p>}

          <DialogFooter className="gap-2">
            <Button variant="ghost" size="sm" className="text-slate-600" onClick={() => setAcceptDialog(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={!selectedPeriodId || isActing}
              onClick={handleAccept}
            >
              {isActing ? "Accepting..." : "Accept and create record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={(open) => { if (!open) { setRejectDialog(null); setRejectionReason(""); } }}>
        <DialogContent className="bg-white border-slate-200 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-slate-900">Reject supplier report</DialogTitle>
            <DialogDescription className="text-slate-500 text-sm">
              Provide a reason so the supplier knows what needs to be corrected.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-600">Reason for rejection</Label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                maxLength={500}
                rows={4}
                placeholder="e.g. The reported amount appears to be in kg rather than tonnes. Please resubmit with the correct unit."
                className="bg-white border-[#E5E7EB] text-slate-900 text-sm resize-none placeholder:text-slate-400"
              />
              <p className="text-[11px] text-slate-500 text-right">{rejectionReason.length}/500</p>
            </div>
          </div>

          {actionError && <p className="text-xs text-red-600">{actionError}</p>}

          <DialogFooter className="gap-2">
            <Button variant="ghost" size="sm" className="text-slate-600" onClick={() => setRejectDialog(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={!rejectionReason.trim() || isActing}
              onClick={handleReject}
            >
              {isActing ? "Rejecting..." : "Reject report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
