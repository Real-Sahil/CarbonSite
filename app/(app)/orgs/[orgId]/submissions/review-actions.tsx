"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, HelpCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SelectOption = {
  id: string;
  name: string;
  scope?: number;
};

export function SubmissionReviewActions({
  orgId,
  submissionId,
  currentEmissionCategoryId,
  currentFacilityId,
  emissionCategories,
  facilities,
  disabled,
}: {
  orgId: string;
  submissionId: string;
  currentEmissionCategoryId?: string | null;
  currentFacilityId?: string | null;
  emissionCategories: SelectOption[];
  facilities: SelectOption[];
  disabled: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [emissionCategoryId, setEmissionCategoryId] = useState(
    currentEmissionCategoryId ?? "",
  );
  const [facilityId, setFacilityId] = useState(currentFacilityId ?? "");
  const [reviewNote, setReviewNote] = useState("");
  const [isPending, startTransition] = useTransition();

  function review(status: "approved" | "rejected" | "needs_info") {
    setError(null);
    if (status === "approved" && !emissionCategoryId) {
      setError("Choose an emission category before approving.");
      return;
    }
    startTransition(async () => {
      const res = await fetch(
        `/api/orgs/${orgId}/field-submissions/${submissionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            emissionCategoryId: emissionCategoryId || undefined,
            facilityId: facilityId || null,
            reviewNote: reviewNote.trim() || undefined,
          }),
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
    <div className="flex min-w-64 flex-col gap-2">
      <Select
        value={emissionCategoryId || "__none"}
        disabled={disabled || isPending}
        onValueChange={(value) =>
          setEmissionCategoryId(value === "__none" ? "" : value)
        }
      >
        <SelectTrigger className="h-8">
          <SelectValue placeholder="Emission category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none">Choose category</SelectItem>
          {emissionCategories.map((category) => (
            <SelectItem key={category.id} value={category.id}>
              Scope {category.scope}: {category.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={facilityId || "__none"}
        disabled={disabled || isPending}
        onValueChange={(value) => setFacilityId(value === "__none" ? "" : value)}
      >
        <SelectTrigger className="h-8">
          <SelectValue placeholder="Facility" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none">No facility</SelectItem>
          {facilities.map((facility) => (
            <SelectItem key={facility.id} value={facility.id}>
              {facility.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <textarea
        value={reviewNote}
        disabled={disabled || isPending}
        onChange={(event) => setReviewNote(event.target.value)}
        placeholder="Review note"
        className="min-h-16 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-green-700 disabled:cursor-not-allowed disabled:opacity-50"
      />
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
