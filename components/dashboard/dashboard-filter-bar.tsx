"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const FIELD =
  "h-9 w-full rounded-[10px] border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-amber-400/50";

/**
 * Supplier, month range and scope filters for the dashboard. The URL is the
 * state: `filters` is every filter the page has set (this bar's and the entity,
 * country, contract and facility ones), so changing one keeps the rest.
 */
export type SocialValueBeside = { contracts: number; commitments: number; gbpValue: string; otherCurrency: number };

export function DashboardFilterBar({
  filters,
  socialValue = null,
}: {
  filters: Record<string, string>;
  socialValue?: SocialValueBeside | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  function set(key: string, value: string) {
    go(key, value);
  }

  function go(key: string, value: string) {
    const next = new URLSearchParams(filters);
    if (value) next.set(key, value);
    else next.delete(key);
    const query = next.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname));
  }

  const input = (key: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <div className="space-y-1">
      <Label htmlFor={`dashboard-filter-${key}`} className="text-xs text-[#6B7280]">{label}</Label>
      <input
        key={filters[key] ?? ""}
        id={`dashboard-filter-${key}`}
        className={FIELD}
        defaultValue={filters[key] ?? ""}
        onKeyDown={(e) => { if (e.key === "Enter") set(key, e.currentTarget.value.trim()); }}
        onBlur={(e) => { if (e.currentTarget.value.trim() !== (filters[key] ?? "")) set(key, e.currentTarget.value.trim()); }}
        {...props}
      />
    </div>
  );

  const SLICE_KEYS = ["supplier", "from", "to", "scope", "projectId", "sv"];
  const sliced = SLICE_KEYS.some((k) => filters[k]);

  return (
    <div className="mb-4 rounded-[14px] border border-[#E5E7EB] bg-white p-4" aria-busy={pending}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {input("supplier", "Supplier", { type: "search", placeholder: "Part of a name", maxLength: 64 })}
        {input("from", "From month", { type: "month" })}
        {input("to", "To month", { type: "month" })}
        <div className="space-y-1">
          <Label htmlFor="dashboard-filter-scope" className="text-xs text-[#6B7280]">Scope</Label>
          <select id="dashboard-filter-scope" className={FIELD} value={filters.scope ?? ""} onChange={(e) => set("scope", e.target.value)}>
            <option value="">All scopes</option>
            <option value="1">Scope 1</option>
            <option value="2">Scope 2</option>
            <option value="3">Scope 3</option>
          </select>
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 text-sm text-[#111827]">
            <input
              type="checkbox"
              checked={filters.sv === "1"}
              onChange={(e) => set("sv", e.target.checked ? "1" : "")}
            />
            Contracts with social value commitments
          </label>
        </div>
      </div>
      {socialValue && (
        <p className="mt-3 text-xs text-[#374151]">
          Social value on {socialValue.contracts} {socialValue.contracts === 1 ? "contract" : "contracts"}: {socialValue.commitments} {socialValue.commitments === 1 ? "commitment" : "commitments"}
          {socialValue.gbpValue ? `, ${socialValue.gbpValue} committed (GBP)` : ""}
          {socialValue.otherCurrency > 0 ? `; ${socialValue.otherCurrency} in another currency not summed` : ""}. Shown beside the emissions, never added to them.
        </p>
      )}
      {sliced && (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[#6B7280]">
          <span>
            Totals, scopes, categories, facilities, the trend and the year-on-year comparison follow these filters. The energy, transport, water and industry panels stay organisation-wide. Records with no date are left out when a month is set.
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              const next = new URLSearchParams(filters);
              for (const k of SLICE_KEYS) next.delete(k);
              const q = next.toString();
              startTransition(() => router.replace(q ? `${pathname}?${q}` : pathname));
            }}
          >
            Clear these
          </Button>
        </div>
      )}
    </div>
  );
}
