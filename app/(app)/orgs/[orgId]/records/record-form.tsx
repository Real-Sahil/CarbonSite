"use client";

import { useEffect, useState } from "react";
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
import { FormActions, FormDisclosure, FormError, FormField, FormSection } from "@/components/forms/form-kit";
import { AlertCircle, Plus } from "lucide-react";

interface CreateRecordFormProps {
  orgId: string;
  periods: { id: string; label: string }[];
  categories: { id: string; scope: number; label: string; code?: string }[];
  facilities: { id: string; label: string }[];
  businessUnits: { id: string; label: string }[];
}

export function CreateRecordForm({
  orgId,
  periods,
  categories,
  facilities,
}: CreateRecordFormProps) {
  const [open, setOpen] = useState(false);
  const [periodId, setPeriodId] = useState(periods[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [facilityId, setFacilityId] = useState("");
  const [businessUnitId] = useState("");
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState("");
  // The date selects the factor version and lets a repeat of the same line be caught.
  const [activityDate, setActivityDate] = useState("");
  const [sourceDescription, setSourceDescription] = useState("");
  const [industryCode, setIndustryCode] = useState("");
  const [industryOptions, setIndustryOptions] = useState<{ code: string; title: string; scheme: string }[]>([]);
  // Heat network (s2-heat): the named network the heat comes from, if known.
  const [heatNetwork, setHeatNetwork] = useState("");
  const [heatOptions, setHeatOptions] = useState<{ value: string; label: string }[]>([]);
  const isHeat = categories.find((c) => c.id === categoryId)?.code === "s2-heat";
  useEffect(() => {
    const q = heatNetwork.trim();
    if (!isHeat || q.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/orgs/${orgId}/heat-networks?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : { data: [] }))
        .then((d) => setHeatOptions(d.data ?? []))
        .catch(() => undefined);
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [heatNetwork, isHeat, orgId]);

  // NAICS suggestions for spend priced by industry (EPA USEEIO).
  useEffect(() => {
    const q = industryCode.trim();
    if (q.length < 2 || /^\d{6}$/.test(q)) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/orgs/${orgId}/industry-codes?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : { data: [] }))
        .then((d) => setIndustryOptions(d.data ?? []))
        .catch(() => undefined);
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [industryCode, orgId]);
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
      const save = (allowDuplicate: boolean) =>
        fetch(`/api/orgs/${orgId}/activity-records`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reportingPeriodId: periodId,
            emissionCategoryId: categoryId,
            facilityId: facilityId || undefined,
            businessUnitId: businessUnitId || undefined,
            amount: parseFloat(amount),
            unit,
            activityDate: activityDate || undefined,
            sourceDescription: sourceDescription || undefined,
            industryCode: industryCode.trim() || undefined,
            // The network name as published selects its factor (heat-network.ts).
            fuelType: isHeat ? heatNetwork.trim() || undefined : undefined,
            allowDuplicate,
          }),
        });
      let res = await save(false);
      if (res.status === 409) {
        const conflict = await res.clone().json().catch(() => ({}));
        if (conflict.code === "POSSIBLE_DUPLICATE") {
          if (!window.confirm(conflict.message)) return;
          res = await save(true);
        }
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? "Failed to create record.");
      } else {
        window.location.reload();
      }
    } catch {
      setError("Network error. Try again.");
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
    <form onSubmit={handleSubmit} className="space-y-6 rounded-lg border border-[#E5E7EB] bg-white p-4 sm:p-5">
      <FormSection title="What was used" description="The amount and unit are converted to the category's standard unit when calculated.">
        <FormField label="Reporting period" htmlFor="record-period">
          <Select value={periodId} onValueChange={setPeriodId}>
            <SelectTrigger id="record-period" className="w-full"><SelectValue placeholder="Period" /></SelectTrigger>
            <SelectContent>
              {periods.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Category" htmlFor="record-category" span={3}>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger id="record-category" className="w-full"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              {categories.map((c) => <SelectItem key={c.id} value={c.id}>Scope {c.scope}: {c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Amount" htmlFor="record-amount">
          <Input id="record-amount" type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="120" required />
        </FormField>
        <FormField label="Unit" htmlFor="record-unit" hint="For example kWh, litres, tonnes, GBP">
          <Input id="record-unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="kWh" required />
        </FormField>
        <FormField label="Date" htmlFor="record-activity-date" optional hint="Picks the factor version and catches repeats">
          <Input id="record-activity-date" type="date" value={activityDate} onChange={(e) => setActivityDate(e.target.value)} />
        </FormField>
        {isHeat && (
          <FormField label="Heat network" htmlFor="record-heat-network" span={2} optional hint="City or network name, to pick its own factor">
            <Input id="record-heat-network" list="record-heat-networks" value={heatNetwork} onChange={(e) => setHeatNetwork(e.target.value)} />
            <datalist id="record-heat-networks">
              {heatOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </datalist>
          </FormField>
        )}
      </FormSection>

      <FormSection title="Where and why" description="Both optional.">
        {facilities.length > 0 && (
          <FormField label="Facility" htmlFor="record-facility" span={2}>
            <Select value={facilityId} onValueChange={setFacilityId}>
              <SelectTrigger id="record-facility" className="w-full"><SelectValue placeholder="Not linked to a facility" /></SelectTrigger>
              <SelectContent>
                {facilities.map((f) => <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
        )}
        <FormField label="Description" htmlFor="record-description" span={facilities.length > 0 ? 2 : 4}>
          <Input id="record-description" value={sourceDescription} onChange={(e) => setSourceDescription(e.target.value)} placeholder="Supplier, invoice or note" />
        </FormField>
      </FormSection>

      <FormDisclosure title="Spend-based pricing">
        <FormField label="Industry code" htmlFor="record-industry-code" span={2} optional hint="For spend only: NAICS 236220, UK SIC 41.20 or NAF 41.20Z">
          <Input id="record-industry-code" list="record-industry-codes" value={industryCode} onChange={(e) => setIndustryCode(e.target.value)} />
          <datalist id="record-industry-codes">
            {industryOptions.map((o) => <option key={`${o.scheme}-${o.code}`} value={o.code}>{`${o.scheme} · ${o.title}`}</option>)}
          </datalist>
        </FormField>
      </FormDisclosure>

      <FormError>{error}</FormError>
      <FormActions>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
        <Button type="submit" disabled={loading} size="sm">{loading ? "Saving…" : "Save record"}</Button>
      </FormActions>
    </form>
  );
}
