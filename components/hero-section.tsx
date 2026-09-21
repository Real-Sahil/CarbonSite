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
      : { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } };

  return (
    <section className="relative min-h-[100dvh] flex flex-col overflow-hidden bg-[#0B3B38]">

      {/* ── CSS animated background ─────────────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {/* Noise texture overlay */}
        <div className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E\")", backgroundRepeat: "repeat", backgroundSize: "128px 128px" }}
        />

        {/* Large teal orb — top centre */}
        <div
          className="absolute -top-24 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full"
          style={{
            background: "radial-gradient(ellipse at center, rgba(15,118,110,0.35) 0%, rgba(21,128,61,0.15) 35%, transparent 70%)",
            animation: reduced ? "none" : "hero-orb1 12s ease-in-out infinite",
          }}
        />

        {/* Medium blue orb — bottom left */}
        <div
          className="absolute bottom-0 -left-32 w-[500px] h-[500px] rounded-full"
          style={{
            background: "radial-gradient(ellipse at center, rgba(29,78,216,0.18) 0%, rgba(15,118,110,0.10) 50%, transparent 70%)",
            animation: reduced ? "none" : "hero-orb2 16s ease-in-out infinite 3s",
          }}
        />

        {/* Small lime orb — top right */}
        <div
          className="absolute -top-16 -right-16 w-[320px] h-[320px] rounded-full"
          style={{
            background: "radial-gradient(ellipse at center, rgba(132,204,22,0.12) 0%, rgba(21,128,61,0.06) 50%, transparent 70%)",
            animation: reduced ? "none" : "hero-orb3 20s ease-in-out infinite 6s",
          }}
        />

        {/* Horizon line glow */}
        <div
          className="absolute left-0 right-0"
          style={{
            top: "40%",
            height: "1px",
            background: "linear-gradient(90deg, transparent 0%, rgba(15,118,110,0.20) 30%, rgba(21,128,61,0.30) 50%, rgba(15,118,110,0.20) 70%, transparent 100%)",
          }}
        />

        {/* Bottom fade into page */}
        <div className="absolute bottom-0 inset-x-0 h-48 bg-gradient-to-t from-[#0B3B38] to-transparent" />
      </div>

      <style>{`
        @keyframes hero-orb1 {
          0%, 100% { transform: translateX(-50%) scale(1); opacity: 1; }
          50% { transform: translateX(-50%) scale(1.12); opacity: 0.75; }
        }
        @keyframes hero-orb2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(40px, -30px) scale(1.08); }
          66% { transform: translate(-20px, 20px) scale(0.96); }
        }
        @keyframes hero-orb3 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-30px, 30px); }
        }
      `}</style>

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
          className="text-[clamp(2.6rem,7.5vw,5.8rem)] font-semibold tracking-[-0.04em] leading-[1.05] text-white max-w-[18ch] mb-6"
        >
          Track emissions.{" "}
          <br className="hidden sm:block" />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-teal-300 via-emerald-300 to-lime-300">
            Prove the numbers.
          </span>
        </motion.h1>

        <motion.p
          {...fade(0.16)}
          className="text-[1.05rem] text-white/60 leading-relaxed max-w-[46ch] mb-10"
        >
          Field evidence capture, DEFRA 2025 calculations, immutable snapshots,
          and audit-ready reports built for construction, waste haulage, and supply chains.
        </motion.p>

        {/* CTA row */}
        <motion.div {...fade(0.23)} className="flex flex-wrap items-center justify-center gap-3 mb-16">
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 px-7 py-3 rounded-full bg-[#0F766E] hover:bg-[#0B5F59] text-white text-sm font-semibold shadow-[0_0_32px_rgba(15,118,110,0.45)] hover:shadow-[0_0_48px_rgba(15,118,110,0.6)] transition-all active:scale-[0.97]"
          >
            Start free
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            href="/product"
            className="inline-flex items-center gap-2 px-7 py-3 rounded-full border border-white/15 bg-white/5 backdrop-blur-sm text-white/85 text-sm font-medium hover:border-white/30 hover:bg-white/8 hover:text-white transition-all active:scale-[0.97]"
          >
            See how it works
          </Link>
        </motion.div>

        {/* Stats row */}
        <motion.div {...fade(0.30)} className="flex flex-wrap items-center justify-center gap-8 mb-12">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-2xl font-semibold text-white tracking-tight">{s.value}</p>
              <p className="text-xs text-white/45 mt-0.5">{s.label}</p>
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
              className="px-3 py-1 rounded-full border border-white/10 bg-white/5 text-[11px] text-white/50 tracking-wide"
            >
              {t}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
