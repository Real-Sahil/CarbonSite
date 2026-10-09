import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  label: string;
  description: string;
  href: string;
  done: boolean;
}

interface OnboardingChecklistProps {
  orgId: string;
  steps: Step[];
}

/** Progress ring: the share of steps done, with the count in the middle (the text beside it says the same in words). */
function Ring({ done, total }: { done: number; total: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-14 w-14 shrink-0" aria-hidden="true">
      <svg viewBox="0 0 56 56" className="h-14 w-14 -rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" strokeWidth="5" className="stroke-orange-100" />
        <circle cx="28" cy="28" r={r} fill="none" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - done / total)} className="stroke-[#c2410c] transition-[stroke-dashoffset] duration-700 motion-reduce:transition-none" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[13px] font-semibold tabular-nums text-slate-900">{done}/{total}</span>
    </div>
  );
}

export function OnboardingChecklist({ steps }: OnboardingChecklistProps) {
  if (steps.every((s) => s.done)) return null;
  const completed = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);

  return (
    <section aria-labelledby="getting-started-title" className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 bg-gradient-to-r from-orange-50/70 via-white to-white p-5 sm:flex-row sm:items-center">
        <Ring done={completed} total={steps.length} />
        <div className="min-w-0 flex-1">
          <h2 id="getting-started-title" className="text-base font-semibold tracking-tight text-slate-900">Get set up</h2>
          <p className="mt-0.5 text-sm text-slate-600">{completed} of {steps.length} steps done. A few minutes each, and you can leave and come back.</p>
        </div>
        {next && (
          <Link href={next.href} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#c2410c] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#9a3412] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c2410c]">
            Next: {next.label}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        )}
      </div>
      <ol className="grid gap-px bg-slate-100 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {steps.map((step, i) => {
          const isNext = step === next;
          return (
            <li key={step.label} className="bg-white">
              <Link
                href={step.href}
                aria-current={isNext ? "step" : undefined}
                className={cn(
                  "group flex h-full items-start gap-3 p-4 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#c2410c]",
                  isNext && "bg-orange-50/50 hover:bg-orange-50",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    step.done ? "bg-emerald-100 text-emerald-700" : isNext ? "bg-[#c2410c] text-white" : "bg-slate-100 text-slate-500",
                  )}
                >
                  {step.done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : i + 1}
                  <span className="sr-only">{step.done ? " done" : isNext ? " next" : " to do"}</span>
                </span>
                <span className="min-w-0">
                  <span className={cn("block text-sm font-medium", step.done ? "text-slate-500 line-through decoration-slate-300" : "text-slate-900")}>{step.label}</span>
                  <span className="mt-0.5 block text-xs leading-snug text-slate-500">{step.description}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
