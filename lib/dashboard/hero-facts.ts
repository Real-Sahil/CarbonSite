// The dashboard's opening sentence, built only from figures the page already
// loaded. It states the total, the change on the previous period and the
// largest single mover. It never gives a cause: the waterfall shows what moved,
// not why, so a "because" clause would be a claim the data does not support.

import type { WaterfallStep } from "@/lib/charts/waterfall";

export type HeroFactsInput = {
  periodLabel: string;
  /** Current footprint in kgCO₂e. */
  totalKg: number;
  /** Previous period's label, or null when there is none to compare with. */
  priorLabel: string | null;
  /** Change on the previous period in percent, or null when not comparable. */
  deltaPct: number | null;
  /** Steps from buildWaterfall(): start total, changes, end total. */
  steps: WaterfallStep[];
};

export type HeroFacts = { headline: string; detail: string | null };

/** The largest change step, ignoring the "All other categories" roll-up. */
export function biggestMover(steps: WaterfallStep[]): WaterfallStep | null {
  let best: WaterfallStep | null = null;
  for (const step of steps) {
    if (step.kind !== "change" || step.id === "other" || step.value === 0) continue;
    if (!best || Math.abs(step.value) > Math.abs(best.value)) best = step;
  }
  return best;
}

export function heroFacts(input: HeroFactsInput, format: (kg: number) => string): HeroFacts {
  const comparable = input.priorLabel !== null && input.deltaPct !== null && Number.isFinite(input.deltaPct);
  const rounded = comparable ? Math.round(input.deltaPct! * 10) / 10 : 0;

  let headline = `${input.periodLabel}: ${format(input.totalKg)}`;
  if (comparable) {
    headline += rounded === 0
      ? `, unchanged on ${input.priorLabel}`
      : `, ${rounded < 0 ? "down" : "up"} ${Math.abs(rounded).toFixed(1)}% on ${input.priorLabel}`;
  }

  const sentences: string[] = [];
  const mover = biggestMover(input.steps);
  if (mover) {
    const direction = mover.value < 0 ? "fall" : "rise";
    sentences.push(`Biggest ${direction}: ${mover.label}, ${mover.value > 0 ? "+" : "−"}${format(Math.abs(mover.value))}.`);
  }
  if (!comparable) sentences.push("No earlier period to compare yet.");

  return { headline: `${headline}.`, detail: sentences.length > 0 ? sentences.join(" ") : null };
}
