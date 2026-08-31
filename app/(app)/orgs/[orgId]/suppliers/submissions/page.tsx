"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

interface SupplierReport {
  id: string;
  supplierEmail: string;
  supplierName: string | null;
  reportingYear: number;
  totalAmount: number;
  unit: string;
  calculationMethod: string;
  notes: string | null;
  qualityScore: number;
  qualityFlags: string[] | null;
  status: "submitted" | "under_review" | "accepted" | "rejected";
  submittedAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
  convertedToRecordId: string | null;
  emissionCategory: {
    code: string;
    name: string;
    scope: string;
  };
  reviewedBy: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

interface ReportingPeriod {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  type: string;
}

export default function SupplierSubmissionsPage() {
  const params = useParams();
  const orgId = params.orgId as string;

  const [reports, setReports] = useState<SupplierReport[]>([]);
  const [periods, setPeriods] = useState<ReportingPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("submitted");
  const [selectedReport, setSelectedReport] = useState<SupplierReport | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingReportId, setRejectingReportId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [processingIds, setProcessingIds] = useState(new Set<string>());
  const [reportingPeriodId, setReportingPeriodId] = useState("");

  useEffect(() => {
    fetchReports();
    fetchReportingPeriods();
  }, [orgId, statusFilter]);

  async function fetchReportingPeriods() {
    try {
      const response = await fetch(`/api/orgs/${orgId}/reporting-periods`);
      if (response.ok) {
        const data = await response.json();
        setPeriods(data.periods);
      }
    } catch (error) {
      console.error("Failed to fetch reporting periods", error);
    }
  }

  async function fetchReports() {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/orgs/${orgId}/supplier-reports?status=${statusFilter}`
      );
      if (!response.ok) throw new Error("Failed to fetch reports");
      const data = await response.json();
      setReports(data.reports);
    } catch (error) {
      console.error("Failed to load supplier reports", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(reportId: string) {
    if (!reportingPeriodId) {
      alert("Please select a reporting period");
      return;
    }

    try {
      setProcessingIds((prev) => new Set([...prev, reportId]));
      const response = await fetch(
        `/api/orgs/${orgId}/supplier-reports/${reportId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "accept",
            reportingPeriodId,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to approve report");
      }

      fetchReports();
      setDetailOpen(false);
      setSelectedReport(null);
      setReportingPeriodId("");
    } catch (error) {
      console.error("Failed to approve report", error);
      alert(error instanceof Error ? error.message : "Failed to approve report");
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(reportId);
        return next;
      });
    }
  }

  async function handleReject(reportId: string) {
    if (!rejectionReason.trim()) {
      alert("Please provide a rejection reason");
      return;
    }

    try {
      setProcessingIds((prev) => new Set([...prev, reportId]));
      const response = await fetch(
        `/api/orgs/${orgId}/supplier-reports/${reportId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "reject",
            rejectionReason,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to reject report");
      }

      fetchReports();
      setRejectDialogOpen(false);
      setRejectingReportId(null);
      setRejectionReason("");
    } catch (error) {
      console.error("Failed to reject report", error);
      alert(error instanceof Error ? error.message : "Failed to reject report");
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(reportId);
        return next;
      });
    }
  }

  async function handleUnderReview(reportId: string) {
    try {
      setProcessingIds((prev) => new Set([...prev, reportId]));
      const response = await fetch(
        `/api/orgs/${orgId}/supplier-reports/${reportId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "under_review" }),
        }
      );

      if (!response.ok) throw new Error("Failed to update report status");

      fetchReports();
    } catch (error) {
      console.error("Failed to update report status", error);
      alert("Failed to update report status");
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(reportId);
        return next;
      });
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      submitted: "default",
      under_review: "secondary",
      accepted: "outline",
      rejected: "destructive",
    };
    return <Badge variant={variants[status] || "default"}>{status}</Badge>;
  };

  const getQualityScoreBadge = (score: number) => {
    if (score >= 80) return <Badge className="bg-green-100 text-green-800">{score}%</Badge>;
    if (score >= 60) return <Badge className="bg-yellow-100 text-yellow-800">{score}%</Badge>;
    return <Badge variant="destructive">{score}%</Badge>;
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Supplier Data Submissions</h1>
          <p className="text-gray-600 mt-1">Review and approve supplier-submitted emissions data</p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="under_review">Under Review</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin" />
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>No supplier reports found</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Supplier</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-center">Quality</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Submitted</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((report) => (
                <TableRow key={report.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{report.supplierName || report.supplierEmail}</div>
                      <div className="text-sm text-gray-600">{report.supplierEmail}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{report.emissionCategory.name}</div>
                      <div className="text-sm text-gray-600">{report.emissionCategory.scope}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-mono">{report.totalAmount.toFixed(2)} {report.unit}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    {getQualityScoreBadge(report.qualityScore)}
                  </TableCell>
                  <TableCell className="text-center">
                    {getStatusBadge(report.status)}
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {new Date(report.submittedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedReport(report);
                          setDetailOpen(true);
                        }}
                      >
                        Review
                      </Button>
                      {report.status === "submitted" && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleUnderReview(report.id)}
                            disabled={processingIds.has(report.id)}
                            variant="secondary"
                          >
                            {processingIds.has(report.id) ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Mark Reviewing"
                            )}
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Supplier Report</DialogTitle>
            <DialogDescription>
              {selectedReport?.supplierName || selectedReport?.supplierEmail}
            </DialogDescription>
          </DialogHeader>

          {selectedReport && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Supplier Email</label>
                  <p className="mt-1">{selectedReport.supplierEmail}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Reporting Year</label>
                  <p className="mt-1">{selectedReport.reportingYear}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Category</label>
                  <p className="mt-1">{selectedReport.emissionCategory.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Quality Score</label>
                  <p className="mt-1">{getQualityScoreBadge(selectedReport.qualityScore)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Amount</label>
                  <p className="mt-1 font-mono">
                    {selectedReport.totalAmount} {selectedReport.unit}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Calculation Method</label>
                  <p className="mt-1">{selectedReport.calculationMethod}</p>
                </div>
              </div>

              {selectedReport.notes && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Notes</label>
                  <p className="mt-1 p-3 bg-gray-50 rounded text-sm">{selectedReport.notes}</p>
                </div>
              )}

              {selectedReport.qualityFlags && selectedReport.qualityFlags.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Quality Flags</label>
                  <ul className="mt-2 space-y-1">
                    {selectedReport.qualityFlags.map((flag) => (
                      <li key={flag} className="flex items-center gap-2 text-sm">
                        <span className="inline-block w-2 h-2 bg-yellow-500 rounded-full" />
                        {flag}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedReport.reviewedBy && (
                <div className="pt-4 border-t">
                  <label className="text-sm font-medium text-gray-600">Review Info</label>
                  <p className="mt-1 text-sm">
                    Reviewed by {selectedReport.reviewedBy.name || selectedReport.reviewedBy.email}{" "}
                    on {new Date(selectedReport.reviewedAt!).toLocaleDateString()}
                  </p>
                  {selectedReport.rejectionReason && (
                    <p className="mt-2 text-sm text-red-600">
                      Rejection reason: {selectedReport.rejectionReason}
                    </p>
                  )}
                </div>
              )}

              {selectedReport.status === "submitted" && (
                <div className="space-y-4 pt-4 border-t">
                  <div>
                    <label className="text-sm font-medium">Reporting Period</label>
                    <Select value={reportingPeriodId} onValueChange={setReportingPeriodId}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select reporting period for approval..." />
                      </SelectTrigger>
                      <SelectContent>
                        {periods.length === 0 ? (
                          <SelectItem value="">No periods available</SelectItem>
                        ) : (
                          periods.map((period) => (
                            <SelectItem key={period.id} value={period.id}>
                              {period.label}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleApprove(selectedReport.id)}
                      disabled={processingIds.has(selectedReport.id)}
                      className="flex-1"
                    >
                      {processingIds.has(selectedReport.id) ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        setRejectingReportId(selectedReport.id);
                        setRejectDialogOpen(true);
                      }}
                      disabled={processingIds.has(selectedReport.id)}
                      className="flex-1"
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Confirmation Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Report</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this supplier report.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for rejection..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            className="min-h-24"
          />
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (rejectingReportId) {
                  handleReject(rejectingReportId);
                }
              }}
              disabled={processingIds.has(rejectingReportId || "")}
            >
              {processingIds.has(rejectingReportId || "") ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Confirm Rejection
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
