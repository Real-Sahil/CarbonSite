"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SankeyChart, type FlowSelection } from "@/components/charts/kit/sankey-chart";
import { WaterfallChart } from "@/components/charts/kit/waterfall-chart";
import type { Flows } from "@/lib/charts/sankey";
import type { WaterfallStep } from "@/lib/charts/waterfall";

/** Clicking a chart element sets (or, clicked again, clears) one URL filter: the URL stays the state and every panel follows it. */
function useToggleFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (next.get(key) === value) next.delete(key);
    else next.set(key, value);
    const q = next.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  };
}

export function LinkedSankey({ flows, locale, period }: { flows: Flows; locale: string; period?: string }) {
  const toggle = useToggleFilter();
  const params = useSearchParams();
  const selected = Object.fromEntries(["scope", "categoryId", "facilityId"].flatMap((k) => (params.get(k) ? [[k, params.get(k)!]] : [])));
  return <SankeyChart flows={flows} locale={locale} period={period} selected={selected} onSelect={(s: FlowSelection) => toggle(s.key, s.value)} />;
}

export function LinkedWaterfall({ steps, locale }: { steps: WaterfallStep[]; locale: string }) {
  const toggle = useToggleFilter();
  const params = useSearchParams();
  return <WaterfallChart steps={steps} locale={locale} selected={params.get("categoryId") ?? undefined} onSelect={(id) => toggle("categoryId", id)} />;
}

/**
 * What the charts have filtered, as chips that clear one filter each, plus a
 * way into the records behind the same filters.
 */
export function ActiveCrossFilters({ chips, recordsHref }: { chips: { key: string; label: string }[]; recordsHref: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  if (chips.length === 0) return null;
  const clear = (key: string) => {
    const next = new URLSearchParams(params.toString());
    next.delete(key);
    const q = next.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  };
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2" aria-label="Filters set from the charts">
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => clear(c.key)}
          aria-label={`Clear filter: ${c.label}`}
          className="flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs text-[#111827] hover:bg-amber-100"
        >
          {c.label}
          <span aria-hidden>×</span>
        </button>
      ))}
      {recordsHref ? (
        <Link href={recordsHref} className="text-xs text-[#374151] underline underline-offset-2 hover:text-[#111827]">
          Open the records behind this
        </Link>
      ) : null}
    </div>
  );
}
