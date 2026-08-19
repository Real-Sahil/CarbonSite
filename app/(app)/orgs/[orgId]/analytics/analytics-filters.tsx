"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

interface Period {
  id: string;
  label: string;
}
interface Facility {
  id: string;
  name: string;
}
interface Category {
  id: string;
  name: string;
  scope: number;
}

interface AnalyticsFiltersProps {
  orgId: string;
  periods: Period[];
  facilities: Facility[];
  categories: Category[];
  selectedPeriodId: string | null;
  selectedScope: string | null;
  selectedFacilityId: string | null;
  selectedCategoryId: string | null;
}

export function AnalyticsFilters({
  orgId,
  periods,
  facilities,
  categories,
  selectedPeriodId,
  selectedScope,
  selectedFacilityId,
  selectedCategoryId,
}: AnalyticsFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const update = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`/orgs/${orgId}/analytics?${params.toString()}`);
    },
    [router, orgId, searchParams],
  );

  const chipClass = (active: boolean) =>
    `rounded-full px-3 py-1 text-xs font-normal transition-colors cursor-pointer border ${
      active
        ? "bg-[#0EA5E9] text-white border-[#0EA5E9]"
        : "border-[#E5E7EB] text-[#374151] hover:border-[#BAE6FD] hover:bg-[#F0F9FF]"
    }`;

  return (
    <div className="flex flex-col gap-3">
      {/* Period */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-normal text-[#374151] w-16 shrink-0">Period</span>
        <button
          type="button"
          className={chipClass(!selectedPeriodId)}
          onClick={() => update("periodId", null)}
        >
          All
        </button>
        {periods.map((p) => (
          <button
            key={p.id}
            type="button"
            className={chipClass(selectedPeriodId === p.id)}
            onClick={() => update("periodId", p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Scope */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-normal text-[#374151] w-16 shrink-0">Scope</span>
        {[null, "1", "2", "3"].map((s) => (
          <button
            key={s ?? "all"}
            type="button"
            className={chipClass(selectedScope === s)}
            onClick={() => update("scope", s)}
          >
            {s ? `Scope ${s}` : "All"}
          </button>
        ))}
      </div>

      {/* Facility */}
      {facilities.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-normal text-[#374151] w-16 shrink-0">Facility</span>
          <button
            type="button"
            className={chipClass(!selectedFacilityId)}
            onClick={() => update("facilityId", null)}
          >
            All
          </button>
          {facilities.map((f) => (
            <button
              key={f.id}
              type="button"
              className={chipClass(selectedFacilityId === f.id)}
              onClick={() => update("facilityId", f.id)}
            >
              {f.name}
            </button>
          ))}
        </div>
      )}

      {/* Category */}
      {categories.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-normal text-[#374151] w-16 shrink-0">Category</span>
          <button
            type="button"
            className={chipClass(!selectedCategoryId)}
            onClick={() => update("categoryId", null)}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              className={chipClass(selectedCategoryId === c.id)}
              onClick={() => update("categoryId", c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
