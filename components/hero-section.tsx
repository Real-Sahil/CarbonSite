"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { OrbitalNetworkGraphic } from "@/components/marketing/orbital-network";
import { ArrowRight, Shield, Zap } from "lucide-react";

const WORDS = ["construction", "haulage", "supply chains", "your sector"];

function CyclingWord() {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    if (prefersReduced) return;
    const cycle = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % WORDS.length);
        setVisible(true);
      }, 300);
    }, 2800);
    return () => clearInterval(cycle);
  }, [prefersReduced]);

  return (
    <span
      className="inline-block transition-all duration-300 text-shimmer"
      style={{ opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(-8px)" }}
    >
      {WORDS[idx]}
    </span>
  );
}

function DotGrid() {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage: "radial-gradient(circle, rgba(34,197,94,0.06) 1px, transparent 1px)",
        backgroundSize: "28px 28px",
      }}
    />
  );
}

const LIVE_EVENTS = [
  { action: "Waste ticket captured",       scope: "Field",  color: "#22c55e", delay: 0 },
  { action: "Calculation run completed",   scope: "Scope 1", color: "#38bdf8", delay: 1.5 },
  { action: "Snapshot published",          scope: "Report",  color: "#a78bfa", delay: 3 },
];

function LiveFeed() {
  const [active, setActive] = useState(0);
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    if (prefersReduced) return;
    const t = setInterval(() => setActive((p) => (p + 1) % LIVE_EVENTS.length), 2200);
    return () => clearInterval(t);
  }, [prefersReduced]);

  return (
    <div className="space-y-2">
      {LIVE_EVENTS.map((ev, i) => (
        <div
          key={ev.action}
          className="flex items-center gap-3 transition-all duration-500"
          style={{ opacity: active === i ? 1 : 0.35 }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0 transition-all duration-300"
            style={{
              background: ev.color,
              boxShadow: active === i ? `0 0 6px ${ev.color}` : "none",
            }}
          />
          <span className="text-xs text-zinc-300 flex-1 truncate">{ev.action}</span>
          <span
            className="text-[10px] font-mono px-1.5 py-0.5 rounded"
            style={{
              background: `${ev.color}18`,
              color: ev.color,
            }}
          >
            {ev.scope}
          </span>
        </div>
      ))}
    </div>
  );
}

export function HeroSection() {
  const prefersReduced = useReducedMotion();

  return (
    <section className="relative min-h-[100dvh] flex flex-col overflow-hidden bg-[#060b08] text-white">
      <DotGrid />

      {/* Multi-layer ambient glow */}
      <div className="absolute -top-32 left-1/4 w-[500px] h-[350px] bg-emerald-900/15 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute top-20 right-1/4 w-[300px] h-[300px] bg-emerald-800/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[200px] bg-emerald-950/30 blur-[80px] rounded-full pointer-events-none" />

      {/* Main content — offset by SiteNav height (64px) */}
      <div className="relative z-10 flex-1 flex items-center pt-16">
        <div className="mx-auto max-w-7xl w-full px-5 md:px-10 py-16 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

          {/* Left: headline + sub + CTAs */}
          <div>
            <motion.div
              initial={prefersReduced ? {} : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-800/60 bg-emerald-950/40 px-3.5 py-1.5 mb-7">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-emerald-400 font-medium tracking-wide">
                  DEFRA 2025 · GHG Protocol · IPCC AR6
                </span>
              </div>
            </motion.div>

            <motion.h1
              className="text-5xl md:text-6xl xl:text-7xl font-semibold tracking-tighter leading-[1.04] mb-6"
              initial={prefersReduced ? {} : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.08, ease: "easeOut" }}
            >
              Carbon accounting
              <br />
              built for{" "}
              <CyclingWord />
            </motion.h1>

            <motion.p
              className="text-base md:text-lg text-zinc-400 leading-relaxed max-w-[48ch] mb-8"
              initial={prefersReduced ? {} : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.16, ease: "easeOut" }}
            >
              Capture field evidence, run calculations to GHG Protocol standards,
              publish immutable snapshots, generate audit-ready reports.
              Scope 1, 2 and 3 from a single platform.
            </motion.p>

            <motion.div
              className="flex flex-wrap gap-3 mb-10"
              initial={prefersReduced ? {} : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.24, ease: "easeOut" }}
            >
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-colors active:scale-[0.97] shadow-lg shadow-emerald-900/30"
              >
                Create organisation
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/product"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-zinc-700 text-zinc-300 text-sm font-medium hover:border-zinc-500 hover:text-white transition-colors active:scale-[0.97]"
              >
                Explore product
              </Link>
            </motion.div>

            {/* Trust badges */}
            <motion.div
              className="flex flex-wrap items-center gap-5"
              initial={prefersReduced ? {} : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              {[
                { icon: Shield, label: "Audit-grade trail" },
                { icon: Zap, label: "Immutable snapshots" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2 text-xs text-zinc-500">
                  <Icon className="h-3.5 w-3.5 text-emerald-700" />
                  {label}
                </div>
              ))}
              <div className="flex items-center gap-3 text-xs text-zinc-500 pl-2 border-l border-zinc-800">
                {[
                  { value: "23+", label: "emission factors" },
                  { value: "6",   label: "RBAC roles" },
                  { value: "100%", label: "traceable" },
                ].map((stat) => (
                  <span key={stat.label} className="flex items-center gap-1">
                    <span className="text-white font-semibold">{stat.value}</span>
                    {stat.label}
                  </span>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Right: orbital network + live feed */}
          <motion.div
            className="hidden lg:flex flex-col gap-4"
            initial={prefersReduced ? {} : { opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
          >
            {/* Orbital graphic */}
            <div className="relative rounded-2xl border border-emerald-900/30 bg-[#060d0a]/80 p-4 backdrop-blur-sm overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/20 to-transparent pointer-events-none" />
              <div className="text-[10px] text-zinc-600 mb-2 uppercase tracking-widest font-mono">Platform workflow</div>
              <OrbitalNetworkGraphic className="w-full max-w-[340px] mx-auto" />
            </div>

            {/* Live activity */}
            <div className="rounded-2xl border border-zinc-800/60 bg-zinc-950/60 p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[10px] text-zinc-600 uppercase tracking-widest font-mono">Live activity</div>
                <span className="flex items-center gap-1.5 text-[10px] text-emerald-500 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  REALTIME
                </span>
              </div>
              <LiveFeed />
            </div>
          </motion.div>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-[#060b08] to-transparent pointer-events-none" />
    </section>
  );
}
