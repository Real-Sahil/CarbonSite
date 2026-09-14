"use client";

import { useState, useTransition } from "react";
import { Download, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function ReportDownloadActions({
  orgId,
  reportId,
  hasPdf,
  hasCsv,
  hasXml,
  ready,
  isAdmin = false,
}: {
  orgId: string;
  reportId: string;
  hasPdf: boolean;
  hasCsv: boolean;
  hasXml: boolean;
  ready: boolean;
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function download(artifact: "pdf" | "csv" | "xml") {
    setError(null);
    startTransition(async () => {
      const res = await fetch(
        `/api/orgs/${orgId}/reports/${reportId}/download?artifact=${artifact}`,
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? "Could not create download link");
        return;
      }
      const body = (await res.json()) as { downloadUrl: string };
      window.location.assign(body.downloadUrl);
    });
  }

  function deleteReport() {
    if (!window.confirm("Delete this report and its generated files? This cannot be undone.")) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/orgs/${orgId}/reports/${reportId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? "Could not delete report");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!ready || !hasPdf || isPending}
          onClick={() => download("pdf")}
        >
          <Download className="h-4 w-4" />
          PDF
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!ready || !hasCsv || isPending}
          onClick={() => download("csv")}
        >
          <Download className="h-4 w-4" />
          CSV
        </Button>
        {hasXml && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!ready || isPending}
            onClick={() => download("xml")}
          >
            <Download className="h-4 w-4" />
            XML
          </Button>
        )}
        {isAdmin && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isPending}
            title="Delete report and files"
            onClick={deleteReport}
            className="text-red-600 hover:text-red-700 hover:border-red-300"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
      {error && <p className="max-w-48 text-xs text-red-600">{error}</p>}
    </div>
  );
}
