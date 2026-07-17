"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DraftGroup {
  reportingPeriodId: string;
  periodLabel: string;
  count: number;
}

interface BulkRecordActionsProps {
  orgId: string;
  draftGroups: DraftGroup[];
}

// Banner offering one-click approval of draft records per reporting period —
// without this, large legacy imports would need per-record review clicks.
export function BulkRecordActions({ orgId, draftGroups }: BulkRecordActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (draftGroups.length === 0) return null;

  async function approveAll(group: DraftGroup) {
    const confirmed = window.confirm(
      `Approve all ${group.count} draft record(s) in ${group.periodLabel}?\n\n` +
        "Approved records are included in the next calculation run.",
    );
    if (!confirmed) return;
    setLoading(group.reportingPeriodId);
    setError(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/activity-records/bulk-review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewStatus: "approved",
          filter: {
            reportingPeriodId: group.reportingPeriodId,
            currentStatus: "draft",
          },
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? "Bulk approval failed.");
      } else {
        router.refresh();
      }
    } catch {
      setError("Network error — try again.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="mb-6 rounded-[14px] border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-medium text-amber-900 tracking-[-0.42px]">
        Draft records are excluded from calculations
      </p>
      <p className="mt-1 text-xs text-amber-800 tracking-[-0.36px]">
        Review and approve them so they count towards your footprint.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {draftGroups.map((group) => (
          <Button
            key={group.reportingPeriodId}
            size="sm"
            variant="outline"
            className="gap-1.5 border-amber-300 bg-white hover:bg-amber-100"
            disabled={loading !== null}
            onClick={() => approveAll(group)}
          >
            <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-amber-700" />
            {loading === group.reportingPeriodId
              ? "Approving…"
              : `Approve ${group.count} in ${group.periodLabel}`}
          </Button>
        ))}
      </div>
      {error && <p className="mt-2 text-sm text-red-600 tracking-[-0.42px]">{error}</p>}
    </div>
  );
}
