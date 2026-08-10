"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Trash2 } from "lucide-react";
import { handleSupabaseError } from "@/lib/utils/supabase-error-handler";

interface RecordActionsProps {
  orgId: string;
  recordId: string;
  label: string;
  reviewStatus: string;
  evidenceStatus: string;
  canDelete: boolean;
}

export function RecordActions({
  orgId,
  recordId,
  label,
  reviewStatus,
  canDelete,
}: RecordActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleReview(status: "approved" | "rejected") {
    setLoading(status);
    setError(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/activity-records/${recordId}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewStatus: status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const error = new Error(data.message ?? "Failed.");
        (error as any).status = res.status;
        const { action, message } = handleSupabaseError(error);

        if (action === "logout") {
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

  async function handleDelete() {
    if (!window.confirm(`Delete record "${label}"? This cannot be undone.`)) return;
    setLoading("delete");
    setError(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/activity-records/${recordId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const error = new Error(data.message ?? "Delete failed.");
        (error as any).status = res.status;
        const { action, message } = handleSupabaseError(error);

        if (action === "logout") {
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
    <div className="flex flex-col gap-1.5">
      {reviewStatus !== "approved" && (
        <Button
          size="sm"
          onClick={() => handleReview("approved")}
          disabled={loading === "approved"}
          className="gap-1 h-7 text-xs"
        >
          <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
          {loading === "approved" ? "Approving…" : "Approve"}
        </Button>
      )}
      {reviewStatus !== "rejected" && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleReview("rejected")}
          disabled={loading === "rejected"}
          className="gap-1 h-7 text-xs"
        >
          <XCircle aria-hidden="true" className="h-3.5 w-3.5" />
          {loading === "rejected" ? "Rejecting…" : "Reject"}
        </Button>
      )}
      {canDelete && (
        <Button
          size="sm"
          variant="ghost"
          onClick={handleDelete}
          disabled={loading === "delete"}
          className="gap-1 h-7 text-xs text-red-600 hover:text-red-700"
        >
          <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
          {loading === "delete" ? "Deleting…" : "Delete"}
        </Button>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
