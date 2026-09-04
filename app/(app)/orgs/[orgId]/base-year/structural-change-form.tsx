"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Loader2, Plus } from "lucide-react";

const CHANGE_TYPES = [
  { value: "acquisition", label: "Acquisition" },
  { value: "divestiture", label: "Divestiture" },
  { value: "merger", label: "Merger" },
  { value: "outsourcing", label: "Outsourcing" },
  { value: "insourcing", label: "Insourcing" },
  { value: "methodology_change", label: "Methodology change" },
  { value: "boundary_change", label: "Boundary change" },
  { value: "error_correction", label: "Error correction" },
] as const;

export function RecordStructuralChangeForm({
  orgId,
  entities,
}: {
  orgId: string;
  entities: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<string>("acquisition");
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [legalEntityId, setLegalEntityId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);

  async function submit() {
    if (description.trim().length < 5) {
      setError("Describe the change in at least a few words. It goes on the audit record.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/structural-changes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          effectiveDate,
          description: description.trim(),
          ...(legalEntityId && { legalEntityId }),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? "Could not record the structural change.");
        return;
      }

      const body = (await res.json()) as {
        recalculation: { isSignificant: boolean; deltaPercent: number | null } | null;
      };
      setOutcome(
        body.recalculation
          ? body.recalculation.isSignificant
            ? `Recorded. The base year moved by ${body.recalculation.deltaPercent?.toFixed(2)}%, above the significance threshold, so a restatement is now awaiting approval.`
            : `Recorded. The base year was reassessed and moved by ${body.recalculation.deltaPercent?.toFixed(2)}%, below the threshold, so no restatement is needed. The assessment is kept as evidence.`
          : "Recorded. There is no active base year to assess this against.",
      );
      setOpen(false);
      setDescription("");
      setLegalEntityId("");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (outcome && !open) {
    return (
      <div className="max-w-[60ch] rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm leading-relaxed text-zinc-700">
        {outcome}{" "}
        <button
          onClick={() => {
            setOutcome(null);
            setOpen(true);
          }}
          className="font-medium underline underline-offset-2"
        >
          Record another
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Record change
      </Button>
    );
  }

  return (
    <div className="w-full space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label htmlFor="sc-type" className="block text-sm font-medium text-zinc-700">
            Type
          </label>
          <select
            id="sc-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
          >
            {CHANGE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="sc-date" className="block text-sm font-medium text-zinc-700">
            Effective date
          </label>
          <Input
            id="sc-date"
            type="date"
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="sc-entity" className="block text-sm font-medium text-zinc-700">
            Entity affected
          </label>
          <select
            id="sc-entity"
            value={legalEntityId}
            onChange={(e) => setLegalEntityId(e.target.value)}
            className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
          >
            <option value="">Group wide</option>
            {entities.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="sc-desc" className="block text-sm font-medium text-zinc-700">
          Description
        </label>
        <Textarea
          id="sc-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What changed and why it affects the inventory boundary or methodology."
          rows={2}
        />
      </div>

      {error && (
        <p className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      <p className="text-xs leading-relaxed text-zinc-500">
        Recording this immediately reassesses the active base year and tells you whether the
        change crosses your significance threshold.
      </p>

      <div className="flex gap-2">
        <Button size="sm" onClick={submit} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {saving ? "Assessing" : "Record and assess"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          disabled={saving}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
