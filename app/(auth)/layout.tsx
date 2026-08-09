import React from "react";
import Link from "next/link";
import { Shield, Zap, CheckCircle } from "lucide-react";
import { OrbitalNetworkGraphic } from "@/components/marketing/orbital-network";

const TRUST_ITEMS = [
  { icon: Shield,       text: "Audit-grade evidence trail" },
  { icon: Zap,          text: "Immutable published snapshots" },
  { icon: CheckCircle,  text: "Scope 1, 2 and 3 from one platform" },
];

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[100dvh] flex">
      {/* ── Left panel (dark) ─────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[44%] xl:w-[42%] flex-col relative bg-[#071410] overflow-hidden shrink-0">
        {/* Ambient glows */}
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-emerald-900/25 blur-[90px] rounded-full pointer-events-none" />
        <div className="absolute bottom-16 right-4 w-56 h-56 bg-emerald-800/15 blur-[70px] rounded-full pointer-events-none" />

        {/* Dot grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(34,197,94,0.05) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full px-10 py-10">
          {/* Brand */}
          <Link href="/" className="text-white font-semibold text-lg tracking-tight shrink-0">
            CarbonSite
          </Link>

          {/* Middle: headline + trust */}
          <div className="flex-1 flex flex-col justify-center">
            <p className="text-[10px] text-emerald-500 font-mono uppercase tracking-widest mb-5">
              DEFRA 2025 · GHG Protocol · IPCC AR6
            </p>
            <h2 className="text-3xl xl:text-4xl font-semibold tracking-tighter leading-tight text-white mb-4">
              Carbon accounting<br />built for the field.
            </h2>
            <p className="text-sm text-zinc-400 leading-relaxed max-w-[34ch]">
              Capture evidence, run calculations to GHG Protocol standards, publish audit-ready reports.
            </p>

            <div className="mt-8 flex flex-col gap-3">
              {TRUST_ITEMS.map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2.5 text-xs text-zinc-400">
                  <Icon className="h-3.5 w-3.5 text-emerald-500 shrink-0" aria-hidden="true" />
                  {text}
                </div>
              ))}
            </div>

            {/* Orbital graphic */}
            <div className="mt-10 opacity-50">
              <OrbitalNetworkGraphic className="w-full max-w-[220px] xl:max-w-[260px]" />
            </div>
          </div>

          {/* Bottom: compliance label */}
          <p className="text-[10px] text-zinc-700 font-mono tracking-wider shrink-0">
            GHG PROTOCOL · ISO 14064 · IPCC AR6
          </p>
        </div>
      </div>

      {/* ── Right panel (light) ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-[#F9FAFB] px-6 py-12 min-h-[100dvh]">
        {/* Mobile brand (hidden on lg+) */}
        <div className="lg:hidden mb-8 text-center">
          <span className="text-xl font-semibold tracking-tight text-[#0EA5E9]">CarbonSite</span>
          <p className="text-xs text-zinc-500 mt-1">GHG Emissions Tracking</p>
        </div>

        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
