"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface RetryCalculationButtonProps {
  orgId: string;
  reportingPeriodId: string;
  methodologyVersionId: string;
  factorLibraryId: string;
}

export function RetryCalculationButton({
  orgId,
  reportingPeriodId,
  methodologyVersionId,
  factorLibraryId,
}: RetryCalculationButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleRetry() {
    setLoading(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/calculation-runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportingPeriodId, methodologyVersionId, factorLibraryId }),
      });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 px-2 text-xs text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
      onClick={handleRetry}
      disabled={loading}
    >
      <RefreshCw className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`} />
      Retry
    </Button>
  );
}
