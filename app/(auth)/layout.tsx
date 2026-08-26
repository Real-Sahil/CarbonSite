import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Shield, Zap, CheckCircle, Leaf } from "lucide-react";
import { getSession } from "@/lib/auth/session";

const TRUST_ITEMS = [
  { icon: Shield,       text: "Audit-grade evidence trail" },
  { icon: Zap,          text: "Immutable published snapshots" },
  { icon: CheckCircle,  text: "Scope 1, 2 and 3 from one platform" },
];

const FLOATING_STATS = [
  { value: "DEFRA 2025", sub: "Factor library" },
  { value: "GHG Protocol", sub: "Standard" },
  { value: "ISO 14064", sub: "Compatible" },
];

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (session) redirect("/app");

  return (
    <div className="min-h-[100dvh] flex">
      {/* ── Left panel — mesh gradient dark ──────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[46%] xl:w-[44%] flex-col relative overflow-hidden shrink-0 bg-[#060612]">

        {/* Mesh gradient blobs */}
        <div className="absolute -top-32 -left-32 w-[480px] h-[480px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(245,158,11,0.5)_0%,transparent_65%)] pointer-events-none" />
        <div className="absolute top-1/2 right-[-80px] w-[320px] h-[320px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(6,182,212,0.3)_0%,transparent_65%)] pointer-events-none" />
        <div className="absolute bottom-[-60px] left-1/3 w-[300px] h-[300px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(124,58,237,0.2)_0%,transparent_65%)] pointer-events-none" />
        <div className="absolute bottom-1/4 left-[-40px] w-[240px] h-[240px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.2)_0%,transparent_65%)] pointer-events-none" />

        {/* Grid overlay */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px)", backgroundSize: "48px 48px" }} />

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full px-10 py-10">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-400 shadow-[0_0_16px_rgba(245,158,11,0.5)]">
              <Leaf className="h-3.5 w-3.5 text-white" />
            </span>
            <span className="text-white font-semibold text-[15px] tracking-tight">CarbonSite</span>
          </Link>

          {/* Main copy */}
          <div className="flex-1 flex flex-col justify-center">
            <p className="text-[10px] text-amber-400 font-mono uppercase tracking-[0.14em] mb-5">
              DEFRA 2025 · GHG Protocol · IPCC AR6
            </p>
            <h2 className="text-3xl xl:text-4xl font-semibold tracking-[-0.03em] leading-tight text-white mb-4">
              Carbon accounting
              <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-300 to-orange-300">
                built for the field.
              </span>
            </h2>
            <p className="text-sm text-white/40 leading-relaxed max-w-[34ch] mb-8">
              Capture evidence, run calculations to GHG Protocol standards, publish audit-ready reports.
            </p>

            {/* Trust items */}
            <div className="flex flex-col gap-3 mb-10">
              {TRUST_ITEMS.map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/5 border border-white/8">
                    <Icon className="h-3 w-3 text-amber-400" />
                  </div>
                  <span className="text-xs text-white/50">{text}</span>
                </div>
              ))}
            </div>

            {/* Glassmorphic stat pills */}
            <div className="flex flex-col gap-2">
              {FLOATING_STATS.map((s) => (
                <div key={s.value} className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-white/8 bg-white/4 backdrop-blur-sm">
                  <div className="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
                  <span className="text-xs font-medium text-white/70">{s.value}</span>
                  <span className="text-xs text-white/30 ml-auto">{s.sub}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer label */}
          <p className="text-[10px] text-white/15 font-mono tracking-wider shrink-0">
            GHG PROTOCOL · ISO 14064 · IPCC AR6
          </p>
        </div>
      </div>

      {/* ── Right panel — glassmorphic form area ─────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-[#060612] px-6 py-12 min-h-[100dvh] relative overflow-hidden">
        {/* Subtle mesh on right panel */}
        <div className="absolute top-1/3 right-0 w-[320px] h-[320px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(6,182,212,0.1)_0%,transparent_70%)] pointer-events-none" />
        <div className="absolute bottom-1/4 left-0 w-[280px] h-[280px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(13,148,136,0.08)_0%,transparent_70%)] pointer-events-none" />

        {/* Mobile brand */}
        <div className="lg:hidden mb-8 text-center relative z-10">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-400 shadow-[0_0_16px_rgba(245,158,11,0.45)]">
              <Leaf className="h-4 w-4 text-white" />
            </span>
            <span className="text-white font-semibold text-lg tracking-tight">CarbonSite</span>
          </Link>
          <p className="text-xs text-white/35 mt-2">GHG Emissions Tracking</p>
        </div>

        {/* Form card */}
        <div className="relative z-10 w-full max-w-sm">
          <div className="rounded-2xl border border-white/8 bg-white/4 backdrop-blur-xl shadow-[0_8px_48px_rgba(0,0,0,0.5)] p-7">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
