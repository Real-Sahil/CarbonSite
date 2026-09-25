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
      const start = (confirmLibraryCountry: boolean) =>
        fetch(`/api/orgs/${orgId}/calculation-runs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reportingPeriodId, methodologyVersionId, factorLibraryId, confirmLibraryCountry }),
        });
      let res = await start(false);
      if (res.status === 409) {
        const conflict = await res.json().catch(() => ({}));
        if (conflict.code !== "LIBRARY_COUNTRY_MISMATCH" || !window.confirm(conflict.message)) return;
        res = await start(true);
      }
      if (res.ok) router.refresh();
    } catch {
      window.alert("Couldn't reach the server. Check your connection and try again.");
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
