"use client";

import { Gauge } from "./gauge";

interface BklitDataGaugeProps {
  /** 0-100 percentage */
  value: number;
  label?: string;
  size?: number;
}

export function BklitDataGauge({
  value,
  label = "Confidence",
  size = 180,
}: BklitDataGaugeProps) {
  const activeGradient: readonly [string, string] =
    value >= 90
      ? (["#059669", "#34d399"] as const)
      : value >= 50
        ? (["#d97706", "#fbbf24"] as const)
        : (["#dc2626", "#f87171"] as const);

  return (
    <Gauge
      orientation="arc"
      value={value}
      totalNotches={36}
      spacing={0.18}
      useGradient
      activeGradient={activeGradient}
      centerValue={value}
      suffix="%"
      defaultLabel={label}
      width={size}
      height={size}
      startAngle={-Math.PI * 0.75}
      endAngle={Math.PI * 0.75}
    />
  );
}
