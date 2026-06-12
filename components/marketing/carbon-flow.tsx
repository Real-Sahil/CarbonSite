"use client";

import { motion, useReducedMotion } from "motion/react";

// Animated pipeline SVG: Field Evidence -> OCR -> Review -> Calculate -> Report
// Communicates: the platform's end-to-end workflow in one glance.
// SMIL animateMotion drives particle flow; JS only drives the entry animation.
const STAGES = [
  { cx: 70,  label: "Import",    abbr: "↑",  color: "#0f766e", glow: "#0f766e33" },
  { cx: 200, label: "Review",    abbr: "✓",  color: "#0ea5e9", glow: "#0ea5e933" },
  { cx: 330, label: "Calculate", abbr: "Σ",  color: "#84cc16", glow: "#84cc1633" },
  { cx: 460, label: "Publish",   abbr: "◉",  color: "#8b5cf6", glow: "#8b5cf633" },
  { cx: 590, label: "Report",    abbr: "↓",  color: "#f59e0b", glow: "#f59e0b33" },
];

const CONNECTORS = [
  { x1: 106, x2: 164, path: "M 106 85 L 164 85" },
  { x1: 236, x2: 294, path: "M 236 85 L 294 85" },
  { x1: 366, x2: 424, path: "M 366 85 L 424 85" },
  { x1: 496, x2: 554, path: "M 496 85 L 554 85" },
];

export function CarbonFlowGraphic({ className = "" }: { className?: string }) {
  const prefersReduced = useReducedMotion();

  return (
    <motion.div
      className={`select-none ${className}`}
      initial={prefersReduced ? {} : { opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.7, delay: 0.4, ease: "easeOut" }}
    >
      <svg
        viewBox="0 0 660 170"
        aria-label="CarbonSite workflow: Import, Review, Calculate, Publish, Report"
        role="img"
        className="w-full"
      >
        <defs>
          {STAGES.map((s) => (
            <radialGradient key={s.label} id={`glow-${s.label}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={s.glow} />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
          ))}
        </defs>

        {/* Glow halos behind nodes */}
        {STAGES.map((s) => (
          <circle key={`halo-${s.label}`} cx={s.cx} cy={85} r={50} fill={`url(#glow-${s.label})`} />
        ))}

        {/* Connector dashed lines */}
        {CONNECTORS.map((c, i) => (
          <line
            key={i}
            x1={c.x1} y1={85} x2={c.x2} y2={85}
            stroke="#334155"
            strokeWidth={1.5}
            strokeDasharray="5 4"
          />
        ))}

        {/* Animated particles (hidden under prefers-reduced-motion) */}
        {!prefersReduced && CONNECTORS.map((c, i) => (
          <g key={`dots-${i}`}>
            <circle r={3.5} fill={STAGES[i].color} opacity={0.9}>
              <animateMotion path={c.path} dur="1.4s" begin={`${i * 0.28}s`} repeatCount="indefinite" />
            </circle>
            <circle r={3.5} fill={STAGES[i].color} opacity={0.5}>
              <animateMotion path={c.path} dur="1.4s" begin={`${i * 0.28 + 0.7}s`} repeatCount="indefinite" />
            </circle>
          </g>
        ))}

        {/* Node circles */}
        {STAGES.map((s) => (
          <g key={`node-${s.label}`}>
            <circle cx={s.cx} cy={85} r={32} fill="none" stroke={s.color} strokeWidth={1.5} opacity={0.8} />
            <circle cx={s.cx} cy={85} r={26} fill={s.color} opacity={0.12} />
            <text
              x={s.cx} y={85}
              dominantBaseline="middle"
              textAnchor="middle"
              fill={s.color}
              fontSize={18}
              fontWeight={600}
              style={{ fontFamily: "ui-monospace, monospace" }}
            >
              {s.abbr}
            </text>
          </g>
        ))}

        {/* Node labels */}
        {STAGES.map((s) => (
          <text
            key={`label-${s.label}`}
            x={s.cx} y={138}
            dominantBaseline="middle"
            textAnchor="middle"
            fill="#94a3b8"
            fontSize={10}
            fontWeight={500}
            letterSpacing={0.8}
            textDecoration="none"
          >
            {s.label.toUpperCase()}
          </text>
        ))}
      </svg>
    </motion.div>
  );
}
