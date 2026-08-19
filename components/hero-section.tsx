"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight } from "lucide-react";

const TRUST = [
  "DEFRA 2025 factors",
  "GHG Protocol Corporate Standard",
  "IPCC AR6 GWPs",
  "SECR-ready",
];

export function HeroSection() {
  const reduced = useReducedMotion();
  const fade = (delay = 0) =>
    reduced ? {} : { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, delay } };

  return (
    <section className="relative min-h-[100dvh] flex flex-col overflow-hidden bg-[#0F172A]">
      {/* Hero photograph */}
      <div className="absolute inset-0">
        <Image
          src="https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1800&q=75"
          alt="Construction site at dusk"
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />
        {/* Layered overlay: dark left for text legibility, lighter right */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0F172A]/95 via-[#0F172A]/70 to-[#0F172A]/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0F172A]/80 via-transparent to-[#0F172A]/40" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 flex items-end pb-20 pt-32">
        <div className="mx-auto max-w-7xl w-full px-6 md:px-10">
          <div className="max-w-[52rem]">

            {/* Thin rule + label — editorial device, one per hero */}
            <motion.div {...fade(0.05)} className="flex items-center gap-4 mb-10">
              <div className="w-8 h-px bg-[#06B6D4]" />
              <span className="text-xs text-[#06B6D4] tracking-[0.12em] font-medium">
                Carbon accounting infrastructure
              </span>
            </motion.div>

            {/* Headline — large, tight, no gimmicks */}
            <motion.h1
              {...fade(0.1)}
              className="text-[clamp(2.8rem,7vw,5.5rem)] font-semibold tracking-[-0.04em] leading-[0.95] text-white mb-8"
            >
              Track emissions.
              <br />
              <span className="text-[#0891B2]">Prove the numbers.</span>
            </motion.h1>

            <motion.p
              {...fade(0.18)}
              className="text-[1.05rem] text-white/60 leading-relaxed max-w-[44ch] mb-10"
            >
              Field evidence capture, calculation to GHG Protocol standards, immutable
              snapshots, and audit-ready reports — from one platform built for
              construction, waste haulage, and supply chains.
            </motion.p>

            <motion.div {...fade(0.25)} className="flex flex-wrap items-center gap-3">
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-[#0F172A] text-sm font-medium hover:bg-white/90 transition-colors active:scale-[0.97]"
              >
                Start free
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/product"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-white/20 text-white/80 text-sm font-medium hover:border-white/40 hover:text-white transition-colors active:scale-[0.97]"
              >
                See how it works
              </Link>
            </motion.div>
          </div>

          {/* Trust line — horizontal, single row, quiet */}
          <motion.div
            {...fade(0.35)}
            className="mt-16 pt-8 border-t border-white/10 flex flex-wrap items-center gap-x-8 gap-y-2"
          >
            {TRUST.map((t) => (
              <span key={t} className="text-xs text-white/35 tracking-wide">{t}</span>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
