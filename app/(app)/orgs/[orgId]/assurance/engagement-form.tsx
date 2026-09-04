"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, Loader2, Plus } from "lucide-react";

export function CreateEngagementForm({
  orgId,
  periods,
}: {
  orgId: string;
  periods: Array<{ id: string; label: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reportingPeriodId, setReportingPeriodId] = useState(periods[0]?.id ?? "");
  const [standard, setStandard] = useState("isae_3000");
  const [level, setLevel] = useState("limited");
  const [providerName, setProviderName] = useState("");
  const [leadAssurorName, setLeadAssurorName] = useState("");
  const [leadAssurorEmail, setLeadAssurorEmail] = useState("");
  const [materialityThresholdPercent, setMaterialityThresholdPercent] = useState("5");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!reportingPeriodId) {
      setError("Choose the reporting period this engagement covers.");
      return;
    }
    if (!providerName.trim() || !leadAssurorName.trim()) {
      setError("Provider and lead assuror name are required.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/assurance/engagements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportingPeriodId,
          standard,
          level,
          providerName: providerName.trim(),
          leadAssurorName: leadAssurorName.trim(),
          ...(leadAssurorEmail.trim() && { leadAssurorEmail: leadAssurorEmail.trim() }),
          materialityThresholdPercent: Number(materialityThresholdPercent),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? "Could not create the engagement.");
        return;
      }
      const created = (await res.json()) as { id: string };
      router.push(`/orgs/${orgId}/assurance/${created.id}`);
    } catch {
      setError("Network error. Try again.");
      setSaving(false);
    }
  }

  if (periods.length === 0) {
    return <p className="text-sm text-zinc-500">Create a reporting period before starting an engagement.</p>;
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        New engagement
      </Button>
    );
  }

  return (
    <div className="w-full space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <label htmlFor="e-period" className="block text-sm font-medium text-zinc-700">
            Reporting period
          </label>
          <select
            id="e-period"
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
          <label htmlFor="e-standard" className="block text-sm font-medium text-zinc-700">
            Standard
          </label>
          <select
            id="e-standard"
            value={standard}
            onChange={(e) => setStandard(e.target.value)}
            className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
          >
            <option value="isae_3000">ISAE 3000</option>
            <option value="iso_14064_3">ISO 14064-3</option>
            <option value="aa1000as">AA1000AS</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="e-level" className="block text-sm font-medium text-zinc-700">
            Level
          </label>
          <select
            id="e-level"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
          >
            <option value="limited">Limited (negative)</option>
            <option value="reasonable">Reasonable (positive)</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="e-provider" className="block text-sm font-medium text-zinc-700">
            Provider
          </label>
          <Input
            id="e-provider"
            value={providerName}
            onChange={(e) => setProviderName(e.target.value)}
            placeholder="Bureau Veritas"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="e-lead" className="block text-sm font-medium text-zinc-700">
            Lead assuror
          </label>
          <Input
            id="e-lead"
            value={leadAssurorName}
            onChange={(e) => setLeadAssurorName(e.target.value)}
            placeholder="Name of the reviewing assuror"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="e-email" className="block text-sm font-medium text-zinc-700">
            Assuror email
          </label>
          <Input
            id="e-email"
            type="email"
            value={leadAssurorEmail}
            onChange={(e) => setLeadAssurorEmail(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="e-materiality" className="block text-sm font-medium text-zinc-700">
            Materiality threshold
          </label>
          <div className="flex items-center gap-2">
            <Input
              id="e-materiality"
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={materialityThresholdPercent}
              onChange={(e) => setMaterialityThresholdPercent(e.target.value)}
            />
            <span className="text-sm text-zinc-500">%</span>
          </div>
        </div>
      </div>

      {error && (
        <p className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button size="sm" onClick={submit} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {saving ? "Creating" : "Create engagement"}
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
