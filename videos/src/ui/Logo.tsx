import { Easing } from "remotion";

import { step } from "../kit/spring";
import { clamp01 } from "../kit/time";
import { C, FONT } from "./tokens";

const land = Easing.bezier(0.22, 1, 0.36, 1);
const pop = { stiffness: 180, damping: 16 };

/**
 * The MetricOra mark (public/logo.svg): a rounded orange-to-amber square with a
 * white M stroke. Driven by time only: `appear` is when the square scales in,
 * `draw` when the M starts drawing itself.
 */
export function Mark({ t, appear, draw, size }: { t: number; appear: number; draw: number; size: number }) {
  const s = step(t - appear, pop);
  const d = land(clamp01((t - draw) / 0.9));
  if (t < appear) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" style={{ display: "block", scale: String(Math.max(0, s)), overflow: "visible" }}>
      <defs>
        <linearGradient id="mark-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={C.logoFrom} />
          <stop offset="100%" stopColor={C.logoTo} />
        </linearGradient>
      </defs>
      <rect width="56" height="56" rx="12" fill="url(#mark-bg)" />
      <path
        d="M11.5 44.5 L20 14 L28 30 L36 14 L44.5 44.5"
        pathLength={100}
        stroke="#FFFFFF"
        strokeWidth={5}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="100 100"
        strokeDashoffset={100 * (1 - d)}
        opacity={d > 0 ? 1 : 0}
      />
    </svg>
  );
}

/** "MetricOra": lands in two groups ("Metric", "Ora") on the beat, each word blurring in. */
export function Wordmark({ t, at, size, color = C.onDark }: { t: number; at: number; size: number; color?: string }) {
  const parts = [
    { text: "Metric", at },
    { text: "Ora", at: at + 0.25 },
  ];
  return (
    <div style={{ display: "flex", fontFamily: FONT, fontWeight: 700, fontSize: size, letterSpacing: "-0.02em", color, lineHeight: 1 }}>
      {parts.map((p) => {
        const u = land(clamp01((t - p.at) / 0.4));
        return (
          <span key={p.text} style={{ opacity: u, translate: `${(1 - u) * -24}px 0`, filter: u < 1 ? `blur(${(1 - u) * 12}px)` : undefined }}>
            {p.text}
          </span>
        );
      })}
    </div>
  );
}
