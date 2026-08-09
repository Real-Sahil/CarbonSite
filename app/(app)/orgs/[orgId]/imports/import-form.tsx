"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

const TEMPLATE_KEYS = [
  { value: "ghg_protocol_v1", label: "GHG Protocol v1 (default)" },
  { value: "defra_2025", label: "DEFRA 2025 template" },
  { value: "epa_2025", label: "EPA 2025 template" },
];

interface CreateImportFormProps {
  orgId: string;
  periods: { id: string; label: string }[];
}

type Phase = "idle" | "uploading" | "processing" | "done" | "error";

export function CreateImportForm({ orgId, periods }: CreateImportFormProps) {
  const router = useRouter();
  const [periodId, setPeriodId] = useState(periods[0]?.id ?? "");
  const [templateKey, setTemplateKey] = useState(TEMPLATE_KEYS[0].value);
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [resultState, setResultState] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !periodId) {
      setError("Select a file and reporting period.");
      return;
    }
    setPhase("uploading");
    setError(null);
    setResultState(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("reportingPeriodId", periodId);
      form.append("templateKey", templateKey);

      setPhase("processing");
      const res = await fetch(`/api/orgs/${orgId}/imports`, {
        method: "POST",
        body: form,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.message ?? "Upload failed.");
        setPhase("error");
        return;
      }

      const state: string = data.state ?? "parsing";

      if (state === "failed") {
        setError("Import failed during processing. Check the import details for errors.");
        setPhase("error");
        return;
      }

      setResultState(state);
      setPhase("done");
      // Refresh the server component list so the new batch appears
      router.refresh();
    } catch {
      setError("Network error — try again.");
      setPhase("error");
    }
  }

  function reset() {
    setPhase("idle");
    setError(null);
    setResultState(null);
    setFile(null);
  }

  if (periods.length === 0) {
    return (
      <p className="text-sm text-[#475569] tracking-[-0.42px]">
        Create a reporting period before importing data.
      </p>
    );
  }

  if (phase === "done") {
    const label =
      resultState === "ready_to_commit"
        ? "Import processed — rows are staged and ready to review."
        : resultState === "needs_attention"
        ? "Import processed with validation issues — review errors before committing."
        : "Import submitted — processing in the background.";
    return (
      <div className="flex items-start gap-2 rounded-[14px] border border-emerald-200 bg-emerald-50 px-4 py-3">
        <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-600 shrink-0" />
        <div className="flex flex-col gap-1">
          <p className="text-sm text-emerald-800 tracking-[-0.42px]">{label}</p>
          <button
            type="button"
            onClick={reset}
            className="text-xs text-emerald-700 underline underline-offset-2 text-left"
          >
            Import another file
          </button>
        </div>
      </div>
    );
  }

  const busy = phase === "uploading" || phase === "processing";
  const buttonLabel = phase === "uploading" ? "Uploading…" : phase === "processing" ? "Processing…" : "Upload";

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-[#475569] tracking-[-0.36px]">Reporting period</label>
        <Select value={periodId} onValueChange={setPeriodId} disabled={busy}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            {periods.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-[#475569] tracking-[-0.36px]">Template</label>
        <Select value={templateKey} onValueChange={setTemplateKey} disabled={busy}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Select template" />
          </SelectTrigger>
          <SelectContent>
            {TEMPLATE_KEYS.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-[#475569] tracking-[-0.36px]">CSV / XLSX file</label>
        <Input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="w-56 text-sm"
          disabled={busy}
        />
      </div>
      <Button type="submit" disabled={busy || !file} size="sm" className="gap-1.5">
        {busy ? (
          <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Upload aria-hidden="true" className="h-3.5 w-3.5" />
        )}
        {buttonLabel}
      </Button>
      {phase === "error" && error && (
        <div className="w-full flex items-start gap-1.5">
          <AlertCircle className="h-4 w-4 mt-0.5 text-red-500 shrink-0" />
          <p className="text-sm text-red-600 tracking-[-0.42px]">{error}</p>
        </div>
      )}
    </form>
  );
}
