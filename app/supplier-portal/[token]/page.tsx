"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, Clock, Loader2, AlertTriangle, XCircle } from "lucide-react";
import { getRequestDisplayInfo, formatRequestStatus, RequestDisplayInfo } from "@/lib/suppliers/portal-helpers";

interface SupplierRequest {
  id: string;
  categoryCode: string;
  status: string;
  expiresAt: string;
  submittedAt?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  qualityFlags?: Array<{
    field: string;
    severity: "warning" | "critical";
    message: string;
    suggestedRange?: { min: number; max: number };
  }>;
  reportingPeriod: {
    label: string;
  };
}

export default function SupplierPortalPage() {
  const params = useParams<{ token: string }>();
  const token = params.token as string;

  const [requests, setRequests] = useState<SupplierRequest[]>([]);
  const [displayRequests, setDisplayRequests] = useState<RequestDisplayInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const response = await fetch(`/api/supplier-portal/requests?token=${token}`);

        if (!response.ok) {
          if (response.status === 401 || response.status === 404) {
            setError("Invalid or expired portal link. Please check your email for the correct link.");
            setLoading(false);
            return;
          }
          throw new Error(`Failed to fetch requests: ${response.statusText}`);
        }

        const data = await response.json();
        setRequests(data.requests || []);

        // Transform to display format
        const display = (data.requests || []).map((req: SupplierRequest) =>
          getRequestDisplayInfo({
            id: req.id,
            categoryCode: req.categoryCode,
            status: req.status as any,
            expiresAt: new Date(req.expiresAt),
            submittedAt: req.submittedAt ? new Date(req.submittedAt) : undefined,
            reviewedAt: req.reviewedAt ? new Date(req.reviewedAt) : undefined,
            rejectionReason: req.rejectionReason,
            qualityFlags: req.qualityFlags,
            periodLabel: req.reportingPeriod.label,
          }),
        );
        setDisplayRequests(display);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load requests");
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchRequests();
    }
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500 mx-auto mb-3" />
          <p className="text-slate-600">Loading your requests...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md border-red-200 bg-red-50">
          <div className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
            <h1 className="text-lg font-semibold text-red-900 mb-2">Portal Access Error</h1>
            <p className="text-sm text-red-700 mb-4">{error}</p>
            <p className="text-xs text-red-600">Please contact the organization that sent you this link for help.</p>
          </div>
        </Card>
      </div>
    );
  }

  if (displayRequests.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-4xl mx-auto">
          <Card className="text-center py-12 border-dashed">
            <AlertTriangle className="h-12 w-12 text-amber-600 mx-auto mb-3 opacity-40" />
            <h2 className="text-lg font-semibold text-slate-900 mb-2">No Active Requests</h2>
            <p className="text-sm text-slate-600 max-w-sm mx-auto">
              You don't have any active data requests right now. Check back later or contact the organization directly for
              updates.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  const readinessPercentage = Math.round((displayRequests.filter((r) => r.status === "approved" || r.status === "converted").length / displayRequests.length) * 100);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Your Emissions Data Requests</h1>
          <p className="text-slate-600">Review each request and submit the data when ready.</p>

          {displayRequests.length > 1 && (
            <div className="mt-6 p-4 bg-white rounded-lg border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Completion Status</span>
                <span className="text-2xl font-bold text-orange-600">{readinessPercentage}%</span>
              </div>
              <div className="mt-3 w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-orange-500 to-amber-400 h-full transition-all"
                  style={{ width: `${readinessPercentage}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Requests List */}
        <div className="space-y-4">
          {displayRequests.map((request) => (
            <RequestCard key={request.id} request={request} token={token} />
          ))}
        </div>

        {/* Footer */}
        <div className="mt-12 p-6 bg-white rounded-lg border border-slate-200 text-center">
          <p className="text-sm text-slate-600">
            Questions about what data to submit? Contact the organization directly using the contact information in the data request
            email.
          </p>
        </div>
      </div>
    </div>
  );
}

function RequestCard({ request, token }: { request: RequestDisplayInfo; token: string }) {
  const [isOpen, setIsOpen] = useState(false);

  const statusIcons: Record<string, React.ReactNode> = {
    sent: <Clock className="h-5 w-5 text-slate-400" />,
    opened: <Clock className="h-5 w-5 text-blue-500" />,
    submitted: <Clock className="h-5 w-5 text-amber-500" />,
    flagged: <AlertTriangle className="h-5 w-5 text-orange-600" />,
    approved: <CheckCircle2 className="h-5 w-5 text-green-600" />,
    rejected: <XCircle className="h-5 w-5 text-red-600" />,
    converted: <CheckCircle2 className="h-5 w-5 text-emerald-600" />,
  };

  return (
    <>
      <Card className="overflow-hidden hover:shadow-md transition-shadow">
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 flex-1">
              <div className="flex-shrink-0 mt-1">{statusIcons[request.status] || statusIcons.sent}</div>

              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-slate-900 mb-1">{request.categoryName}</h3>
                <p className="text-sm text-slate-600 mb-3">Period: {request.periodLabel}</p>

                <div className="flex flex-wrap gap-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${request.statusColor}`}>
                    {request.statusLabel}
                  </span>

                  {request.isExpired && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Expired</span>}

                  {!request.isExpired && request.daysUntilExpiry <= 7 && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                      Expires in {request.daysUntilExpiry} day{request.daysUntilExpiry !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                {/* Quality Flags Alert */}
                {request.hasQualityFlags && (
                  <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded text-sm text-orange-800">
                    <div className="flex gap-2">
                      <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">Data Quality Issues Found</p>
                        <p className="text-xs opacity-90 mt-1">Please review the flags and resubmit your data.</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Rejection Reason Alert */}
                {request.hasRejectionReason && request.status === "rejected" && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                    <p className="font-medium mb-1">Reason for Rejection:</p>
                    <p className="text-xs">{request.rejectionReason}</p>
                  </div>
                )}
              </div>
            </div>

            <Button
              onClick={() => setIsOpen(!isOpen)}
              variant="outline"
              className="flex-shrink-0"
              size="sm"
            >
              {isOpen ? "Hide" : "View"}
            </Button>
          </div>

          {/* Details Section */}
          {isOpen && (
            <div className="mt-6 pt-6 border-t border-slate-200 space-y-4">
              {request.submittedAt && (
                <div>
                  <p className="text-xs text-slate-600 uppercase tracking-wide font-medium">Submitted</p>
                  <p className="text-sm text-slate-900 mt-1">{new Date(request.submittedAt).toLocaleDateString()}</p>
                </div>
              )}

              {request.reviewedAt && (
                <div>
                  <p className="text-xs text-slate-600 uppercase tracking-wide font-medium">Reviewed</p>
                  <p className="text-sm text-slate-900 mt-1">{new Date(request.reviewedAt).toLocaleDateString()}</p>
                </div>
              )}

              {request.qualityFlags && request.qualityFlags.length > 0 && (
                <div>
                  <p className="text-xs text-slate-600 uppercase tracking-wide font-medium mb-3">Quality Flags</p>
                  <ul className="space-y-2">
                    {request.qualityFlags.map((flag, i) => (
                      <li key={i} className="p-3 bg-slate-50 rounded text-sm">
                        <div className="flex items-start gap-2">
                          <span className={`text-xs font-bold px-2 py-1 rounded ${flag.severity === "critical" ? "bg-red-200 text-red-700" : "bg-amber-200 text-amber-700"}`}>
                            {flag.severity === "critical" ? "CRITICAL" : "WARNING"}
                          </span>
                          <div className="flex-1">
                            <p className="font-medium text-slate-900">{flag.field}</p>
                            <p className="text-xs text-slate-600 mt-0.5">{flag.message}</p>
                            {flag.suggestedRange && (
                              <p className="text-xs text-slate-500 mt-1">Expected: {flag.suggestedRange.min} – {flag.suggestedRange.max}</p>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {request.canSubmit && (
                <div className="pt-2">
                  <Link href={`/supplier-data/${token}?requestId=${request.id}`}>
                    <Button className="w-full bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-600 hover:to-amber-500 text-white">
                      {request.status === "flagged" || request.status === "rejected" ? "Resubmit Data" : "Submit Data"}
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    </>
  );
}
