import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PALETTE_ITEMS, paletteMatches } from "@/lib/nav/palette-items";

/**
 * "What do you want to do?": the everyday jobs in plain words, each one a link to the page where it
 * is done. The same entries the search box offers as Tasks, limited to what this role may open.
 */
export function TaskLauncher({ orgId, role }: { orgId: string; role: string }) {
  const tasks = paletteMatches(PALETTE_ITEMS, role, "").filter((i) => i.task?.home).slice(0, 8);
  if (tasks.length === 0) return null;
  return (
    <section aria-labelledby="task-launcher-title" className="mt-8">
      <h2 id="task-launcher-title" className="mb-3 text-sm font-semibold text-[#111827]">What do you want to do?</h2>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tasks.map((t) => (
          <li key={t.label}>
            <Link href={`/orgs/${orgId}/${t.path}`} className="group flex h-full flex-col justify-between gap-2 rounded-[14px] border border-[#E5E7EB] bg-white p-4 transition-colors hover:border-[#9CA3AF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c2410c]">
              <span>
                <span className="block text-sm font-semibold text-[#111827]">{t.label}</span>
                <span className="mt-1 block text-xs text-[#6B7280]">{t.task!.blurb}</span>
              </span>
              <ArrowRight className="h-4 w-4 text-[#6B7280] transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-[#6B7280]">Cannot find something? Use Search in the menu, or press Ctrl+K (Cmd+K on a Mac), and type what you want in your own words.</p>
    </section>
  );
}
