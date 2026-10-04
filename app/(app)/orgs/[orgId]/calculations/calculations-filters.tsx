"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RUN_STATUS_LABELS } from "@/lib/calculation/run-list-filters";

type Option = { id: string; label: string };

const FIELD =
  "h-9 w-full rounded-[10px] border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-amber-400/50";

/** Status, period and factor library. The URL is the state, as on the records page. */
export function CalculationsFilters({
  filters,
  periods,
  libraries,
}: {
  filters: Record<string, string>;
  periods: Option[];
  libraries: Option[];
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
      <Label htmlFor={`calculations-filter-${key}`} className="text-xs text-[#6B7280]">{label}</Label>
      <select
        id={`calculations-filter-${key}`}
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
      <div className="grid gap-3 sm:grid-cols-3">
        {select("status", "Status", Object.entries(RUN_STATUS_LABELS).map(([id, label]) => ({ id, label })))}
        {select("periodId", "Period", periods)}
        {select("factorLibraryId", "Factor library", libraries)}
      </div>
      {Object.keys(filters).length > 0 && (
        <Button type="button" variant="ghost" size="sm" onClick={() => startTransition(() => router.replace(pathname))}>
          Clear filters
        </Button>
      )}
    </div>
  );
}
