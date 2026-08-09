"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface Props {
  orgId: string;
  orgName: string;
}

export function ResetOrgButton({ orgId, orgName }: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "confirm" | "loading" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleReset() {
    setPhase("loading");
    setError(null);
    try {
      const res = await fetch(`/api/platform/orgs/${orgId}/reset`, { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.message ?? "Reset failed.");
        setPhase("confirm");
        return;
      }
      setPhase("done");
      router.refresh();
    } catch {
      setError("Network error — try again.");
      setPhase("confirm");
    }
  }

  if (phase === "idle") {
    return (
      <Button
        size="sm"
        variant="destructive"
        className="gap-1.5"
        onClick={() => setPhase("confirm")}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Reset org data
      </Button>
    );
  }

  if (phase === "confirm") {
    return (
      <div className="flex flex-col gap-2 rounded-[14px] border border-red-200 bg-red-50 p-4">
        <p className="text-sm font-medium text-red-900">
          Reset all activity data for {orgName}?
        </p>
        <p className="text-xs text-red-700">
          This permanently deletes all activity records, calculations, imports, field submissions, and reports.
          The org, members, reporting periods, sites, and contracts are kept.
          This cannot be undone.
        </p>
        {error && <p className="text-xs text-red-700 font-medium">{error}</p>}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="destructive"
            onClick={handleReset}
          >
            Yes, delete everything
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setPhase("idle"); setError(null); }}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "loading") {
    return (
      <p className="text-sm text-[#475569] tracking-[-0.42px] animate-pulse">
        Deleting org data…
      </p>
    );
  }

  return (
    <p className="text-sm text-emerald-700 tracking-[-0.42px]">
      Org data cleared. All activity records and calculations deleted.
    </p>
  );
}
