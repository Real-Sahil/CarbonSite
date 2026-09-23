"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type InstrumentType = "rego" | "guarantee_of_origin" | "ppa" | "green_tariff" | "supplier_specific" | "residual_mix";

type Row = {
  id: string;
  type: InstrumentType;
  facilityName: string | null;
  supplierName: string | null;
  reference: string | null;
  coveredKwh: number | null;
  emissionFactorKgPerKwh: number;
  validFrom: string;
  validTo: string;
};

const TYPES: { value: InstrumentType; label: string; help: string; volume: "required" | "optional" | "none"; defaultFactor?: string }[] = [
  { value: "rego", label: "REGO certificates", help: "Renewable Energy Guarantees of Origin retired for your supply. Usually 0 kg/kWh.", volume: "required", defaultFactor: "0" },
  { value: "guarantee_of_origin", label: "Guarantees of Origin", help: "EU/EEA certificates retired for your supply. Usually 0 kg/kWh.", volume: "required", defaultFactor: "0" },
  { value: "ppa", label: "Power purchase agreement", help: "Electricity bought directly from a generator. Use the generator's rate, 0 for wind or solar.", volume: "required", defaultFactor: "0" },
  { value: "green_tariff", label: "Green tariff", help: "A supplier tariff backed by certificates. Leave kWh blank if it covers the whole supply.", volume: "optional", defaultFactor: "0" },
  { value: "supplier_specific", label: "Supplier emission rate", help: "The rate on your supplier's fuel mix disclosure. Covers everything not backed by certificates.", volume: "none" },
  { value: "residual_mix", label: "Residual mix", help: "The published residual mix rate for your country (AIB). Used for anything nothing else covers.", volume: "none" },
];
const typeInfo = (t: InstrumentType) => TYPES.find((x) => x.value === t)!;

const selectClass =
  "h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50";
const kwh = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });

export function EnergyInstruments({
  orgId,
  canEdit,
  facilities,
  instruments,
}: {
  orgId: string;
  canEdit: boolean;
  facilities: { id: string; name: string }[];
  instruments: Row[];
}) {
  const router = useRouter();
  const [type, setType] = useState<InstrumentType>("rego");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const info = typeInfo(type);

  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formEl = event.currentTarget;
    const f = new FormData(formEl);
    const text = (k: string) => String(f.get(k) ?? "").trim() || null;
    const body = {
      type,
      facilityId: text("facilityId"),
      supplierName: text("supplierName"),
      reference: text("reference"),
      coveredKwh: info.volume === "none" || !text("coveredKwh") ? null : Number(text("coveredKwh")),
      emissionFactorKgPerKwh: Number(text("factor")),
      validFrom: text("validFrom"),
      validTo: text("validTo"),
    };
    startTransition(async () => {
      const res = await fetch(`/api/orgs/${orgId}/energy-instruments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const fieldErrors = data?.details?.fieldErrors as Record<string, string[]> | undefined;
        setError(fieldErrors ? Object.values(fieldErrors).flat().join(" ") : data?.message ?? "Could not save the contract.");
        return;
      }
      formEl.reset();
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await fetch(`/api/orgs/${orgId}/energy-instruments/${id}`, { method: "DELETE" });
      if (!res.ok) setError("Could not delete the contract.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-[28px] max-w-4xl">
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="p-4">
          <h2 className="text-base font-semibold text-slate-900">Electricity contracts and certificates</h2>
          <p className="mt-1 max-w-[65ch] text-sm text-slate-500">
            Market-based Scope 2 uses what you buy, not the grid average. Add the certificates, PPAs and tariffs behind
            your electricity. Each calculation run applies certificates first, then tariffs, then your supplier&apos;s
            rate, then the residual mix. A certificate is never counted twice. Changes apply to the next calculation run.
          </p>
        </div>

        {instruments.length === 0 ? (
          <p className="border-t border-slate-100 p-4 text-sm text-slate-500">
            No contracts yet. Market-based electricity records use the factor library, and each one carries a warning
            saying so.
          </p>
        ) : (
          <div className="overflow-x-auto border-t border-slate-100">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium">Site</th>
                  <th className="px-4 py-2 font-medium">Supplier / reference</th>
                  <th className="px-4 py-2 text-right font-medium">kWh covered</th>
                  <th className="px-4 py-2 text-right font-medium">kg CO2e/kWh</th>
                  <th className="px-4 py-2 font-medium">Valid</th>
                  {canEdit && <th className="px-4 py-2" />}
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {instruments.map((i) => (
                  <tr key={i.id} className="border-t border-slate-100">
                    <td className="px-4 py-2 text-slate-900">{typeInfo(i.type).label}</td>
                    <td className="px-4 py-2 text-slate-600">{i.facilityName ?? "All sites"}</td>
                    <td className="px-4 py-2 text-slate-600">{[i.supplierName, i.reference].filter(Boolean).join(" · ") || "-"}</td>
                    <td className="px-4 py-2 text-right text-slate-600">{i.coveredKwh == null ? "All remaining" : kwh.format(i.coveredKwh)}</td>
                    <td className="px-4 py-2 text-right text-slate-600">{i.emissionFactorKgPerKwh}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-slate-600">{i.validFrom} to {i.validTo}</td>
                    {canEdit && (
                      <td className="px-4 py-2 text-right">
                        <Button type="button" variant="ghost" size="sm" disabled={isPending} onClick={() => remove(i.id)} aria-label="Delete contract">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {canEdit && (
        <form onSubmit={create} className="rounded-lg border border-slate-200 bg-white">
          <div className="p-4">
            <h2 className="text-base font-semibold text-slate-900">Add a contract</h2>
            <p className="mt-1 text-sm text-slate-500">{info.help}</p>
          </div>
          <div className="grid gap-3 border-t border-slate-100 p-4 grid-cols-1 md:grid-cols-2">
            <div>
              <Label htmlFor="ei-type" className="mb-1.5 block text-xs font-medium text-slate-600">Type</Label>
              <select id="ei-type" value={type} onChange={(e) => setType(e.target.value as InstrumentType)} className={selectClass}>
                {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="ei-facility" className="mb-1.5 block text-xs font-medium text-slate-600">Site</Label>
              <select id="ei-facility" name="facilityId" className={selectClass} defaultValue="">
                <option value="">All sites</option>
                {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="ei-supplier" className="mb-1.5 block text-xs font-medium text-slate-600">Supplier or generator</Label>
              <Input id="ei-supplier" name="supplierName" maxLength={200} />
            </div>
            <div>
              <Label htmlFor="ei-ref" className="mb-1.5 block text-xs font-medium text-slate-600">Certificate or contract reference</Label>
              <Input id="ei-ref" name="reference" maxLength={200} />
            </div>
            {info.volume !== "none" && (
              <div>
                <Label htmlFor="ei-kwh" className="mb-1.5 block text-xs font-medium text-slate-600">
                  kWh covered{info.volume === "optional" ? " (blank for the whole supply)" : ""}
                </Label>
                <Input id="ei-kwh" name="coveredKwh" type="number" min="1" step="any" required={info.volume === "required"} />
              </div>
            )}
            <div>
              <Label htmlFor="ei-factor" className="mb-1.5 block text-xs font-medium text-slate-600">Emission rate (kg CO2e per kWh)</Label>
              <Input id="ei-factor" key={type} name="factor" type="number" min="0" max="2" step="any" required defaultValue={info.defaultFactor} />
            </div>
            <div>
              <Label htmlFor="ei-from" className="mb-1.5 block text-xs font-medium text-slate-600">Valid from</Label>
              <Input id="ei-from" name="validFrom" type="date" required />
            </div>
            <div>
              <Label htmlFor="ei-to" className="mb-1.5 block text-xs font-medium text-slate-600">Valid to</Label>
              <Input id="ei-to" name="validTo" type="date" required />
            </div>
            {error && <p className="text-sm text-red-600 md:col-span-2">{error}</p>}
            <div className="md:col-span-2">
              <Button type="submit" disabled={isPending}>
                <Plus className="h-4 w-4" />
                Add contract
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
