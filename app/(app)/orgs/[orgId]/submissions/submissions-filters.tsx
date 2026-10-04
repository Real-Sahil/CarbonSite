"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DOCUMENT_TYPE_LABELS } from "@/lib/field-submissions/list-filters";

type Option = { id: string; label: string };

const FIELD =
  "h-9 w-full rounded-[10px] border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-amber-400/50";

/**
 * Document type, period, facility and contract (the status tabs above stay as
 * they are). The URL is the state, as on the records page, so the queue can be
 * bookmarked, shared or saved as a view.
 */
export function SubmissionsFilters({
  filters,
  periods,
  facilities,
  contracts,
}: {
  filters: Record<string, string>;
  periods: Option[];
  facilities: Option[];
  contracts: Option[];
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
      <Label htmlFor={`submissions-filter-${key}`} className="text-xs text-[#6B7280]">{label}</Label>
      <select
        id={`submissions-filter-${key}`}
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

  return (
    <div className="space-y-3" aria-busy={pending}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {select("documentType", "Document type", Object.entries(DOCUMENT_TYPE_LABELS).map(([id, label]) => ({ id, label })))}
        {select("periodId", "Period", periods)}
        {select("facilityId", "Facility", facilities)}
        {select("contractId", "Contract", contracts)}
      </div>
      {Object.keys(filters).some((k) => k !== "status") && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            const next = new URLSearchParams();
            if (filters.status) next.set("status", filters.status);
            const query = next.toString();
            startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname));
          }}
        >
          Clear filters
        </Button>
      )}
    </div>
  );
}
