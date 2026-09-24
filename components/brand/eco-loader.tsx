import { cn } from "@/lib/utils";

// Page loader: a seedling grows while CO2 drifts in and is taken up by its
// leaves, with a slow ring for progress and rotating taglines. Pure CSS
// (keyframes in globals.css), so it renders from a server loading.tsx with
// no JavaScript. Under prefers-reduced-motion it shows the grown seedling
// and the first tagline, still.

const TAGLINES = [
  "Measuring what matters to the planet.",
  "Every tonne of CO₂e, accounted for.",
  "Evidence you can stand behind.",
  "Growing a lower-carbon future.",
];

export function EcoLoader({
  fullScreen = false,
  label = "Loading your workspace",
}: {
  fullScreen?: boolean;
  label?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex w-full flex-col items-center justify-center gap-5 px-4",
        fullScreen ? "min-h-[100dvh] bg-[#F4F8F7]" : "min-h-[60vh]",
      )}
    >
      <span className="sr-only">{label}</span>

      <svg viewBox="0 0 120 120" width="112" height="112" aria-hidden="true" className="eco-loader">
        {/* progress ring */}
        <circle cx="60" cy="60" r="52" fill="none" stroke="#E6F4F1" strokeWidth="3" />
        <circle
          className="eco-ring"
          cx="60"
          cy="60"
          r="52"
          fill="none"
          stroke="#0F766E"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="70 257"
        />

        {/* soil */}
        <path d="M34 92 Q60 86 86 92" fill="none" stroke="#A7D4CF" strokeWidth="3" strokeLinecap="round" />

        {/* CO2 drifting in and absorbed by the leaves */}
        <circle className="eco-co2 eco-co2-1" cx="26" cy="40" r="2.4" fill="#0F766E" />
        <circle className="eco-co2 eco-co2-2" cx="92" cy="30" r="2" fill="#0F766E" />
        <circle className="eco-co2 eco-co2-3" cx="30" cy="62" r="1.8" fill="#0F766E" />

        {/* seedling */}
        <path
          className="eco-stem"
          d="M60 90 C60 78 59 66 60 52"
          fill="none"
          stroke="#15803D"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path className="eco-leaf eco-leaf-left" d="M60 72 C48 72 40 65 37 55 C50 54 58 60 60 72 Z" fill="#15803D" />
        <path className="eco-leaf eco-leaf-right" d="M60 58 C72 58 81 50 84 38 C70 37 62 45 60 58 Z" fill="#84CC16" />
      </svg>

      <div className="flex flex-col items-center gap-1.5 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0F766E]">MetricOra</p>
        <div className="eco-taglines relative h-6 w-[min(22rem,90vw)]" aria-hidden="true">
          {TAGLINES.map((t, i) => (
            <p
              key={t}
              className="eco-tagline absolute inset-0 text-sm text-[#374151]"
              style={{ animationDelay: `${i * 3}s` }}
            >
              {t}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
