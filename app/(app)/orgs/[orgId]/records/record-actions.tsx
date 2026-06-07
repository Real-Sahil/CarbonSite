"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const REVIEW_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "in_review", label: "In review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
] as const;

const EVIDENCE_STATUSES = [
  { value: "missing", label: "Missing" },
  { value: "partial", label: "Partial" },
  { value: "complete", label: "Complete" },
] as const;

export function RecordActions({
  orgId,
  recordId,
  label,
  reviewStatus,
  evidenceStatus,
  canDelete,
}: {
  orgId: string;
  recordId: string;
  label: string;
  reviewStatus: string;
  evidenceStatus: string;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [review, setReview] = useState(reviewStatus);
  const [evidence, setEvidence] = useState(evidenceStatus);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const changed = review !== reviewStatus || evidence !== evidenceStatus;

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/orgs/${orgId}/records/${recordId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewStatus: review,
          evidenceStatus: evidence,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? "Could not update record");
        return;
      }

      router.refresh();
    });
  }

  function remove() {
    const confirmed = window.confirm(
      `Delete ${label}? Records with calculation history cannot be deleted.`,
    );
    if (!confirmed) return;

    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/orgs/${orgId}/records/${recordId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? "Could not delete record");
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="flex min-w-64 flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <select
          value={review}
          disabled={isPending}
          aria-label={`Review status for ${label}`}
          onChange={(event) => setReview(event.target.value)}
          className={selectClass}
        >
          {REVIEW_STATUSES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <select
          value={evidence}
          disabled={isPending}
          aria-label={`Evidence status for ${label}`}
          onChange={(event) => setEvidence(event.target.value)}
          className={selectClass}
        >
          {EVIDENCE_STATUSES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <Button
          type="button"
          size="icon"
          variant="outline"
          title="Save record status"
          disabled={isPending || !changed}
          onClick={save}
        >
          <Save className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          title="Delete record"
          disabled={isPending || !canDelete}
          onClick={remove}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

const selectClass =
  "h-9 rounded-md border border-slate-200 bg-white px-2 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50";
