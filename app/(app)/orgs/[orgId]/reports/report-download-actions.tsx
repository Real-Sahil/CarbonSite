"use client";

import { useState, useTransition } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReportDownloadActions({
  orgId,
  reportId,
  hasPdf,
  hasCsv,
  hasXml,
  ready,
}: {
  orgId: string;
  reportId: string;
  hasPdf: boolean;
  hasCsv: boolean;
  hasXml: boolean;
  ready: boolean;
}) {
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
      </div>
      {error && <p className="max-w-48 text-xs text-red-600">{error}</p>}
    </div>
  );
}
