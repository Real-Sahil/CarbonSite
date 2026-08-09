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

interface CreateRecordFormProps {
  orgId: string;
  periods: { id: string; label: string }[];
  categories: { id: string; scope: number; label: string }[];
  facilities: { id: string; label: string }[];
  businessUnits: { id: string; label: string }[];
}

export function CreateRecordForm({
  orgId,
  periods,
  categories,
  facilities,
  businessUnits: _businessUnits,
}: CreateRecordFormProps) {
  const [open, setOpen] = useState(false);
  const [periodId, setPeriodId] = useState(periods[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [facilityId, setFacilityId] = useState("");
  const [businessUnitId] = useState("");
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState("");
  const [sourceDescription, setSourceDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!periodId || !categoryId || !amount || !unit) {
      setError("Reporting period, category, amount, and unit are required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/activity-records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportingPeriodId: periodId,
          emissionCategoryId: categoryId,
          facilityId: facilityId || undefined,
          businessUnitId: businessUnitId || undefined,
          amount: parseFloat(amount),
          unit,
          sourceDescription: sourceDescription || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? "Failed to create record.");
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
          before adding records.
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
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-[14px] border border-[#E2E8F0] p-4">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-[#475569] tracking-[-0.36px]">Period</label>
        <Select value={periodId} onValueChange={setPeriodId}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Period" />
          </SelectTrigger>
          <SelectContent>
            {periods.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-[#475569] tracking-[-0.36px]">Category</label>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => <SelectItem key={c.id} value={c.id}>Scope {c.scope}: {c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-[#475569] tracking-[-0.36px]">Amount</label>
        <Input
          type="number"
          min="0"
          step="any"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="e.g. 120"
          className="w-28"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-[#475569] tracking-[-0.36px]">Unit</label>
        <Input
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder="e.g. kWh"
          className="w-24"
        />
      </div>
      {facilities.length > 0 && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[#475569] tracking-[-0.36px]">Facility</label>
          <Select value={facilityId} onValueChange={setFacilityId}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Optional" />
            </SelectTrigger>
            <SelectContent>
              {facilities.map((f) => <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-[#475569] tracking-[-0.36px]">Description</label>
        <Input
          value={sourceDescription}
          onChange={(e) => setSourceDescription(e.target.value)}
          placeholder="Optional"
          className="w-40"
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
