"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { HEALTH_LABELS } from "@/lib/suppliers/filter";

const FIELD =
  "h-9 w-full rounded-[10px] border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-amber-400/50";

const TRENDS = [
  ["improving", "Improving"],
  ["stable", "Stable"],
  ["declining", "Declining"],
] as const;

/** Name search, health band and trend. The URL is the state, as on the records page. */
export function SuppliersFilters({ filters }: { filters: Record<string, string> }) {
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

  const select = (key: string, label: string, options: readonly (readonly [string, string])[]) => (
    <div className="space-y-1">
      <Label htmlFor={`suppliers-filter-${key}`} className="text-xs text-[#6B7280]">{label}</Label>
      <select
        id={`suppliers-filter-${key}`}
        className={FIELD}
        value={filters[key] ?? ""}
        onChange={(e) => set(key, e.target.value)}
      >
        <option value="">All</option>
        {options.map(([id, text]) => (
          <option key={id} value={id}>{text}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="space-y-3" aria-busy={pending}>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="suppliers-filter-q" className="text-xs text-[#6B7280]">Supplier</Label>
          <input
            key={filters.q ?? ""}
            id="suppliers-filter-q"
            type="search"
            className={FIELD}
            placeholder="Part of a name"
            maxLength={64}
            defaultValue={filters.q ?? ""}
            onKeyDown={(e) => {
              if (e.key === "Enter") set("q", e.currentTarget.value.trim());
            }}
            onBlur={(e) => {
              if (e.currentTarget.value.trim() !== (filters.q ?? "")) set("q", e.currentTarget.value.trim());
            }}
          />
        </div>
        {select("health", "Health", Object.entries(HEALTH_LABELS))}
        {select("trend", "Trend", TRENDS)}
      </div>
      {Object.keys(filters).length > 0 && (
        <Button type="button" variant="ghost" size="sm" onClick={() => startTransition(() => router.replace(pathname))}>
          Clear filters
        </Button>
      )}
    </div>
  );
}
