"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FormActions, FormError, FormField, FormSection, fieldClass } from "@/components/forms/form-kit";
import { Input } from "@/components/ui/input";

interface FactorRow {
  id: string;
  category: string;
  activityType: string | null;
  unit: string;
  co2e: number | null;
  country: string | null;
  source: string;
  version: number;
  from: string | null;
  to: string | null;
}

const UNITS = ["litre", "kWh", "kg", "tonne", "km", "pkm", "tonne.km", "m3", "GBP", "USD", "EUR", "unit"];

export function FactorsPanel({
  orgId,
  homeCountry,
  categories,
  factors,
}: {
  orgId: string;
  homeCountry: string;
  categories: Array<{ id: string; code: string; name: string; scope: number }>;
  factors: FactorRow[];
}) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState("");
  const [activityType, setActivityType] = useState("");
  const [unit, setUnit] = useState("litre");
  const [co2e, setCo2e] = useState("");
  const [country, setCountry] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const category = categories.find((c) => c.id === categoryId);
    const value = Number(co2e);
    if (!category) return setError("Choose the emission category this factor applies to.");
    if (!Number.isFinite(value) || value < 0 || co2e.trim() === "") return setError("Enter the factor as kg CO2e per unit, for example 2.51.");
    if (source.trim().length < 3) return setError("Name the source, for example the supplier's certificate or EPD reference.");
    setBusy(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/custom-factors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: category.scope,
          emissionCategoryId: category.id,
          activityType: activityType.trim() || undefined,
          geographyCountry: country.trim() ? country.trim().toUpperCase() : undefined,
          effectiveStartDate: from ? new Date(from).toISOString() : undefined,
          effectiveEndDate: to ? new Date(to).toISOString() : undefined,
          inputUnit: unit,
          co2e: value,
          source: source.trim(),
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? "Could not save the factor.");
      setCategoryId("");
      setActivityType("");
      setCo2e("");
      setSource("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the factor.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-8">
      <form onSubmit={save} className="rounded-[12px] border border-[#E5E7EB] bg-white p-5">
        <FormSection title="Add a factor" description="Kilograms of CO2e per one unit of activity, as the source states it." cols={3}>
          <FormField label="Category *" htmlFor="f-cat" span={2}>
            <select id="f-cat" className={fieldClass} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Choose a category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  Scope {c.scope}: {c.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Fuel or activity" htmlFor="f-act" hint="Matched against a record's fuel or detail text, such as HVO or R32.">
            <Input id="f-act" value={activityType} onChange={(e) => setActivityType(e.target.value)} />
          </FormField>
          <FormField label="Per unit *" htmlFor="f-unit">
            <select id="f-unit" className={fieldClass} value={unit} onChange={(e) => setUnit(e.target.value)}>
              {UNITS.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </FormField>
          <FormField label="kg CO2e per unit *" htmlFor="f-val">
            <Input id="f-val" inputMode="decimal" value={co2e} onChange={(e) => setCo2e(e.target.value)} />
          </FormField>
          <FormField label="Country" htmlFor="f-country" hint={homeCountry ? `Two letters. Leave empty for any country (home: ${homeCountry}).` : "Two letters. Leave empty for any country."}>
            <Input id="f-country" maxLength={2} value={country} onChange={(e) => setCountry(e.target.value)} />
          </FormField>
          <FormField label="Valid from" htmlFor="f-from">
            <Input id="f-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </FormField>
          <FormField label="Valid to" htmlFor="f-to">
            <Input id="f-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </FormField>
          <FormField label="Source *" htmlFor="f-src" span={3} hint="Printed in the calculation trail, for example: Supplier certificate 2026-14, EPD S-P-01234.">
            <Input id="f-src" value={source} onChange={(e) => setSource(e.target.value)} />
          </FormField>
        </FormSection>
        {error ? <FormError>{error}</FormError> : null}
        <FormActions>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Add factor"}
          </Button>
        </FormActions>
      </form>

      <section aria-labelledby="mine-h">
        <h3 id="mine-h" className="text-base font-semibold text-[#111827]">Your factors ({factors.length})</h3>
        {factors.length === 0 ? (
          <p className="mt-2 text-sm text-[#6B7280]">None yet. Records use the run&apos;s library until you add one.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-[12px] border border-[#E5E7EB] bg-white">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-xs uppercase tracking-wide text-[#6B7280]">
                <tr>
                  <th className="px-4 py-2 font-medium">Category</th>
                  <th className="px-4 py-2 font-medium">Fuel or activity</th>
                  <th className="px-4 py-2 text-right font-medium">kg CO2e / unit</th>
                  <th className="px-4 py-2 font-medium">Valid</th>
                  <th className="px-4 py-2 font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {factors.map((f) => (
                  <tr key={f.id} className="border-b border-[#F3F4F6] last:border-0">
                    <td className="px-4 py-3">{f.category}</td>
                    <td className="px-4 py-3">{f.activityType ?? "Any"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {f.co2e ?? "–"} <span className="text-xs text-[#6B7280]">/ {f.unit}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#6B7280]">
                      {f.from ?? "always"} to {f.to ?? "open"}
                      {f.country ? ` · ${f.country}` : ""}
                    </td>
                    <td className="px-4 py-3 text-xs">{f.source} <span className="text-[#6B7280]">(v{f.version})</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
