"use client";

import { useId, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { SITE_FUELS, fuelById, fuelTonnes } from "@/lib/tools/site-fuel";

type Row = { key: number; fuelId: string; litres: string };

const nf = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });
const nf3 = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 3 });

export function SiteFuelCalculator() {
  const uid = useId();
  const [rows, setRows] = useState<Row[]>([{ key: 1, fuelId: "gas-oil", litres: "" }]);
  const [next, setNext] = useState(2);

  const lines = rows.map((r) => {
    const fuel = fuelById(r.fuelId);
    const litres = Number.parseFloat(r.litres);
    return { ...r, fuel, tonnes: fuel ? fuelTonnes(litres, fuel) : 0 };
  });
  const total = lines.reduce((sum, l) => sum + l.tonnes, 0);

  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <div className="rounded-[20px] border border-mk-line bg-mk-surface p-5 sm:p-8">
      <div className="flex flex-col gap-5">
        {lines.map((l, i) => (
          <div key={l.key} className="grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${uid}-fuel-${l.key}`} className="text-[13px] font-medium text-mk-text">
                Fuel {i + 1}
              </label>
              <select
                id={`${uid}-fuel-${l.key}`}
                value={l.fuelId}
                onChange={(e) => update(l.key, { fuelId: e.target.value })}
                className="h-11 rounded-[10px] border border-mk-line bg-white px-3 text-[15px] text-mk-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-accent"
              >
                {SITE_FUELS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
              {l.fuel ? <p className="text-[13px] text-mk-text-2">{l.fuel.use}</p> : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${uid}-litres-${l.key}`} className="text-[13px] font-medium text-mk-text">
                Litres used
              </label>
              <input
                id={`${uid}-litres-${l.key}`}
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                placeholder="e.g. 18000"
                value={l.litres}
                onChange={(e) => update(l.key, { litres: e.target.value })}
                className="h-11 rounded-[10px] border border-mk-line bg-white px-3 text-[15px] text-mk-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-accent"
              />
            </div>
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <p className="text-[15px] font-medium text-mk-text sm:min-w-[110px] sm:text-right">{nf3.format(l.tonnes)} tCO2e</p>
              {rows.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setRows((rs) => rs.filter((r) => r.key !== l.key))}
                  aria-label={`Remove fuel ${i + 1}`}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full text-mk-text-2 hover:bg-mk-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-accent"
                >
                  <Trash2 aria-hidden className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => {
          setRows((rs) => [...rs, { key: next, fuelId: "diesel", litres: "" }]);
          setNext((n) => n + 1);
        }}
        className="mt-5 inline-flex h-11 items-center gap-2 rounded-full border border-mk-line px-4 text-[14px] font-medium text-mk-text hover:bg-mk-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-accent"
      >
        <Plus aria-hidden className="h-4 w-4" />
        Add another fuel
      </button>

      <div className="mt-6 border-t border-mk-line pt-5" role="status" aria-live="polite">
        <p className="text-[13px] text-mk-text-2">Total Scope 1 fuel emissions</p>
        <p className="font-display text-[40px] font-light leading-none tracking-[-0.02em] text-mk-text sm:text-[52px]">
          {nf.format(total)} <span className="text-[20px]">tCO2e</span>
        </p>
        <p className="mt-2 text-[13px] text-mk-text-2">Litres multiplied by the DESNZ 2026 factor, divided by 1,000. Nothing is stored or sent.</p>
      </div>
    </div>
  );
}
