import { CATEGORY_GUIDANCE } from "./category-guidance";

export type RequestStatus = "sent" | "opened" | "submitted" | "flagged" | "approved" | "rejected" | "converted";

export interface RequestDisplayInfo {
  id: string;
  categoryName: string;
  categoryCode: string;
  status: RequestStatus;
  statusLabel: string;
  statusColor: string;
  periodLabel: string;
  submittedAt?: Date;
  reviewedAt?: Date;
  expiresAt: Date;
  isExpired: boolean;
  daysUntilExpiry: number;
  canSubmit: boolean;
  hasQualityFlags: boolean;
  hasRejectionReason: boolean;
  rejectionReason?: string;
  qualityFlags?: Array<{
    field: string;
    severity: "warning" | "critical";
    message: string;
    suggestedRange?: { min: number; max: number };
  }>;
}

export function formatRequestStatus(status: RequestStatus): { label: string; color: string } {
  const statusMap: Record<RequestStatus, { label: string; color: string }> = {
    sent: { label: "Awaiting Response", color: "bg-slate-100 text-slate-700" },
    opened: { label: "Opened", color: "bg-blue-100 text-blue-700" },
    submitted: { label: "Under Review", color: "bg-amber-100 text-amber-700" },
    flagged: { label: "Needs Revision", color: "bg-orange-100 text-orange-700" },
    approved: { label: "Approved", color: "bg-green-100 text-green-700" },
    rejected: { label: "Rejected", color: "bg-red-100 text-red-700" },
    converted: { label: "Completed", color: "bg-emerald-100 text-emerald-700" },
  };

  return statusMap[status] || { label: status, color: "bg-gray-100 text-gray-700" };
}

export function formatExpiryStatus(expiresAt: Date): {
  isExpired: boolean;
  daysUntilExpiry: number;
  label: string;
} {
  const now = new Date();
  const diffMs = expiresAt.getTime() - now.getTime();
  const daysUntilExpiry = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const isExpired = daysUntilExpiry <= 0;

  let label = "";
  if (isExpired) {
    label = "Expired";
  } else if (daysUntilExpiry === 1) {
    label = "Expires tomorrow";
  } else if (daysUntilExpiry <= 7) {
    label = `Expires in ${daysUntilExpiry} days`;
  } else if (daysUntilExpiry <= 30) {
    const weeks = Math.floor(daysUntilExpiry / 7);
    label = `Expires in ${weeks} week${weeks > 1 ? "s" : ""}`;
  } else {
    label = `Expires in ${Math.ceil(daysUntilExpiry / 30)} month${Math.ceil(daysUntilExpiry / 30) > 1 ? "s" : ""}`;
  }

  return { isExpired, daysUntilExpiry, label };
}

export function getRequestDisplayInfo(params: {
  id: string;
  categoryCode: string;
  status: RequestStatus;
  expiresAt: Date;
  submittedAt?: Date;
  reviewedAt?: Date;
  rejectionReason?: string;
  qualityFlags?: Array<{
    field: string;
    severity: "warning" | "critical";
    message: string;
    suggestedRange?: { min: number; max: number };
  }>;
  periodLabel: string;
}): RequestDisplayInfo {
  const categoryGuidance = CATEGORY_GUIDANCE[params.categoryCode];
  const categoryName = categoryGuidance?.categoryName || params.categoryCode;
  const { label: statusLabel, color: statusColor } = formatRequestStatus(params.status);
  const { isExpired, daysUntilExpiry } = formatExpiryStatus(params.expiresAt);

  // Determine if supplier can submit
  const canSubmit =
    !isExpired && (params.status === "sent" || params.status === "opened" || params.status === "flagged" || params.status === "rejected");

  return {
    id: params.id,
    categoryName,
    categoryCode: params.categoryCode,
    status: params.status,
    statusLabel,
    statusColor,
    periodLabel: params.periodLabel,
    submittedAt: params.submittedAt,
    reviewedAt: params.reviewedAt,
    expiresAt: params.expiresAt,
    isExpired,
    daysUntilExpiry,
    canSubmit,
    hasQualityFlags: !!params.qualityFlags && params.qualityFlags.length > 0,
    hasRejectionReason: !!params.rejectionReason,
    rejectionReason: params.rejectionReason,
    qualityFlags: params.qualityFlags,
  };
}

export function shouldShowQualityFlagsWarning(displayInfo: RequestDisplayInfo): boolean {
  return displayInfo.status === "flagged" && displayInfo.hasQualityFlags;
}

export function shouldShowRejectionFeedback(displayInfo: RequestDisplayInfo): boolean {
  return displayInfo.status === "rejected" && displayInfo.hasRejectionReason;
}

export function getReadinessPercentage(requests: RequestDisplayInfo[]): number {
  if (requests.length === 0) return 0;

  const completed = requests.filter((r) => r.status === "approved" || r.status === "converted").length;
  return Math.round((completed / requests.length) * 100);
}
