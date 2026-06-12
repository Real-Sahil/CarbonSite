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
import { Plus } from "lucide-react";

const TARGET_TYPES = [
  { value: "absolute", label: "Absolute reduction" },
  { value: "intensity", label: "Intensity reduction" },
  { value: "science_based", label: "Science-based" },
];

interface CreateTargetFormProps {
  orgId: string;
  periods: { id: string; label: string }[];
}

export function CreateTargetForm({ orgId, periods }: CreateTargetFormProps) {
  const [open, setOpen] = useState(false);
  const [targetType, setTargetType] = useState(TARGET_TYPES[0].value);
  const [baselinePeriodId, setBaselinePeriodId] = useState(periods[0]?.id ?? "");
  const [targetPeriodId, setTargetPeriodId] = useState(periods[1]?.id ?? periods[0]?.id ?? "");
  const [reductionAmount, setReductionAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!baselinePeriodId || !targetPeriodId || !reductionAmount) {
      setError("All fields are required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/targets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType,
          baselinePeriodId,
          targetPeriodId,
          reductionAmount: parseFloat(reductionAmount),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? "Failed to create target.");
      } else {
        window.location.reload();
      }
    } catch {
      setError("Network error — try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="gap-1.5">
        <Plus aria-hidden="true" className="h-3.5 w-3.5" />
        Add target
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-[14px] border border-[#e5e7eb] p-4">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-[#333333] tracking-[-0.36px]">Type</label>
        <Select value={targetType} onValueChange={setTargetType}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TARGET_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-[#333333] tracking-[-0.36px]">Baseline period</label>
        <Select value={baselinePeriodId} onValueChange={setBaselinePeriodId}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            {periods.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-[#333333] tracking-[-0.36px]">Target period</label>
        <Select value={targetPeriodId} onValueChange={setTargetPeriodId}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            {periods.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-[#333333] tracking-[-0.36px]">Reduction (kgCO2e)</label>
        <Input
          type="number"
          min="0"
          step="any"
          value={reductionAmount}
          onChange={(e) => setReductionAmount(e.target.value)}
          placeholder="e.g. 10000"
          className="w-32"
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={loading} size="sm">
          {loading ? "Saving…" : "Save"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
      {error && <p className="w-full text-sm text-red-600 tracking-[-0.42px]">{error}</p>}
    </form>
  );
}

const INITIATIVE_STATUSES = [
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In progress" },
  { value: "complete", label: "Complete" },
  { value: "cancelled", label: "Cancelled" },
];

interface CreateInitiativeFormProps {
  orgId: string;
  members: { userId: string; label: string }[];
}

export function CreateInitiativeForm({ orgId, members }: CreateInitiativeFormProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [status, setStatus] = useState(INITIATIVE_STATUSES[0].value);
  const [ownerId, setOwnerId] = useState(members[0]?.userId ?? "");
  const [expectedImpact, setExpectedImpact] = useState("");
  const [costAmount, setCostAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/initiatives`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          status,
          ownerUserId: ownerId || undefined,
          expectedImpactCo2e: expectedImpact ? parseFloat(expectedImpact) : undefined,
          costAmount: costAmount ? parseFloat(costAmount) : undefined,
          costCurrency: "GBP",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? "Failed to create initiative.");
      } else {
        window.location.reload();
      }
    } catch {
      setError("Network error — try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="gap-1.5">
        <Plus aria-hidden="true" className="h-3.5 w-3.5" />
        Add initiative
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-[14px] border border-[#e5e7eb] p-4">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-[#333333] tracking-[-0.36px]">Name</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Switch to EVs" className="w-52" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-[#333333] tracking-[-0.36px]">Status</label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INITIATIVE_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {members.length > 0 && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[#333333] tracking-[-0.36px]">Owner</label>
          <Select value={ownerId} onValueChange={setOwnerId}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Optional" />
            </SelectTrigger>
            <SelectContent>
              {members.map((m) => <SelectItem key={m.userId} value={m.userId}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-[#333333] tracking-[-0.36px]">Expected impact (kgCO2e)</label>
        <Input type="number" min="0" step="any" value={expectedImpact} onChange={(e) => setExpectedImpact(e.target.value)} placeholder="Optional" className="w-36" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-[#333333] tracking-[-0.36px]">Cost (GBP)</label>
        <Input type="number" min="0" step="any" value={costAmount} onChange={(e) => setCostAmount(e.target.value)} placeholder="Optional" className="w-28" />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={loading} size="sm">
          {loading ? "Saving…" : "Save"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
      {error && <p className="w-full text-sm text-red-600 tracking-[-0.42px]">{error}</p>}
    </form>
  );
}
