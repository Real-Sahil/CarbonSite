"use client";

import { useState } from "react";
import { ExternalLink, Paperclip } from "lucide-react";

interface RecordEvidenceActionsProps {
  orgId: string;
  recordId: string;
  files: { id: string; filename: string }[];
  canManage: boolean;
}

export function RecordEvidenceActions({
  orgId,
  recordId,
  files,
  canManage,
}: RecordEvidenceActionsProps) {
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
      const res = await fetch(`/api/orgs/${orgId}/activity-records/${recordId}/evidence`, {
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
    <div className="flex flex-col gap-1 min-w-[100px]">
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
      {canManage && (
        <label className="inline-flex cursor-pointer items-center gap-1 text-xs text-[#475569] hover:text-[#0F172A] transition-colors tracking-[-0.36px]">
          <Paperclip aria-hidden="true" className="h-3 w-3" />
          <span>{uploading ? "Uploading…" : "Attach"}</span>
          <input type="file" className="sr-only" onChange={handleUpload} disabled={uploading} />
        </label>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
