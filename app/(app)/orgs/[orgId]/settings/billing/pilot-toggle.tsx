"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface PilotToggleProps {
  orgId: string;
  initialIsPilot: boolean;
}

export function PilotToggle({ orgId, initialIsPilot }: PilotToggleProps) {
  const router = useRouter();
  const [isPilot, setIsPilot] = useState(initialIsPilot);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = async () => {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/orgs/${orgId}/pilot`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPilot: !isPilot }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? "Failed to update pilot status");
      }

      setIsPilot(!isPilot);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-yellow-200 bg-yellow-50">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-yellow-600" />
          Pilot Program
        </CardTitle>
        <CardDescription>
          Pilot organisations have unlimited and unrestricted access to all features
          without billing enforcement.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-900">
              {isPilot ? "Pilot enabled" : "Pilot disabled"}
            </p>
            <p className="text-xs text-slate-600 mt-1">
              Admin only. Changes are audited.
            </p>
          </div>
          <Button
            onClick={handleToggle}
            disabled={loading}
            variant={isPilot ? "destructive" : "default"}
          >
            {loading ? "..." : isPilot ? "Disable" : "Enable"}
          </Button>
        </div>
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      </CardContent>
    </Card>
  );
}
