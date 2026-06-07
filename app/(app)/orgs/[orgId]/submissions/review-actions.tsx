"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, HelpCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SubmissionReviewActions({
  orgId,
  submissionId,
  disabled,
}: {
  orgId: string;
  submissionId: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function review(status: "approved" | "rejected" | "needs_info") {
    setError(null);
    startTransition(async () => {
      const res = await fetch(
        `/api/orgs/${orgId}/field-submissions/${submissionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? "Review action failed");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <Button
          type="button"
          size="icon"
          variant="outline"
          disabled={disabled || isPending}
          title="Approve"
          onClick={() => review("approved")}
        >
          <Check className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          disabled={disabled || isPending}
          title="Needs info"
          onClick={() => review("needs_info")}
        >
          <HelpCircle className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          disabled={disabled || isPending}
          title="Reject"
          onClick={() => review("rejected")}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
