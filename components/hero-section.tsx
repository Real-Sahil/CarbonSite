"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, Leaf } from "lucide-react";

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
      : { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] } };

  return (
    <section className="relative min-h-[100dvh] flex flex-col overflow-hidden bg-[#060612]">

      {/* ── Mesh gradient blobs ─────────────────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Primary teal blob — top left */}
        <div className="absolute -top-40 -left-32 w-[600px] h-[600px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(13,148,136,0.45)_0%,transparent_70%)] blur-[1px]" />
        {/* Cyan bloom — center right */}
        <div className="absolute top-1/4 right-[-100px] w-[500px] h-[500px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(6,182,212,0.30)_0%,transparent_70%)] blur-[1px]" />
        {/* Emerald accent — bottom left */}
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.22)_0%,transparent_70%)] blur-[1px]" />
        {/* Purple depth — bottom right */}
        <div className="absolute -bottom-32 right-1/3 w-[480px] h-[480px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(124,58,237,0.18)_0%,transparent_70%)] blur-[1px]" />
        {/* Noise grain overlay */}
        <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")", backgroundSize: "200px 200px" }} />
        {/* Subtle grid */}
        <div className="absolute inset-0"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.03) 1px,transparent 1px)", backgroundSize: "72px 72px" }} />
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pt-28 pb-20 text-center">

        {/* Badge pill */}
        <motion.div {...fade(0)} className="mb-8">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm text-xs font-medium text-white/70">
            <Leaf className="h-3 w-3 text-teal-400" />
            Carbon accounting infrastructure
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          {...fade(0.08)}
          className="text-[clamp(2.6rem,7.5vw,5.8rem)] font-semibold tracking-[-0.04em] leading-[1] text-white max-w-[18ch] mb-6"
        >
          Track emissions.{" "}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-teal-300 via-cyan-300 to-emerald-300">
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
            className="inline-flex items-center gap-2 px-7 py-3 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-sm font-semibold shadow-[0_0_32px_rgba(13,148,136,0.45)] hover:shadow-[0_0_40px_rgba(13,148,136,0.6)] hover:from-teal-400 hover:to-cyan-400 transition-all active:scale-[0.97]"
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

      {/* Bottom fade */}
      <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-[#060612] to-transparent pointer-events-none" />
    </section>
  );
}
