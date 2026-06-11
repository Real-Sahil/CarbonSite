"use client";

import { ChangeEvent, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  EVIDENCE_ACCEPT_ATTRIBUTE,
  EVIDENCE_MAX_BYTES,
} from "@/lib/evidence/upload-policy";

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

type ImportEvidenceFile = {
  id: string;
  filename: string;
};

export function ImportBatchEvidenceActions({
  orgId,
  importId,
  files,
}: {
  orgId: string;
  importId: string;
  files: ImportEvidenceFile[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function download(evidenceId: string) {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/orgs/${orgId}/evidence/${evidenceId}/download`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? "Could not create evidence download link");
        return;
      }
      const body = (await res.json()) as { downloadUrl: string };
      window.location.assign(body.downloadUrl);
    });
  }

  function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);
    if (!EVIDENCE_ACCEPT_ATTRIBUTE.split(",").includes(file.type)) {
      setError("Choose a PDF, image, CSV or XLSX evidence file.");
      return;
    }
    if (file.size > EVIDENCE_MAX_BYTES) {
      setError("Evidence files must be 25 MB or smaller.");
      return;
    }

    startTransition(async () => {
      try {
        const bytes = await file.arrayBuffer();
        const checksum = await sha256(bytes);
        const presignRes = await fetch(`/api/orgs/${orgId}/evidence`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
            byteSize: file.size,
            checksum,
          }),
        });
        if (!presignRes.ok) {
          const body = await presignRes.json().catch(() => null);
          throw new Error(body?.message ?? "Could not create upload link");
        }

        const presignBody = (await presignRes.json()) as {
          evidence: { id: string };
          uploadUrl: string;
        };
        const uploadRes = await fetch(presignBody.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!uploadRes.ok) {
          throw new Error("Evidence file upload failed");
        }

        const attachRes = await fetch(
          `/api/orgs/${orgId}/imports/${importId}/evidence`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ evidenceId: presignBody.evidence.id }),
          },
        );
        if (!attachRes.ok) {
          const body = await attachRes.json().catch(() => null);
          throw new Error(body?.message ?? "Could not attach evidence to import");
        }
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not upload evidence");
      }
    });
  }

  return (
    <div className="flex min-w-48 flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1">
        {files.length === 0 ? (
          <span className="text-slate-400 italic">No files</span>
        ) : (
          files.map((file) => (
            <Button
              key={file.id}
              type="button"
              size="sm"
              variant="ghost"
              title={`Download ${file.filename}`}
              disabled={isPending}
              className="h-8 max-w-40 justify-start px-2"
              onClick={() => download(file.id)}
            >
              <Download className="h-4 w-4" />
              <span className="truncate">{file.filename}</span>
            </Button>
          ))
        )}
        <input
          ref={fileRef}
          type="file"
          accept={EVIDENCE_ACCEPT_ATTRIBUTE}
          className="hidden"
          onChange={upload}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          Attach
        </Button>
      </div>
      {error && <p className="max-w-48 text-xs text-red-600">{error}</p>}
    </div>
  );
}

async function sha256(buffer: ArrayBuffer) {
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(hash)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}
