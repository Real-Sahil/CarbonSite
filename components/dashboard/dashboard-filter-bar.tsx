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
export function DashboardFilterBar({ filters }: { filters: Record<string, string> }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  function set(key: string, value: string) {
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

  const sliced = ["supplier", "from", "to", "scope"].some((k) => filters[k]);

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
      </div>
      {sliced && (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[#6B7280]">
          <span>
            Totals, scopes, categories and facilities follow these filters. The trend, energy, transport and comparison panels stay organisation-wide. Records with no date are left out when a month is set.
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              const next = new URLSearchParams(filters);
              for (const k of ["supplier", "from", "to", "scope"]) next.delete(k);
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
