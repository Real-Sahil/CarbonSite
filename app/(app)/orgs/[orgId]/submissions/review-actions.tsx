"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, XCircle, MessageCircle } from "lucide-react";
import { handleSupabaseError } from "@/lib/utils/supabase-error-handler";

interface SubmissionReviewActionsProps {
  orgId: string;
  submissionId: string;
  currentEmissionCategoryId: string | null;
  currentFacilityId: string | null;
  emissionCategories: { id: string; scope: number; name: string }[];
  facilities: { id: string; name: string }[];
  disabled?: boolean;
}

export function SubmissionReviewActions({
  orgId,
  submissionId,
  currentEmissionCategoryId,
  currentFacilityId,
  emissionCategories,
  facilities,
  disabled,
}: SubmissionReviewActionsProps) {
  const router = useRouter();
  const [emissionCategoryId, setEmissionCategoryId] = useState(currentEmissionCategoryId ?? "");
  const [facilityId, setFacilityId] = useState(currentFacilityId ?? "");
  const [reviewNote, setReviewNote] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAction(action: "approved" | "rejected" | "needs_info") {
    if (action === "approved" && !emissionCategoryId) {
      setError("Assign an emission category before approving.");
      return;
    }
    setLoading(action);
    setError(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/field-submissions/${submissionId}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          emissionCategoryId: emissionCategoryId || undefined,
          facilityId: facilityId || undefined,
          reviewNote: reviewNote || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const error = new Error(data.message ?? "Review failed.");
        (error as any).status = res.status;
        const { action: errorAction, message } = handleSupabaseError(error);

        if (errorAction === "logout") {
          localStorage.removeItem("session");
          router.push("/auth/sign-in");
          return;
        }

        setError(message);
      } else {
        router.refresh();
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {emissionCategories.length > 0 && (
        <div className="flex flex-wrap gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#374151] tracking-[-0.36px]">Emission category</label>
            <Select value={emissionCategoryId} onValueChange={setEmissionCategoryId} disabled={disabled}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {emissionCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>Scope {c.scope}: {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {facilities.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#374151] tracking-[-0.36px]">Facility (optional)</label>
              <Select value={facilityId} onValueChange={setFacilityId} disabled={disabled}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  {facilities.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-[#374151] tracking-[-0.36px]">Review note (optional)</label>
        <Textarea
          value={reviewNote}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReviewNote(e.target.value)}
          placeholder="Add a note for the field worker or audit trail…"
          disabled={disabled}
          rows={3}
          className="resize-none text-sm"
        />
      </div>
      <div className="flex gap-3">
        <Button
          onClick={() => handleAction("approved")}
          disabled={disabled || loading === "approved"}
          size="sm"
          className="gap-1.5"
        >
          <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
          {loading === "approved" ? "Approving…" : "Approve"}
        </Button>
        <Button
          variant="outline"
          onClick={() => handleAction("rejected")}
          disabled={disabled || loading === "rejected"}
          size="sm"
          className="gap-1.5"
        >
          <XCircle aria-hidden="true" className="h-4 w-4" />
          {loading === "rejected" ? "Rejecting…" : "Reject"}
        </Button>
        <Button
          variant="outline"
          onClick={() => handleAction("needs_info")}
          disabled={disabled || loading === "needs_info"}
          size="sm"
          className="gap-1.5"
        >
          <MessageCircle aria-hidden="true" className="h-4 w-4" />
          {loading === "needs_info" ? "Sending…" : "Needs info"}
        </Button>
      </div>
      {error && <p className="text-sm text-red-600 tracking-[-0.42px]">{error}</p>}
    </div>
  );
}
