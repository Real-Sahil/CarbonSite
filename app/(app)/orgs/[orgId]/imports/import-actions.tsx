"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CommitImportButton({
  orgId,
  importId,
  disabled,
}: {
  orgId: string;
  importId: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function commitImport() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/orgs/${orgId}/imports/${importId}/commit`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? "Could not commit import");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled || isPending}
        onClick={commitImport}
      >
        <CheckCircle className="h-4 w-4" />
        Commit
      </Button>
      {error && <p className="max-w-44 text-xs text-red-600">{error}</p>}
    </div>
  );
}
