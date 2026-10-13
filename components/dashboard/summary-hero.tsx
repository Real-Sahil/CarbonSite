"use client";

// The dashboard's opening summary: eyebrow, one headline with the total set
// apart, and a standfirst with the figures in bold. Words arrive in reading
// order, a short fade and rise each. With reduced motion the text is simply there.
// The sentences come from heroFacts(), which reads only figures the page loaded.

import { motion, useReducedMotion } from "motion/react";
import type { HeroFacts, HeroSegment } from "@/lib/dashboard/hero-facts";

const STEP_SECONDS = 0.04;

type Token = { key: string; text: string; emphasis: boolean; word: boolean };

/** Splits segments into words and spaces, keeping each word's emphasis. */
function tokens(segments: HeroSegment[]): Token[] {
  return segments.flatMap((segment, s) =>
    segment.text.split(/(\s+)/).filter(Boolean).map((text, p) => ({
      key: `${s}-${p}`,
      text,
      emphasis: Boolean(segment.emphasis),
      word: !/^\s+$/.test(text),
    })),
  );
}

function Sentence({ segments, delay = 0 }: { segments: HeroSegment[]; delay?: number }) {
  const reduce = useReducedMotion();
  let index = 0;
  return (
    <>
      {tokens(segments).map((token) => {
        if (!token.word) return <span key={token.key}>{token.text}</span>;
        const at = delay + index++ * STEP_SECONDS;
        return (
          <motion.span
            key={token.key}
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: at, duration: 0.32, ease: "easeOut" }}
            className={token.emphasis ? "font-semibold text-[#131d29]" : undefined}
          >
            {token.text}
          </motion.span>
        );
      })}
    </>
  );
}

export function SummaryHero({ facts }: { facts: HeroFacts }) {
  const reduce = useReducedMotion();
  const headlineWords = tokens(facts.headline).filter((t) => t.word).length;
  const standfirstDelay = reduce ? 0 : headlineWords * STEP_SECONDS + 0.15;

  return (
    <section aria-labelledby="summary-title" className="mt-2">
      <motion.p
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="text-xs font-medium uppercase tracking-wide text-[#5B6A78]"
      >
        {facts.eyebrow}
      </motion.p>
      <h2 id="summary-title" className="mt-2 max-w-3xl text-2xl font-normal leading-tight tracking-[-0.6px] text-[#41505F] md:text-3xl">
        <Sentence segments={facts.headline} />
      </h2>
      {facts.standfirst.length > 0 ? (
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-[#41505F]">
          <Sentence segments={facts.standfirst} delay={standfirstDelay} />
        </p>
      ) : null}
    </section>
  );
}
