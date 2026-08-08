"use client";

import { motion, useReducedMotion } from "motion/react";

const CX = 200;
const CY = 200;

function polar(r: number, angleDeg: number) {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

const RING1_NODES = [
  { label: "IMPORT",    abbr: "↑", angle: 270, color: "#22c55e", r: 68 },
  { label: "REVIEW",    abbr: "✓", angle: 30,  color: "#38bdf8", r: 68 },
  { label: "CALCULATE", abbr: "Σ", angle: 150, color: "#a78bfa", r: 68 },
];

const RING2_NODES = [
  { label: "PUBLISH", abbr: "◉", angle: 340, color: "#fbbf24", r: 120 },
  { label: "REPORT",  abbr: "↓", angle: 160, color: "#fb7185", r: 120 },
];

const RING1_PATH = `M ${CX} ${CY - 68} A 68 68 0 1 1 ${CX - 0.001} ${CY - 68}`;
const RING2_PATH = `M ${CX} ${CY - 120} A 120 120 0 1 1 ${CX - 0.001} ${CY - 120}`;

export function OrbitalNetworkGraphic({ className = "" }: { className?: string }) {
  const prefersReduced = useReducedMotion();

  return (
    <motion.svg
      viewBox="0 0 400 400"
      className={className}
      aria-hidden="true"
      initial={prefersReduced ? {} : { opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.9, ease: "easeOut", delay: 0.3 }}
    >
      <defs>
        <radialGradient id="orb-center-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#22c55e" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="orb-outer-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#0f3e17" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#0f3e17" stopOpacity="0" />
        </radialGradient>
        <filter id="orb-node-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Background ambient glow */}
      <circle cx={CX} cy={CY} r={195} fill="url(#orb-outer-glow)" />
      <circle cx={CX} cy={CY} r={100} fill="url(#orb-center-glow)" />

      {/* Ring 3 (decorative, outermost) */}
      <circle cx={CX} cy={CY} r={160} fill="none" stroke="#22c55e" strokeOpacity="0.05" strokeWidth="1" />

      {/* Ring 2 dashed */}
      <circle cx={CX} cy={CY} r={120} fill="none" stroke="#22c55e" strokeOpacity="0.09" strokeWidth="1" strokeDasharray="4 10" />

      {/* Ring 1 solid */}
      <circle cx={CX} cy={CY} r={68} fill="none" stroke="#22c55e" strokeOpacity="0.18" strokeWidth="1" />

      {/* Animated particles on ring 1 */}
      {!prefersReduced && (
        <>
          <circle r="3.5" fill="#22c55e" opacity="0.9">
            <animateMotion path={RING1_PATH} dur="6s" repeatCount="indefinite" />
          </circle>
          <circle r="3.5" fill="#22c55e" opacity="0.35">
            <animateMotion path={RING1_PATH} dur="6s" begin="3s" repeatCount="indefinite" />
          </circle>
          <circle r="3" fill="#fbbf24" opacity="0.75">
            <animateMotion path={RING2_PATH} dur="10s" repeatCount="indefinite" />
          </circle>
          <circle r="3" fill="#fb7185" opacity="0.4">
            <animateMotion path={RING2_PATH} dur="10s" begin="5s" repeatCount="indefinite" />
          </circle>
        </>
      )}

      {/* Connecting spokes from center to ring 1 nodes */}
      {RING1_NODES.map((node) => {
        const outer = polar(node.r - 20, node.angle);
        const inner = polar(36, node.angle);
        return (
          <line
            key={`spoke-${node.label}`}
            x1={inner.x} y1={inner.y}
            x2={outer.x} y2={outer.y}
            stroke={node.color}
            strokeOpacity="0.12"
            strokeWidth="1"
            strokeDasharray="3 5"
          />
        );
      })}

      {/* Ring 1 nodes */}
      {RING1_NODES.map((node) => {
        const pos = polar(node.r, node.angle);
        const labelPos = polar(node.r + 30, node.angle);
        return (
          <g key={node.label} filter="url(#orb-node-glow)">
            <circle cx={pos.x} cy={pos.y} r={26} fill={node.color} fillOpacity="0.07" />
            <circle cx={pos.x} cy={pos.y} r={19} fill="#060d0a" stroke={node.color} strokeOpacity="0.55" strokeWidth="1.5" />
            <circle cx={pos.x} cy={pos.y} r={17} fill={node.color} fillOpacity="0.08" />
            <text
              x={pos.x} y={pos.y}
              dominantBaseline="middle"
              textAnchor="middle"
              fill={node.color}
              fontSize="11"
              fontWeight="700"
              fontFamily="ui-monospace, monospace"
            >
              {node.abbr}
            </text>
            <text
              x={labelPos.x} y={labelPos.y}
              dominantBaseline="middle"
              textAnchor="middle"
              fill="#4d7a5a"
              fontSize="7"
              letterSpacing="0.8"
              fontFamily="ui-monospace, monospace"
            >
              {node.label}
            </text>
          </g>
        );
      })}

      {/* Ring 2 nodes */}
      {RING2_NODES.map((node) => {
        const pos = polar(node.r, node.angle);
        const labelPos = polar(node.r + 34, node.angle);
        return (
          <g key={node.label} filter="url(#orb-node-glow)">
            <circle cx={pos.x} cy={pos.y} r={32} fill={node.color} fillOpacity="0.05" />
            <circle cx={pos.x} cy={pos.y} r={24} fill="#060d0a" stroke={node.color} strokeOpacity="0.45" strokeWidth="1.5" />
            <circle cx={pos.x} cy={pos.y} r={22} fill={node.color} fillOpacity="0.07" />
            <text
              x={pos.x} y={pos.y}
              dominantBaseline="middle"
              textAnchor="middle"
              fill={node.color}
              fontSize="14"
              fontWeight="700"
              fontFamily="ui-monospace, monospace"
            >
              {node.abbr}
            </text>
            <text
              x={labelPos.x} y={labelPos.y}
              dominantBaseline="middle"
              textAnchor="middle"
              fill="#4d7a5a"
              fontSize="7"
              letterSpacing="0.8"
              fontFamily="ui-monospace, monospace"
            >
              {node.label}
            </text>
          </g>
        );
      })}

      {/* Center node */}
      <circle cx={CX} cy={CY} r={38} fill="#060d0a" stroke="#22c55e" strokeOpacity="0.35" strokeWidth="1.5" />
      <circle cx={CX} cy={CY} r={34} fill="#22c55e" fillOpacity="0.07" />
      {!prefersReduced && (
        <circle cx={CX} cy={CY} r={38} fill="none" stroke="#22c55e" strokeOpacity="0.18" strokeWidth="6">
          <animate attributeName="r" values="38;46;38" dur="3s" repeatCount="indefinite" />
          <animate attributeName="stroke-opacity" values="0.18;0;0.18" dur="3s" repeatCount="indefinite" />
        </circle>
      )}
      <text
        x={CX} y={CY - 7}
        dominantBaseline="middle"
        textAnchor="middle"
        fill="#22c55e"
        fontSize="12"
        fontWeight="700"
        letterSpacing="-0.3"
        fontFamily="ui-sans-serif, system-ui"
      >
        CO₂e
      </text>
      <text
        x={CX} y={CY + 9}
        dominantBaseline="middle"
        textAnchor="middle"
        fill="#22c55e"
        fillOpacity="0.45"
        fontSize="7.5"
        letterSpacing="1"
        fontFamily="ui-monospace, monospace"
      >
        PLATFORM
      </text>
    </motion.svg>
  );
}
