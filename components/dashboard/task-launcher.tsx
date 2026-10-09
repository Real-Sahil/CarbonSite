import Link from "next/link";
import { ArrowUpRight, BarChart3, ClipboardCheck, FileUp, Fuel, Inbox, Link2, ListChecks, Sparkles, Trash2, type LucideIcon } from "lucide-react";
import { PALETTE_ITEMS, paletteMatches } from "@/lib/nav/palette-items";

// An icon per destination so a job can be spotted at a glance. Anything not listed gets the default.
const ICONS: Record<string, LucideIcon> = {
  records: FileUp,
  "waste/plan": ClipboardCheck,
  "waste/pack": BarChart3,
  waste: Trash2,
  "waste/documents": Link2,
  fuel: Fuel,
  checklist: ListChecks,
  submissions: Inbox,
  kpis: BarChart3,
};

/**
 * "What do you want to do?": the everyday jobs in plain words, each one a link to the page where it
 * is done. The same entries the search box offers as Tasks, limited to what this role may open.
 */
export function TaskLauncher({ orgId, role }: { orgId: string; role: string }) {
  const tasks = paletteMatches(PALETTE_ITEMS, role, "").filter((i) => i.task?.home).slice(0, 8);
  if (tasks.length === 0) return null;
  return (
    <section aria-labelledby="task-launcher-title" className="mt-8">
      <h2 id="task-launcher-title" className="mb-3 text-base font-semibold tracking-tight text-slate-900">What do you want to do?</h2>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tasks.map((t) => {
          const Icon = ICONS[t.path] ?? Sparkles;
          return (
            <li key={t.label}>
              <Link
                href={`/orgs/${orgId}/${t.path}`}
                className="group relative flex h-full flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c2410c]"
              >
                <span className="flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-[#c2410c] ring-1 ring-orange-100 transition-colors group-hover:bg-[#c2410c] group-hover:text-white group-hover:ring-[#c2410c]">
                    <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-slate-300 transition-colors group-hover:text-[#c2410c]" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-sm font-semibold tracking-tight text-slate-900">{t.label}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-slate-500">{t.task!.blurb}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-slate-500">Cannot find something? Use Search in the menu, or press Ctrl+K (Cmd+K on a Mac), and type what you want in your own words.</p>
    </section>
  );
}
