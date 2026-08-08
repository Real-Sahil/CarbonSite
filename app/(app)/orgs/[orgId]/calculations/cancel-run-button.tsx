"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface CancelRunButtonProps {
  orgId: string;
  runId: string;
}

export function CancelRunButton({ orgId, runId }: CancelRunButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleCancel() {
    setLoading(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/calculation-runs/${runId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 px-2 text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
      onClick={handleCancel}
      disabled={loading}
    >
      <X className="h-3 w-3 mr-1" />
      Cancel
    </Button>
  );
}
