// The dashboard's opening summary, built only from figures the page already
// loaded. It states the total, the change on the previous period, the largest
// single mover, the scope split and what is still open for a person. It never
// gives a cause: the waterfall shows what moved, not why, so a "because" clause
// would be a claim the data does not support.
//
// Output is structured segments, not HTML, so the view can emphasise figures and
// reveal the words one at a time without parsing strings.

import type { WaterfallStep } from "@/lib/charts/waterfall";

export type HeroScope = { scope: number; kg: number };

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
  /** Scope totals for the period. Scopes with nothing calculated are left out of the sentence. */
  scopes?: HeroScope[];
  /** Review tasks open on the organisation's records, from the same counts the readiness card reads. */
  openReviewTasks?: number;
};

/** A run of text. `emphasis` marks a figure the view sets in bold. */
export type HeroSegment = { text: string; emphasis?: boolean };

export type HeroFacts = {
  /** Small line above the sentence: the period, and what it is compared with. */
  eyebrow: string;
  /** The opening sentence, with the total emphasised. */
  headline: HeroSegment[];
  /** Short sentences under it, with each figure emphasised. */
  standfirst: HeroSegment[];
  /** Plain text of the whole summary, for screen readers and tests. */
  text: string;
};

/** The largest change step, ignoring the "All other categories" roll-up. */
export function biggestMover(steps: WaterfallStep[]): WaterfallStep | null {
  let best: WaterfallStep | null = null;
  for (const step of steps) {
    if (step.kind !== "change" || step.id === "other" || step.value === 0) continue;
    if (!best || Math.abs(step.value) > Math.abs(best.value)) best = step;
  }
  return best;
}

const plain = (segments: HeroSegment[]) => segments.map((s) => s.text).join("");

export function heroFacts(input: HeroFactsInput, format: (kg: number) => string): HeroFacts {
  const comparable = input.priorLabel !== null && input.deltaPct !== null && Number.isFinite(input.deltaPct);
  const rounded = comparable ? Math.round(input.deltaPct! * 10) / 10 : 0;

  const headline: HeroSegment[] = [
    { text: `${input.periodLabel}: ` },
    { text: format(input.totalKg), emphasis: true },
  ];
  if (comparable) {
    headline.push(
      rounded === 0
        ? { text: `, unchanged on ${input.priorLabel}` }
        : { text: `, ${rounded < 0 ? "down" : "up"} ` },
    );
    if (rounded !== 0) {
      headline.push({ text: `${Math.abs(rounded).toFixed(1)}%`, emphasis: true }, { text: ` on ${input.priorLabel}` });
    }
  }
  headline.push({ text: "." });

  // Each sentence is a list of segments; they are joined with a space below.
  const sentences: HeroSegment[][] = [];

  const mover = biggestMover(input.steps);
  if (mover) {
    const direction = mover.value < 0 ? "fall" : "rise";
    sentences.push([
      { text: `Biggest ${direction}: ${mover.label}, ` },
      { text: `${mover.value > 0 ? "+" : "−"}${format(Math.abs(mover.value))}`, emphasis: true },
      { text: "." },
    ]);
  }

  const scopes = (input.scopes ?? []).filter((s) => s.kg > 0).sort((a, b) => a.scope - b.scope);
  if (scopes.length > 0) {
    const parts: HeroSegment[] = [];
    scopes.forEach((s, i) => {
      parts.push({ text: `${i === 0 ? "" : ", "}Scope ${s.scope} ` }, { text: format(s.kg), emphasis: true });
    });
    parts.push({ text: "." });
    sentences.push(parts);
  }

  const open = input.openReviewTasks ?? 0;
  if (open > 0) {
    sentences.push([
      { text: String(open), emphasis: true },
      { text: ` review ${open === 1 ? "task is" : "tasks are"} open.` },
    ]);
  }

  if (!comparable) sentences.push([{ text: "No earlier period to compare yet." }]);

  const standfirst: HeroSegment[] = [];
  sentences.forEach((sentence, i) => {
    if (i > 0) standfirst.push({ text: " " });
    standfirst.push(...sentence);
  });

  return {
    eyebrow: comparable ? `${input.periodLabel} · vs ${input.priorLabel}` : input.periodLabel,
    headline,
    standfirst,
    text: standfirst.length > 0 ? `${plain(headline)} ${plain(standfirst)}` : plain(headline),
  };
}
