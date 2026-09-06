"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";

// Animated phone frame showing the capture flow states:
// Camera -> OCR scanning -> Pre-filled form -> Submitted
// Pure CSS/SVG - no external images required.
const STAGES = [
  { label: "Camera", icon: "📷", color: "#e76f51" },
  { label: "OCR scanning...", icon: "🔍", color: "#f4a261" },
  { label: "Form pre-filled", icon: "✎", color: "#f97316" },
  { label: "Submitted", icon: "✓", color: "#e9c46a" },
];

export function PhoneCaptureMock() {
  const [stage, setStage] = useState(0);
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    if (prefersReduced) return;
    const interval = setInterval(() => {
      setStage((s) => (s + 1) % STAGES.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [prefersReduced]);

  const current = STAGES[stage];

  return (
    <div className="relative mx-auto" style={{ width: 220 }}>
      {/* Phone frame */}
      <svg viewBox="0 0 220 420" className="w-full drop-shadow-2xl">
        {/* Body */}
        <rect x={2} y={2} width={216} height={416} rx={28} fill="#09090b" stroke="#27272a" strokeWidth={2} />
        {/* Screen area */}
        <rect x={10} y={18} width={200} height={384} rx={20} fill="#0f172a" />
        {/* Notch */}
        <rect x={80} y={18} width={60} height={10} rx={5} fill="#09090b" />
        {/* Volume buttons */}
        <rect x={-2} y={90} width={4} height={30} rx={2} fill="#27272a" />
        <rect x={-2} y={130} width={4} height={30} rx={2} fill="#27272a" />
        {/* Power button */}
        <rect x={218} y={110} width={4} height={40} rx={2} fill="#27272a" />
      </svg>

      {/* Screen content - overlaid absolutely */}
      <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ top: 18, left: 10, right: 10, bottom: 18 }}>
        <div
          className="w-full h-full rounded-[20px] flex flex-col overflow-hidden"
          style={{ background: "#0f172a" }}
        >
          {/* Status bar */}
          <div className="flex items-center justify-between px-4 pt-2 pb-1">
            <span className="text-white text-[8px] font-medium">9:41</span>
            <div className="flex items-center gap-1">
              <div className="w-3 h-1.5 rounded-sm bg-white opacity-60" />
              <div className="w-1 h-1 rounded-full bg-emerald-400" />
            </div>
          </div>

          {/* Header */}
          <div className="px-3 pb-2 border-b border-white/10">
            <div className="text-white text-[11px] font-semibold">MetricOra</div>
            <div className="text-zinc-400 text-[8px]">Field Capture</div>
          </div>

          {/* Main content area */}
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-4">
            {stage === 0 && (
              <>
                <div className="w-24 h-20 rounded-lg border border-dashed border-zinc-600 flex items-center justify-center">
                  <span className="text-2xl">{current.icon}</span>
                </div>
                <div className="text-white text-[9px] font-medium">Waste Ticket</div>
                <div className="w-full grid grid-cols-3 gap-1">
                  {["Waste", "Delivery", "Fuel", "Other"].map((t) => (
                    <div key={t} className={`rounded text-[7px] py-1 text-center ${t === "Waste" ? "bg-emerald-700 text-white" : "bg-zinc-800 text-zinc-400"}`}>
                      {t}
                    </div>
                  ))}
                </div>
              </>
            )}
            {stage === 1 && (
              <>
                <div className="w-24 h-20 rounded-lg bg-zinc-800 flex items-center justify-center relative overflow-hidden">
                  <span className="text-xl">{current.icon}</span>
                  <div className="absolute inset-x-0 h-0.5 bg-blue-400/60"
                    style={{ top: "30%", animation: "scan 1.5s linear infinite" }} />
                </div>
                <div className="text-blue-400 text-[9px] animate-pulse">Recognising text...</div>
                <div className="w-full space-y-1">
                  {["Weight: 2.4t", "EWC: 17 01 01", "Date: 12/06/26"].map((field) => (
                    <div key={field} className="bg-zinc-800/60 rounded px-2 py-1 text-[7px] text-zinc-300 font-mono">{field}</div>
                  ))}
                </div>
              </>
            )}
            {stage === 2 && (
              <>
                <div className="text-violet-400 text-[9px] font-medium">Auto-extracted fields</div>
                <div className="w-full space-y-1.5">
                  {[
                    { label: "Weight", value: "2.4 t", auto: true },
                    { label: "EWC code", value: "17 01 01", auto: true },
                    { label: "Date", value: "12/06/26", auto: true },
                    { label: "Notes", value: "", auto: false },
                  ].map((f) => (
                    <div key={f.label}>
                      <div className="text-[6px] text-zinc-500 mb-0.5">{f.label} {f.auto && <span className="text-violet-400">Auto</span>}</div>
                      <div className={`rounded px-2 py-1 text-[8px] ${f.auto ? "bg-violet-900/30 border border-violet-700/40 text-violet-200" : "bg-zinc-800 text-zinc-400"}`}>
                        {f.value || "Enter..."}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {stage === 3 && (
              <>
                <div className="w-12 h-12 rounded-full bg-emerald-600/20 border border-emerald-600 flex items-center justify-center">
                  <span className="text-emerald-400 text-xl">✓</span>
                </div>
                <div className="text-emerald-400 text-[10px] font-semibold">Submitted</div>
                <div className="text-zinc-400 text-[8px] text-center">
                  Queued for sync.{"\n"}Awaiting review.
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-1.5">
                  <div className="bg-emerald-500 h-1.5 rounded-full w-1/3" />
                </div>
                <div className="text-zinc-500 text-[7px]">1 of 3 synced</div>
              </>
            )}
          </div>

          {/* Stage indicator */}
          <div className="flex justify-center gap-1.5 pb-4">
            {STAGES.map((s, i) => (
              <div
                key={i}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === stage ? 14 : 6,
                  height: 6,
                  background: i === stage ? current.color : "#334155",
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes scan {
          0%   { top: 10%; }
          100% { top: 90%; }
        }
      `}</style>
    </div>
  );
}
