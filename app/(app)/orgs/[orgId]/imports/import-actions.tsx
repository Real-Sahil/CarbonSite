"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Download, ExternalLink, Trash2 } from "lucide-react";

interface ImportBatchActionsProps {
  orgId: string;
  importId: string;
  canCommit: boolean;
  hasErrorExport: boolean;
}

export function ImportBatchActions({
  orgId,
  importId,
  canCommit,
  hasErrorExport,
}: ImportBatchActionsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCommit() {
    setLoading("commit");
    setError(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/imports/${importId}/commit`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? "Commit failed.");
      } else {
        window.location.reload();
      }
    } catch {
      setError("Network error.");
    } finally {
      setLoading(null);
    }
  }

  async function handleDownloadErrors() {
    setLoading("errors");
    try {
      const res = await fetch(`/api/orgs/${orgId}/imports/${importId}/error-export`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `import-errors-${importId}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {canCommit && (
        <Button
          size="sm"
          onClick={handleCommit}
          disabled={loading === "commit"}
          className="gap-1 h-7 text-xs"
        >
          <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
          {loading === "commit" ? "Committing…" : "Commit"}
        </Button>
      )}
      {hasErrorExport && (
        <Button
          size="sm"
          variant="outline"
          onClick={handleDownloadErrors}
          disabled={loading === "errors"}
          className="gap-1 h-7 text-xs"
        >
          <Download aria-hidden="true" className="h-3.5 w-3.5" />
          Error CSV
        </Button>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

interface ImportBatchEvidenceActionsProps {
  orgId: string;
  importId: string;
  files: { id: string; filename: string }[];
}

export function ImportBatchEvidenceActions({
  orgId,
  importId,
  files,
}: ImportBatchEvidenceActionsProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/orgs/${orgId}/imports/${importId}/evidence`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? "Upload failed.");
      } else {
        window.location.reload();
      }
    } catch {
      setError("Network error.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1 min-w-[120px]">
      {files.map((f) => (
        <a
          key={f.id}
          href={`/api/orgs/${orgId}/evidence/${f.id}/download`}
          className="inline-flex items-center gap-1 text-xs text-[#0F172A] hover:underline underline-offset-2 tracking-[-0.36px]"
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLink aria-hidden="true" className="h-3 w-3 shrink-0" />
          {f.filename}
        </a>
      ))}
      <label className="inline-flex cursor-pointer items-center gap-1 text-xs text-[#475569] hover:text-[#0F172A] transition-colors tracking-[-0.36px]">
        <Trash2 aria-hidden="true" className="h-3 w-3 sr-only" />
        <input
          type="file"
          className="sr-only"
          onChange={handleUpload}
          disabled={uploading}
        />
        {uploading ? "Uploading…" : files.length > 0 ? `+${files.length} file${files.length !== 1 ? "s" : ""}` : "Attach file"}
      </label>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
