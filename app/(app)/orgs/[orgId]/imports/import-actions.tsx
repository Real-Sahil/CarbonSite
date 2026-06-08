"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle, Download } from "lucide-react";
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

export function ImportBatchActions({
  orgId,
  importId,
  canCommit,
  hasErrorExport,
}: {
  orgId: string;
  importId: string;
  canCommit: boolean;
  hasErrorExport: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function downloadErrors() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/orgs/${orgId}/imports/${importId}/errors/download`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? "Could not create error export link");
        return;
      }

      const body = (await res.json()) as { downloadUrl: string };
      window.location.assign(body.downloadUrl);
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <CommitImportButton
          orgId={orgId}
          importId={importId}
          disabled={!canCommit || isPending}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!hasErrorExport || isPending}
          onClick={downloadErrors}
        >
          <Download className="h-4 w-4" />
          Errors
        </Button>
      </div>
      {error && <p className="max-w-48 text-xs text-red-600">{error}</p>}
    </div>
  );
}
