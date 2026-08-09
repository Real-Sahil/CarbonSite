import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";

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

export function OnboardingChecklist({ steps }: OnboardingChecklistProps) {
  const allDone = steps.every((s) => s.done);
  if (allDone) return null;

  const completedCount = steps.filter((s) => s.done).length;
  const nextStep = steps.find((s) => !s.done);

  return (
    <div className="mb-8 rounded-[14px] border border-[#BAE6FD] bg-[#f0faf0] p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2
            className="text-sm font-normal text-[#111827] tracking-[-0.42px]"
            style={{  fontWeight: 300, fontSize: "1rem" }}
          >
            Getting started
          </h2>
          <p className="text-xs text-[#4a7c59] tracking-[-0.36px] mt-0.5">
            {completedCount} of {steps.length} steps complete
            {nextStep && (
              <> — up next:{" "}
                <Link href={nextStep.href} className="font-medium underline underline-offset-2 hover:text-[#111827]">
                  {nextStep.label}
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {steps.map((step, i) => (
            <div
              key={i}
              className={`h-1.5 w-6 rounded-full transition-colors ${step.done ? "bg-[#0EA5E9]" : "bg-[#F0F9FF]"}`}
            />
          ))}
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {steps.map((step, i) => (
          <Link
            key={i}
            href={step.done ? "#" : step.href}
            className={`flex items-start gap-2.5 rounded-[10px] px-3 py-2.5 text-left transition-colors ${
              step.done
                ? "cursor-default opacity-60"
                : "hover:bg-[#F0F9FF] bg-white border border-[#d0ecce]"
            }`}
            tabIndex={step.done ? -1 : undefined}
            aria-disabled={step.done}
          >
            {step.done ? (
              <CheckCircle2 className="h-4 w-4 text-[#111827] mt-0.5 shrink-0" aria-hidden="true" />
            ) : (
              <Circle className="h-4 w-4 text-[#9ab8a0] mt-0.5 shrink-0" aria-hidden="true" />
            )}
            <div>
              <p className={`text-xs font-medium tracking-[-0.36px] ${step.done ? "text-[#111827]" : "text-[#111827]"}`}>
                {step.label}
              </p>
              <p className="text-[11px] text-[#4a7c59] tracking-[-0.33px] mt-0.5 leading-snug">
                {step.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
