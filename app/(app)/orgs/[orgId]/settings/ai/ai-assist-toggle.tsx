"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function AiAssistToggle({ orgId, enabled, available }: { orgId: string; enabled: boolean; available: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function set(next: boolean) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/orgs/${orgId}/ai-assist`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: next }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("Could not save. Try again.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className={`text-sm font-medium ${enabled ? "text-[#131d29]" : "text-[#5B6A78]"}`}>
        {enabled ? "On" : "Off"}
      </span>
      <Button size="sm" variant={enabled ? "outline" : "default"} disabled={busy || (!available && !enabled)} onClick={() => set(!enabled)}>
        {enabled ? "Turn off" : "Turn on AI assistance"}
      </Button>
      {!available && <span className="text-xs text-[#5B6A78]">No AI provider is configured on this service.</span>}
      {error && <span className="text-xs text-red-700">{error}</span>}
    </div>
  );
}
