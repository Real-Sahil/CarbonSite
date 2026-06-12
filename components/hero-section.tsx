"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { CarbonFlowGraphic } from "@/components/marketing/carbon-flow";

const NAV_LINKS = [
  { href: "/product", label: "Product" },
  { href: "/solutions/construction", label: "Construction" },
  { href: "/solutions/waste-haulage", label: "Waste & Haulage" },
  { href: "/field-app", label: "Field App" },
  { href: "/security", label: "Security" },
  { href: "/resources", label: "Resources" },
];

const WORDS = ["construction", "haulage", "supply chains", "your sector"];

// Cycling industry keyword. Communicates: platform breadth without a wall of text.
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
      className="text-emerald-400 inline-block transition-all duration-300"
      style={{ opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(-8px)" }}
    >
      {WORDS[idx]}
    </span>
  );
}

// Grid dot pattern background - CSS only.
function DotGrid() {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage:
          "radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)",
        backgroundSize: "32px 32px",
      }}
    />
  );
}

export function HeroSection() {
  const prefersReduced = useReducedMotion();

  return (
    <section className="relative min-h-[100dvh] flex flex-col overflow-hidden bg-zinc-950 text-white">
      <DotGrid />

      {/* Ambient glow */}
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-emerald-900/20 blur-[120px] rounded-full pointer-events-none" />

      {/* Nav */}
      <div className="relative z-10 px-5 md:px-10 pt-5">
        <nav
          className="liquid-glass rounded-xl px-5 py-3 flex items-center justify-between"
          style={{ maxHeight: 56 }}
        >
          <span className="text-lg font-semibold tracking-tight text-white">CarbonSite</span>
          <div className="hidden lg:flex items-center gap-6 text-sm text-zinc-400">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-white transition-colors">
                {link.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Link href="/sign-in" className="hidden md:inline-flex text-sm text-zinc-400 hover:text-white px-3 py-1.5 transition-colors">
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="text-sm px-4 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors active:scale-[0.97]"
            >
              Start free
            </Link>
          </div>
        </nav>
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 flex items-center">
        <div className="mx-auto max-w-7xl w-full px-5 md:px-10 py-16 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left: headline + sub + CTA */}
          <div>
            <motion.div
              initial={prefersReduced ? {} : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-800 bg-emerald-950/50 px-3 py-1 mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-emerald-400 font-medium">DEFRA 2025 - GHG Protocol - IPCC AR6</span>
              </div>
            </motion.div>

            <motion.h1
              className="text-5xl md:text-6xl xl:text-7xl font-semibold tracking-tighter leading-[1.05] mb-6"
              initial={prefersReduced ? {} : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
            >
              Carbon accounting
              <br />
              built for{" "}
              <CyclingWord />
            </motion.h1>

            <motion.p
              className="text-lg text-zinc-400 leading-relaxed max-w-[50ch] mb-8"
              initial={prefersReduced ? {} : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
            >
              Import field evidence, run calculations to GHG Protocol standards,
              publish immutable snapshots, generate audit-ready reports.
              Scope 1, 2 and 3 from a single platform.
            </motion.p>

            <motion.div
              className="flex flex-wrap gap-3"
              initial={prefersReduced ? {} : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
            >
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-colors active:scale-[0.97]"
              >
                Create organisation
              </Link>
              <Link
                href="/product"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-zinc-700 text-zinc-300 text-sm font-medium hover:border-zinc-500 hover:text-white transition-colors active:scale-[0.97]"
              >
                Explore product
              </Link>
            </motion.div>

            <motion.div
              className="mt-10 flex items-center gap-6"
              initial={prefersReduced ? {} : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              {[
                { value: "23", label: "DEFRA factors" },
                { value: "6", label: "RBAC roles" },
                { value: "100%", label: "Audit traceable" },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-2xl font-semibold text-white">{stat.value}</div>
                  <div className="text-xs text-zinc-500">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right: animated carbon flow diagram */}
          <div className="hidden lg:flex flex-col gap-6">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur-sm">
              <div className="text-xs text-zinc-500 mb-4 uppercase tracking-widest">Platform workflow</div>
              <CarbonFlowGraphic />
            </div>

            {/* Live activity feed mock */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 backdrop-blur-sm">
              <div className="text-xs text-zinc-500 mb-3 uppercase tracking-widest">Recent activity</div>
              <div className="space-y-2">
                {[
                  { action: "Waste ticket submitted", time: "2s ago", color: "emerald" },
                  { action: "Calculation run succeeded", time: "4m ago", color: "sky" },
                  { action: "Report generated", time: "12m ago", color: "violet" },
                ].map((item) => (
                  <div key={item.action} className="flex items-center gap-3 text-xs">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 bg-${item.color}-500`} />
                    <span className="text-zinc-300 flex-1">{item.action}</span>
                    <span className="text-zinc-600">{item.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-zinc-950 to-transparent pointer-events-none" />
    </section>
  );
}
