"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SnapshotDiffModal } from "@/components/snapshot-diff-modal";

type PublishSnapshotButtonProps = {
  orgId: string;
  runId: string;
  /** ID of the current published snapshot for this period, if one exists */
  existingSnapshotId: string | null;
};

export function PublishSnapshotButton({
  orgId,
  runId,
  existingSnapshotId,
}: PublishSnapshotButtonProps) {
  const router = useRouter();
  const [showDiff, setShowDiff] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (existingSnapshotId) {
      // Show diff before confirming
      setShowDiff(true);
    } else {
      // No existing snapshot — publish directly
      doPublish();
    }
  }

  function doPublish() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/orgs/${orgId}/calculation-runs/${runId}/publish-snapshot`, {
          method: "POST",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.message ?? "Failed to publish snapshot");
        }
        setShowDiff(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to publish snapshot");
        setShowDiff(false);
      }
    });
  }

  return (
    <>
      <Button
        onClick={handleClick}
        disabled={isPending}
        className="bg-[#f97316] text-white hover:bg-[#f97316]/90"
        size="sm"
      >
        {isPending ? "Publishing…" : "Publish snapshot"}
      </Button>

      {error && (
        <p className="text-sm text-red-600 mt-2">{error}</p>
      )}

      {showDiff && existingSnapshotId && (
        <SnapshotDiffModal
          orgId={orgId}
          fromSnapshotId={existingSnapshotId}
          toCalculationRunId={runId}
          onConfirm={doPublish}
          onCancel={() => setShowDiff(false)}
        />
      )}
    </>
  );
}
