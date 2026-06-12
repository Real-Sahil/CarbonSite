"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload } from "lucide-react";

const TEMPLATE_KEYS = [
  { value: "ghg_protocol_v1", label: "GHG Protocol v1 (default)" },
  { value: "defra_2025", label: "DEFRA 2025 template" },
  { value: "epa_2025", label: "EPA 2025 template" },
];

interface CreateImportFormProps {
  orgId: string;
  periods: { id: string; label: string }[];
}

export function CreateImportForm({ orgId, periods }: CreateImportFormProps) {
  const [periodId, setPeriodId] = useState(periods[0]?.id ?? "");
  const [templateKey, setTemplateKey] = useState(TEMPLATE_KEYS[0].value);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !periodId) {
      setError("Select a file and reporting period.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("reportingPeriodId", periodId);
      form.append("templateKey", templateKey);
      const res = await fetch(`/api/orgs/${orgId}/imports`, {
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
      setError("Network error — try again.");
    } finally {
      setLoading(false);
    }
  }

  if (periods.length === 0) {
    return (
      <p className="text-sm text-[#333333] tracking-[-0.42px]">
        Create a reporting period before importing data.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-[#333333] tracking-[-0.36px]">Reporting period</label>
        <Select value={periodId} onValueChange={setPeriodId}>
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
        <label className="text-xs text-[#333333] tracking-[-0.36px]">Template</label>
        <Select value={templateKey} onValueChange={setTemplateKey}>
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
        <label className="text-xs text-[#333333] tracking-[-0.36px]">CSV / XLSX file</label>
        <Input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="w-56 text-sm"
        />
      </div>
      <Button type="submit" disabled={loading || !file} size="sm" className="gap-1.5">
        <Upload aria-hidden="true" className="h-3.5 w-3.5" />
        {loading ? "Uploading…" : "Upload"}
      </Button>
      {error && <p className="w-full text-sm text-red-600 tracking-[-0.42px]">{error}</p>}
    </form>
  );
}
