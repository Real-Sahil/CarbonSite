"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { REVIEW_STATUS_LABELS } from "@/lib/saved-views/labels";

type Option = { id: string; label: string };

const FIELD =
  "h-9 w-full rounded-[10px] border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-amber-400/50";

/**
 * Filters for the records table. The URL is the state: choosing a value rewrites
 * the query string, the page reads it on the server and the table refetches, so
 * a filtered list can be bookmarked, shared or saved as a view.
 */
export function RecordsFilters({
  filters,
  periods,
  categories,
  facilities,
  contracts,
  sites,
}: {
  filters: Record<string, string>;
  periods: Option[];
  categories: Option[];
  facilities: Option[];
  contracts: Option[];
  sites: Option[];
}) {
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

  const select = (key: string, label: string, options: Option[]) => (
    <div className="space-y-1">
      <Label htmlFor={`records-filter-${key}`} className="text-xs text-[#6B7280]">{label}</Label>
      <select
        id={`records-filter-${key}`}
        className={FIELD}
        value={filters[key] ?? ""}
        onChange={(e) => set(key, e.target.value)}
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
    </div>
  );

  const active = Object.keys(filters).length;

  return (
    <div className="px-6 py-4 border-b border-[#E5E7EB]" aria-busy={pending}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {select("periodId", "Period", periods)}
        {select("categoryId", "Category", categories)}
        {select("reviewStatus", "Status", Object.entries(REVIEW_STATUS_LABELS).map(([id, label]) => ({ id, label })))}
        {select("facilityId", "Facility", facilities)}
        {select("contractId", "Contract", contracts)}
        {select("siteId", "Project site", sites)}
        <div className="space-y-1">
          <Label htmlFor="records-filter-supplier" className="text-xs text-[#6B7280]">Supplier</Label>
          <input
            key={filters.supplier ?? ""}
            id="records-filter-supplier"
            type="search"
            className={FIELD}
            placeholder="Part of a name"
            maxLength={64}
            defaultValue={filters.supplier ?? ""}
            onKeyDown={(e) => {
              if (e.key === "Enter") set("supplier", e.currentTarget.value.trim());
            }}
            onBlur={(e) => {
              if (e.currentTarget.value.trim() !== (filters.supplier ?? "")) set("supplier", e.currentTarget.value.trim());
            }}
          />
        </div>
      </div>
      {active > 0 && (
        <div className="mt-3">
          <Button type="button" variant="ghost" size="sm" onClick={() => startTransition(() => router.replace(pathname))}>
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );
}
