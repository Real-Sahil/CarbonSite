"use client";

import { useReducedMotion } from "motion/react";

const STANDARDS = [
  "GHG Protocol Corporate Standard",
  "DEFRA 2025 Conversion Factors",
  "EPA GHG Hub",
  "IPCC AR6 GWP-100 Values",
  "Boavizta Environmental Footprint",
  "SECR Compliance",
  "ISO 14064-1",
  "Scope 1, 2 and 3 Reporting",
  "TCFD-aligned Disclosure",
  "CDP Reporting Ready",
  "Science Based Targets",
  "PAS 2080 Carbon",
];

export function StandardsMarquee() {
  const prefersReduced = useReducedMotion();
  const items = [...STANDARDS, ...STANDARDS];

  return (
    <div className="overflow-hidden border-y border-[#1E293B] bg-[#111110] py-3.5">
      <div
        className="flex gap-10 whitespace-nowrap"
        style={prefersReduced ? {} : { animation: "marquee 50s linear infinite" }}
      >
        {items.map((s, i) => (
          <span key={i} className="flex items-center gap-3 text-[11px] text-[#06B6D4] tracking-[0.06em] shrink-0">
            <span className="w-1 h-1 rounded-full bg-[#06B6D4] inline-block shrink-0" />
            {s}
          </span>
        ))}
      </div>
      <style>{`
        @keyframes marquee {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
