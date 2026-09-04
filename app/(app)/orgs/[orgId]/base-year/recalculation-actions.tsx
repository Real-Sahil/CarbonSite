"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export function ResolveRecalculationButtons({
  orgId,
  recalculationId,
}: {
  orgId: string;
  recalculationId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resolve(decision: "approve" | "reject") {
    setBusy(decision);
    setError(null);
    try {
      const res = await fetch(
        `/api/orgs/${orgId}/base-year-recalculations/${recalculationId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? "Could not resolve the recalculation.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex gap-1.5">
        <Button size="sm" onClick={() => resolve("approve")} disabled={busy !== null}>
          {busy === "approve" && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
          Restate
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => resolve("reject")}
          disabled={busy !== null}
        >
          {busy === "reject" && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
          Reject
        </Button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
