"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, Leaf } from "lucide-react";
import { PredictiveArcCanvas } from "@designcodeio/threeui";

const TRUST = [
  "DEFRA 2025 factors",
  "GHG Protocol Corporate Standard",
  "IPCC AR6 GWPs",
  "SECR-ready",
];

const STATS = [
  { value: "100%", label: "Audit traceable" },
  { value: "3×", label: "Faster reporting" },
  { value: "SECR", label: "Compliant ready" },
];

export function HeroSection() {
  const reduced = useReducedMotion();
  const fade = (delay = 0) =>
    reduced
      ? {}
      : { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } };

  return (
    <section className="relative min-h-[100dvh] flex flex-col overflow-hidden bg-[#060612]">

      {/* ── ThreeUI predictive arc background ───────────────────────────────── */}
      <PredictiveArcCanvas
        className="absolute inset-0 w-full h-full"
        mode="dark"
        hue={25}
        saturation={0.75}
        brightness={0.6}
        speed={0.4}
        spacing={48}
        dotSize={1.8}
        archHeight={0.38}
        thickness={1.4}
      />

      {/* Vignette to blend into page */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,transparent_40%,rgba(6,6,18,0.65)_100%)]" />
      <div className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-t from-[#060612] to-transparent pointer-events-none" />

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pt-28 pb-20 text-center">

        {/* Badge pill */}
        <motion.div {...fade(0)} className="mb-8">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm text-xs font-medium text-white/70">
            <Leaf className="h-3 w-3 text-amber-400" />
            Carbon accounting infrastructure
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          {...fade(0.08)}
          className="text-[clamp(2.6rem,7.5vw,5.8rem)] font-semibold tracking-[-0.04em] leading-[1] text-white max-w-[18ch] mb-6"
        >
          Track emissions.{" "}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-300 via-orange-300 to-amber-200">
            Prove the numbers.
          </span>
        </motion.h1>

        <motion.p
          {...fade(0.16)}
          className="text-[1.05rem] text-white/50 leading-relaxed max-w-[46ch] mb-10"
        >
          Field evidence capture, DEFRA 2025 calculations, immutable snapshots,
          and audit-ready reports — built for construction, waste haulage, and supply chains.
        </motion.p>

        {/* CTA row */}
        <motion.div {...fade(0.23)} className="flex flex-wrap items-center justify-center gap-3 mb-16">
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 px-7 py-3 rounded-full bg-gradient-to-r from-orange-500 to-amber-400 text-white text-sm font-semibold shadow-[0_0_32px_rgba(245,158,11,0.45)] hover:shadow-[0_0_40px_rgba(245,158,11,0.6)] hover:from-orange-400 hover:to-amber-300 transition-all active:scale-[0.97]"
          >
            Start free
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            href="/product"
            className="inline-flex items-center gap-2 px-7 py-3 rounded-full border border-white/12 bg-white/5 backdrop-blur-sm text-white/80 text-sm font-medium hover:border-white/25 hover:bg-white/8 hover:text-white transition-all active:scale-[0.97]"
          >
            See how it works
          </Link>
        </motion.div>

        {/* Stats row */}
        <motion.div {...fade(0.30)} className="flex flex-wrap items-center justify-center gap-8 mb-12">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-2xl font-semibold text-white tracking-tight">{s.value}</p>
              <p className="text-xs text-white/35 mt-0.5">{s.label}</p>
            </div>
          ))}
        </motion.div>

        {/* Trust chips */}
        <motion.div
          {...fade(0.38)}
          className="flex flex-wrap items-center justify-center gap-2"
        >
          {TRUST.map((t) => (
            <span
              key={t}
              className="px-3 py-1 rounded-full border border-white/8 bg-white/4 text-[11px] text-white/35 tracking-wide"
            >
              {t}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
