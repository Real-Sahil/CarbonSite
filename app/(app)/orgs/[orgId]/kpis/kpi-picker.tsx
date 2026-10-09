"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { KPIS } from "@/lib/kpis/catalogue";

/** Which KPIs to show and for which period. The page address is the state, so a saved view keeps both. */
export function KpiPicker({ chosen, periodId, periods }: { chosen: string[]; periodId: string | null; periods: { id: string; label: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  function go(next: { k?: string[]; periodId?: string | null }) {
    const q = new URLSearchParams();
    const k = next.k ?? chosen;
    if (k.length) q.set("k", KPIS.filter((d) => k.includes(d.id)).map((d) => d.id).join(","));
    const p = next.periodId === undefined ? periodId : next.periodId;
    if (p) q.set("periodId", p);
    startTransition(() => router.replace(`${pathname}?${q.toString()}`));
  }

  return (
    <fieldset className="rounded-xl border border-gray-200 bg-white p-4" aria-busy={pending}>
      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Choose what to show</legend>
      <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {KPIS.map((k) => (
            <label key={k.id} className="flex items-center gap-2 text-sm text-gray-800">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300"
                checked={chosen.includes(k.id)}
                onChange={(e) => go({ k: e.target.checked ? [...chosen, k.id] : chosen.filter((x) => x !== k.id) })}
              />
              {k.label}
            </label>
          ))}
        </div>
        {periods.length > 0 && (
          <div className="space-y-1">
            <label htmlFor="kpi-period" className="block text-xs text-gray-500">Period</label>
            <select id="kpi-period" value={periodId ?? ""} onChange={(e) => go({ periodId: e.target.value || null })} className="h-9 rounded-md border border-gray-300 bg-white px-2 text-sm">
              {periods.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
        )}
      </div>
    </fieldset>
  );
}
