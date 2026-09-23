"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney, PRICE_TYPES, PRICE_USES, type PriceType, type PriceUse } from "@/lib/carbon-price";

type Row = {
  id: string;
  name: string;
  priceType: string;
  pricePerTonne: number;
  currency: string;
  scopes: number[];
  appliesTo: string[];
  effectiveFrom: string;
  effectiveTo: string | null;
  basis: string | null;
  inForce: boolean;
};

type Coverage = {
  periodLabel: string;
  version: number;
  coveredTco2e: number;
  share: number | null;
  cost: number;
  currency: string;
};

const selectClass =
  "h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50";
const labelClass = "mb-1.5 block text-xs font-medium text-slate-600";
const tonnes = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });

export function CarbonPrices({
  orgId,
  canEdit,
  defaultCurrency,
  gaps,
  current,
  coverage,
  prices,
}: {
  orgId: string;
  canEdit: boolean;
  defaultCurrency: string;
  gaps: string[];
  current: { id: string } | null;
  coverage: Coverage | null;
  prices: Row[];
}) {
  const router = useRouter();
  const [priceType, setPriceType] = useState<PriceType>("shadow");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formEl = event.currentTarget;
    const f = new FormData(formEl);
    const text = (k: string) => String(f.get(k) ?? "").trim() || null;
    const body = {
      name: text("name"),
      priceType,
      pricePerTonne: Number(text("pricePerTonne")),
      currency: text("currency") ?? defaultCurrency,
      scopes: f.getAll("scopes").map(Number),
      appliesTo: f.getAll("appliesTo").map(String),
      effectiveFrom: text("effectiveFrom"),
      effectiveTo: text("effectiveTo"),
      basis: text("basis"),
    };
    startTransition(async () => {
      const res = await fetch(`/api/orgs/${orgId}/carbon-prices`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const fieldErrors = data?.details?.fieldErrors as Record<string, string[]> | undefined;
        setError(fieldErrors ? Object.values(fieldErrors).flat().join(" ") : data?.message ?? "Could not save the price.");
        return;
      }
      formEl.reset();
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await fetch(`/api/orgs/${orgId}/carbon-prices/${id}`, { method: "DELETE" });
      if (!res.ok) setError("Could not delete the price.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-[28px] max-w-4xl">
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="p-4">
          <h2 className="text-base font-semibold text-slate-900">Internal carbon price</h2>
          <p className="mt-1 max-w-[65ch] text-sm text-slate-500">
            The price per tonne your organisation puts on its emissions when it makes decisions. It values the
            carbon in your published figures, nets the cheapest-first reduction list, and answers ESRS E1-8.
            Record a new price with a new start date rather than editing an old one, so past appraisals stay explainable.
          </p>
        </div>

        {coverage && (
          <div className="grid grid-cols-1 gap-4 border-t border-slate-100 p-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-slate-500">Emissions covered ({coverage.periodLabel}, snapshot v{coverage.version})</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{tonnes.format(coverage.coveredTco2e)} tCO2e</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Share of gross emissions</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
                {coverage.share == null ? "-" : `${(coverage.share * 100).toFixed(0)}%`}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Carbon cost at the price in force</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{formatMoney(coverage.cost, coverage.currency)}</p>
            </div>
          </div>
        )}

        {gaps.length > 0 && (
          <ul className="border-t border-slate-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {gaps.map((g) => <li key={g}>{g}</li>)}
          </ul>
        )}

        {prices.length === 0 ? (
          <p className="border-t border-slate-100 p-4 text-sm text-slate-500">No prices recorded yet.</p>
        ) : (
          <div className="overflow-x-auto border-t border-slate-100">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Price</th>
                  <th className="px-4 py-2 text-right font-medium">Per tCO2e</th>
                  <th className="px-4 py-2 font-medium">Scopes</th>
                  <th className="px-4 py-2 font-medium">Used for</th>
                  <th className="px-4 py-2 font-medium">In force</th>
                  {canEdit && <th className="px-4 py-2" />}
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {prices.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100 align-top">
                    <td className="px-4 py-2">
                      <p className="text-slate-900">{p.name}</p>
                      <p className="text-xs text-slate-500">
                        {PRICE_TYPES[p.priceType as PriceType]?.label ?? p.priceType}
                        {current?.id === p.id && <span className="ml-1.5 rounded-full bg-green-100 px-1.5 text-green-800">Used for appraisal</span>}
                      </p>
                      {p.basis && <p className="mt-1 max-w-[40ch] text-xs text-slate-500">{p.basis}</p>}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-900">{formatMoney(p.pricePerTonne, p.currency, 2)}</td>
                    <td className="px-4 py-2 text-slate-600">{p.scopes.join(", ")}</td>
                    <td className="px-4 py-2 text-slate-600">
                      {p.appliesTo.length ? p.appliesTo.map((u) => PRICE_USES[u as PriceUse] ?? u).join("; ") : "-"}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-slate-600">
                      {p.effectiveFrom} to {p.effectiveTo ?? "open"}
                      {!p.inForce && <span className="ml-1.5 text-xs text-slate-400">(not now)</span>}
                    </td>
                    {canEdit && (
                      <td className="px-4 py-2 text-right">
                        <Button type="button" variant="ghost" size="sm" disabled={isPending} onClick={() => remove(p.id)} aria-label={`Delete ${p.name}`}>
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
            <h2 className="text-base font-semibold text-slate-900">Add a price</h2>
            <p className="mt-1 text-sm text-slate-500">{PRICE_TYPES[priceType].help}</p>
          </div>
          <div className="grid grid-cols-1 gap-3 border-t border-slate-100 p-4 md:grid-cols-2">
            <div>
              <Label htmlFor="cp-name" className={labelClass}>Name</Label>
              <Input id="cp-name" name="name" required maxLength={200} placeholder="e.g. Capital appraisal shadow price 2026" />
            </div>
            <div>
              <Label htmlFor="cp-type" className={labelClass}>Type</Label>
              <select id="cp-type" value={priceType} onChange={(e) => setPriceType(e.target.value as PriceType)} className={selectClass}>
                {Object.entries(PRICE_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="cp-price" className={labelClass}>Price per tonne CO2e</Label>
              <Input id="cp-price" name="pricePerTonne" type="number" min="0.01" step="0.01" required />
            </div>
            <div>
              <Label htmlFor="cp-currency" className={labelClass}>Currency</Label>
              <Input id="cp-currency" name="currency" maxLength={3} defaultValue={defaultCurrency} required />
            </div>
            <div>
              <Label htmlFor="cp-from" className={labelClass}>In force from</Label>
              <Input id="cp-from" name="effectiveFrom" type="date" required />
            </div>
            <div>
              <Label htmlFor="cp-to" className={labelClass}>Until (blank if open)</Label>
              <Input id="cp-to" name="effectiveTo" type="date" />
            </div>
            <fieldset>
              <legend className={labelClass}>Scopes covered</legend>
              <div className="flex gap-4 text-sm text-slate-700">
                {[1, 2, 3].map((s) => (
                  <label key={s} htmlFor={`cp-scope-${s}`} className="flex items-center gap-1.5">
                    <input id={`cp-scope-${s}`} type="checkbox" name="scopes" value={s} defaultChecked={s !== 3} />
                    Scope {s}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className={labelClass}>Used for</legend>
              <div className="grid gap-1 text-sm text-slate-700">
                {Object.entries(PRICE_USES).map(([k, v]) => (
                  <label key={k} htmlFor={`cp-use-${k}`} className="flex items-center gap-1.5">
                    <input id={`cp-use-${k}`} type="checkbox" name="appliesTo" value={k} defaultChecked={k === "capital_investment"} />
                    {v}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="md:col-span-2">
              <Label htmlFor="cp-basis" className={labelClass}>Basis and critical assumptions</Label>
              <textarea
                id="cp-basis"
                name="basis"
                rows={3}
                maxLength={4000}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
                placeholder="Where the figure comes from (e.g. UK ETS forward price, DESNZ appraisal values) and how often it is reviewed."
              />
            </div>
            {error && <p className="text-sm text-red-600 md:col-span-2">{error}</p>}
            <div className="md:col-span-2">
              <Button type="submit" size="sm" disabled={isPending}>
                <Plus className="h-4 w-4" /> Add price
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
