"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Loader2, Plus } from "lucide-react";

export function CreateBaseYearForm({
  orgId,
  periods,
}: {
  orgId: string;
  periods: Array<{ id: string; label: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reportingPeriodId, setReportingPeriodId] = useState(periods[0]?.id ?? "");
  const [label, setLabel] = useState("");
  const [rationale, setRationale] = useState("");
  const [threshold, setThreshold] = useState("5");
  const [activateNow, setActivateNow] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!reportingPeriodId) {
      setError("Choose the reporting period this base year covers.");
      return;
    }
    if (!label.trim()) {
      setError("Give the base year a label, for example 2024 baseline.");
      return;
    }
    const pct = Number(threshold);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      setError("The significance threshold must be a percentage between 0 and 100.");
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/base-years`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportingPeriodId,
          label: label.trim(),
          ...(rationale.trim() && { rationale: rationale.trim() }),
          significanceThresholdPercent: pct,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? "Could not declare the base year.");
        return;
      }

      if (activateNow) {
        const created = (await res.json()) as { id: string };
        const activate = await fetch(`/api/orgs/${orgId}/base-years/${created.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "active" }),
        });
        if (!activate.ok) {
          const body = (await activate.json().catch(() => ({}))) as { message?: string };
          setError(
            body.message ?? "Base year was created but could not be activated. Activate it manually.",
          );
          router.refresh();
          return;
        }
      }

      setOpen(false);
      setLabel("");
      setRationale("");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (periods.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Create a reporting period before declaring a base year.
      </p>
    );
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Declare base year
      </Button>
    );
  }

  return (
    <div className="w-full space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="by-period" className="block text-sm font-medium text-zinc-700">
            Reporting period
          </label>
          <select
            id="by-period"
            value={reportingPeriodId}
            onChange={(e) => setReportingPeriodId(e.target.value)}
            className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
          >
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="by-label" className="block text-sm font-medium text-zinc-700">
            Label
          </label>
          <Input
            id="by-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="2024 baseline"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="by-threshold" className="block text-sm font-medium text-zinc-700">
            Significance threshold
          </label>
          <Input
            id="by-threshold"
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
          />
          <p className="text-xs text-zinc-500">
            Percentage change in the base year total that obliges a restatement. Five percent is
            the common policy.
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="by-rationale" className="block text-sm font-medium text-zinc-700">
          Rationale
        </label>
        <Textarea
          id="by-rationale"
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          placeholder="Why this year was chosen as the baseline. Assurance will ask."
          rows={2}
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-zinc-700">
        <input
          type="checkbox"
          checked={activateNow}
          onChange={(e) => setActivateNow(e.target.checked)}
          className="h-4 w-4 accent-zinc-900"
        />
        Make this the active baseline, superseding any current one
      </label>

      {error && (
        <p className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      <p className="text-xs leading-relaxed text-zinc-500">
        The period totals are frozen on creation. Those original figures are never rewritten, so
        the platform can always show what was first published alongside what it has since become.
      </p>

      <div className="flex gap-2">
        <Button size="sm" onClick={submit} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {saving ? "Saving" : "Declare base year"}
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
