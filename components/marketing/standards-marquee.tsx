"use client";

import { useReducedMotion } from "motion/react";

const STANDARDS = [
  "GHG Protocol Corporate Standard",
  "DEFRA 2025 Conversion Factors",
  "IPCC AR6 GWP-100 Values",
  "SECR Compliance",
  "ISO 14064-1",
  "Scope 1, 2 and 3 Reporting",
  "TCFD-aligned Disclosure",
  "CDP Reporting Ready",
  "Science Based Targets",
  "PAS 2080 Carbon",
];

// Max one marquee per page. Communicates: platform breadth at a glance.
export function StandardsMarquee() {
  const prefersReduced = useReducedMotion();

  const items = [...STANDARDS, ...STANDARDS]; // double for seamless loop

  return (
    <div className="overflow-hidden border-y border-zinc-200 bg-slate-50 py-4">
      <div
        className="flex gap-8 whitespace-nowrap"
        style={
          prefersReduced
            ? {}
            : {
                animation: "marquee 40s linear infinite",
              }
        }
      >
        {items.map((s, i) => (
          <span key={i} className="flex items-center gap-3 text-sm text-zinc-500 shrink-0">
            <span className="w-1 h-1 rounded-full bg-emerald-500 inline-block shrink-0" />
            {s}
          </span>
        ))}
      </div>
      <style>{`
        @keyframes marquee {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .marquee-inner { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
