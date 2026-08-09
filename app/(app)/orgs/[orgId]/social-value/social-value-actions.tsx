"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export type ThemeWithMeasures = {
  code: string;
  name: string;
  measures: {
    id: string;
    tomsCode: string;
    name: string;
    unit: string;
    valuePerUnit: number;
  }[];
};

export type ContractOption = { id: string; name: string };
export type PeriodOption = { id: string; label: string };

interface CreateSocialValueRecordFormProps {
  orgId: string;
  themes: ThemeWithMeasures[];
  contracts: ContractOption[];
  periods: PeriodOption[];
}

function formatGbp(n: number) {
  return `£${n.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function CreateSocialValueRecordForm({
  orgId,
  themes,
  contracts,
  periods,
}: CreateSocialValueRecordFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [contractId, setContractId] = useState(contracts[0]?.id ?? "");
  const [reportingPeriodId, setReportingPeriodId] = useState(periods[0]?.id ?? "");
  const [selectedThemeCode, setSelectedThemeCode] = useState(themes[0]?.code ?? "");
  const [measureId, setMeasureId] = useState<string>(() => {
    const firstTheme = themes[0];
    return firstTheme?.measures[0]?.id ?? "";
  });
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedTheme = themes.find((t) => t.code === selectedThemeCode);
  const selectedMeasure = selectedTheme?.measures.find((m) => m.id === measureId);
  const computedValue =
    selectedMeasure && quantity && !isNaN(Number(quantity))
      ? selectedMeasure.valuePerUnit * Number(quantity)
      : null;

  function handleThemeChange(code: string) {
    setSelectedThemeCode(code);
    const theme = themes.find((t) => t.code === code);
    setMeasureId(theme?.measures[0]?.id ?? "");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contractId || !reportingPeriodId || !measureId || !quantity) {
      setError("All required fields must be filled.");
      return;
    }
    if (Number(quantity) <= 0) {
      setError("Quantity must be a positive number.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/social-value/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractId,
          reportingPeriodId,
          measureId,
          quantity: Number(quantity),
          notes: notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? "Failed to create record.");
      } else {
        setContractId(contracts[0]?.id ?? "");
        setReportingPeriodId(periods[0]?.id ?? "");
        setSelectedThemeCode(themes[0]?.code ?? "");
        setMeasureId(themes[0]?.measures[0]?.id ?? "");
        setQuantity("");
        setNotes("");
        setOpen(false);
        router.refresh();
      }
    } catch {
      setError("Network error — try again.");
    } finally {
      setLoading(false);
    }
  }

  const missingPrereqs = contracts.length === 0 || periods.length === 0 || themes.length === 0;
  if (missingPrereqs) {
    const missing: string[] = [];
    if (contracts.length === 0) missing.push("a contract");
    if (periods.length === 0) missing.push("a reporting period");
    if (themes.length === 0) missing.push("TOMS themes (run db seed)");
    return (
      <div className="flex items-start gap-2 rounded-[10px] border border-amber-200 bg-amber-50 px-4 py-3">
        <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" aria-hidden="true" />
        <p className="text-sm text-amber-800 tracking-[-0.42px]">
          You need {missing.join(", ")} before recording social value.{" "}
          {contracts.length === 0 && (
            <Link
              href={`/orgs/${orgId}/contracts`}
              className="font-medium underline underline-offset-2 hover:text-amber-900"
            >
              Create a contract
            </Link>
          )}
          {periods.length === 0 && (
            <>
              {contracts.length === 0 ? " and " : ""}
              <Link
                href={`/orgs/${orgId}/settings/operations`}
                className="font-medium underline underline-offset-2 hover:text-amber-900"
              >
                add a reporting period
              </Link>
            </>
          )}
          .
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="gap-1.5">
        <Plus aria-hidden="true" className="h-3.5 w-3.5" />
        Add record
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-[14px] border border-[#E5E7EB] p-4"
    >
      <div className="flex flex-wrap items-end gap-3">
        {/* Contract */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[#374151] tracking-[-0.36px]">Contract</label>
          <Select value={contractId} onValueChange={setContractId}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Select contract" />
            </SelectTrigger>
            <SelectContent>
              {contracts.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Reporting period */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[#374151] tracking-[-0.36px]">Period</label>
          <Select value={reportingPeriodId} onValueChange={setReportingPeriodId}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              {periods.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Theme picker (local state only) */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[#374151] tracking-[-0.36px]">Theme</label>
          <Select value={selectedThemeCode} onValueChange={handleThemeChange}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Select theme" />
            </SelectTrigger>
            <SelectContent>
              {themes.map((t) => (
                <SelectItem key={t.code} value={t.code}>
                  {t.code} — {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Measure picker */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[#374151] tracking-[-0.36px]">Measure</label>
          <Select value={measureId} onValueChange={setMeasureId} disabled={!selectedTheme}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select measure" />
            </SelectTrigger>
            <SelectContent>
              {(selectedTheme?.measures ?? []).map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.tomsCode} — {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedMeasure && (
            <p className="text-xs text-[#555555] tracking-[-0.36px]">
              Unit: {selectedMeasure.unit} · {formatGbp(selectedMeasure.valuePerUnit)} per unit
            </p>
          )}
        </div>

        {/* Quantity */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[#374151] tracking-[-0.36px]">Quantity</label>
          <Input
            type="number"
            min="0.0001"
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="e.g. 5"
            className="w-28"
          />
          {computedValue !== null && (
            <p className="text-xs text-[#111827] tracking-[-0.36px] font-medium">
              {"≈"} {formatGbp(computedValue)}
            </p>
          )}
        </div>
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-[#374151] tracking-[-0.36px]">Notes (optional)</label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Supporting notes or evidence references"
          className="h-20 resize-none"
        />
      </div>

      <div className="flex gap-2 items-center">
        <Button type="submit" disabled={loading} size="sm">
          {loading ? "Saving…" : "Save record"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
        {error && (
          <p className="text-sm text-red-600 tracking-[-0.42px]">{error}</p>
        )}
      </div>
    </form>
  );
}

interface DeleteSocialValueRecordButtonProps {
  orgId: string;
  recordId: string;
  label: string;
}

export function DeleteSocialValueRecordButton({
  orgId,
  recordId,
  label,
}: DeleteSocialValueRecordButtonProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!window.confirm(`Delete social value record "${label}"? This cannot be undone.`)) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/orgs/${orgId}/social-value/records/${recordId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? "Could not delete record");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        size="icon"
        variant="outline"
        disabled={isPending}
        title="Delete record"
        onClick={handleDelete}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
