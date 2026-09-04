"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, Plus } from "lucide-react";

// Enum values must match prisma schema exactly: absolute | intensity
const TARGET_TYPES = [
  { value: "absolute", label: "Absolute reduction (kgCO2e)" },
  { value: "intensity", label: "Intensity reduction (per unit of output)" },
];

// Radix Select rejects an empty-string item value, so an explicit "no
// selection" option needs its own sentinel translated back to "" on change.
const NONE = "__none__";

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

  if (periods.length === 0) {
    return (
      <div className="flex items-start gap-2 rounded-[10px] border border-amber-200 bg-amber-50 px-4 py-3">
        <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" aria-hidden="true" />
        <p className="text-sm text-amber-800 tracking-[-0.42px]">
          No reporting periods found.{" "}
          <Link
            href={`/orgs/${orgId}/settings/operations`}
            className="font-medium underline underline-offset-2 hover:text-amber-900"
          >
            Create one in Settings → Operations
          </Link>{" "}
          before setting reduction targets.
        </p>
      </div>
    );
  }

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
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-[14px] border border-[#E5E7EB] p-4">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-[#374151] tracking-[-0.36px]">Type</label>
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
        <label className="text-xs text-[#374151] tracking-[-0.36px]">Baseline period</label>
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
        <label className="text-xs text-[#374151] tracking-[-0.36px]">Target period</label>
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
        <label className="text-xs text-[#374151] tracking-[-0.36px]">Reduction (kgCO2e)</label>
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
  facilities: { id: string; name: string }[];
  categories: { id: string; code: string; name: string }[];
  targets: { id: string; label: string }[];
}

export function CreateInitiativeForm({ orgId, members, facilities, categories, targets }: CreateInitiativeFormProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [status, setStatus] = useState(INITIATIVE_STATUSES[0].value);
  const [ownerId, setOwnerId] = useState(members[0]?.userId ?? "");
  const [expectedImpact, setExpectedImpact] = useState("");
  const [costAmount, setCostAmount] = useState("");
  const [opexDeltaAnnual, setOpexDeltaAnnual] = useState("");
  const [lifetimeYears, setLifetimeYears] = useState("");
  const [facilityId, setFacilityId] = useState("");
  const [emissionCategoryId, setEmissionCategoryId] = useState("");
  const [reductionTargetId, setReductionTargetId] = useState("");
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
          opexDeltaAnnual: opexDeltaAnnual ? parseFloat(opexDeltaAnnual) : undefined,
          lifetimeYears: lifetimeYears ? parseInt(lifetimeYears, 10) : undefined,
          facilityId: facilityId || undefined,
          emissionCategoryId: emissionCategoryId || undefined,
          reductionTargetId: reductionTargetId || undefined,
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
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-[14px] border border-[#E5E7EB] p-4">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-[#374151] tracking-[-0.36px]">Name</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Switch to EVs" className="w-52" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-[#374151] tracking-[-0.36px]">Status</label>
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
          <label className="text-xs text-[#374151] tracking-[-0.36px]">Owner</label>
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
        <label className="text-xs text-[#374151] tracking-[-0.36px]">Expected impact (kgCO2e)</label>
        <Input type="number" min="0" step="any" value={expectedImpact} onChange={(e) => setExpectedImpact(e.target.value)} placeholder="Optional" className="w-36" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-[#374151] tracking-[-0.36px]">Capital cost (GBP)</label>
        <Input type="number" min="0" step="any" value={costAmount} onChange={(e) => setCostAmount(e.target.value)} placeholder="Optional" className="w-28" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-[#374151] tracking-[-0.36px]">Annual opex change (GBP)</label>
        <Input type="number" step="any" value={opexDeltaAnnual} onChange={(e) => setOpexDeltaAnnual(e.target.value)} placeholder="Negative = saves money" className="w-40" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-[#374151] tracking-[-0.36px]">Lifetime (years)</label>
        <Input type="number" min="1" step="1" value={lifetimeYears} onChange={(e) => setLifetimeYears(e.target.value)} placeholder="Optional" className="w-24" />
      </div>
      {facilities.length > 0 && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[#374151] tracking-[-0.36px]">Facility</label>
          <Select value={facilityId || NONE} onValueChange={(v) => setFacilityId(v === NONE ? "" : v)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Org-wide" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Org-wide</SelectItem>
              {facilities.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      {categories.length > 0 && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[#374151] tracking-[-0.36px]">Category</label>
          <Select value={emissionCategoryId || NONE} onValueChange={(v) => setEmissionCategoryId(v === NONE ? "" : v)}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Not specified" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Not specified</SelectItem>
              {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      {targets.length > 0 && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[#374151] tracking-[-0.36px]">Counts toward</label>
          <Select value={reductionTargetId || NONE} onValueChange={(v) => setReductionTargetId(v === NONE ? "" : v)}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="No target" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>No target</SelectItem>
              {targets.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
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
