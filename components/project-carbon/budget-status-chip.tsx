import Link from "next/link";
import type { Burndown } from "@/lib/project-carbon/burndown";

const STYLE = {
  over: { label: "Forecast over", cls: "border-red-200 bg-red-50 text-red-700" },
  at_risk: { label: "At risk", cls: "border-amber-200 bg-amber-50 text-amber-800" },
  on_track: { label: "On track", cls: "border-green-200 bg-green-50 text-green-700" },
  no_budget: { label: "No budget", cls: "border-gray-200 bg-gray-50 text-gray-600" },
} as const;

/** Carbon budget status from the burn-down, linking to the project's carbon budget page. */
export function BudgetStatusChip({ burndown, href }: { burndown: Burndown | null; href: string }) {
  if (!burndown) {
    return (
      <Link href={href} className="text-xs text-[#6B7280] underline-offset-2 hover:underline">
        Set budget
      </Link>
    );
  }
  const s = STYLE[burndown.status];
  const used = burndown.budgetTco2e > 0 ? Math.round((burndown.actualToDate / burndown.budgetTco2e) * 100) : null;
  return (
    <Link
      href={href}
      title={burndown.reasons[0] ?? undefined}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${s.cls}`}
    >
      {s.label}
      {used != null && <span className="font-normal tabular-nums opacity-80">{used}% used</span>}
    </Link>
  );
}
