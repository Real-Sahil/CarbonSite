"use client";

import { useState, useTransition } from "react";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";

type EvidenceFile = {
  id: string;
  filename: string;
};

export function SubmissionEvidenceDownloads({
  orgId,
  files,
}: {
  orgId: string;
  files: EvidenceFile[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function download(evidenceId: string) {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/orgs/${orgId}/evidence/${evidenceId}/download`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? "Could not prepare evidence download");
        return;
      }

      const body = (await res.json()) as { downloadUrl: string };
      window.location.assign(body.downloadUrl);
    });
  }

  if (files.length === 0) {
    return <span className="text-slate-400 italic">No files</span>;
  }

  return (
    <div className="flex max-w-48 flex-col gap-1">
      {files.map((file) => (
        <Button
          key={file.id}
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 justify-start px-2 text-slate-700"
          title={`Download ${file.filename}`}
          disabled={isPending}
          onClick={() => download(file.id)}
        >
          <FileDown className="h-4 w-4" />
          <span className="truncate">{file.filename}</span>
        </Button>
      ))}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
