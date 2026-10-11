"use client";

import { ExpandChart } from "./expand-chart";
import { Gauge } from "./gauge";

interface BklitDataGaugeProps {
  /** 0-100 percentage */
  value: number;
  label?: string;
  size?: number;
}

/** Gauge with an expand button; the full-screen view is about 1.8 times the inline size. */
export function BklitDataGauge({
  value,
  label = "Confidence",
  size = 180,
}: BklitDataGaugeProps) {
  return (
    <ExpandChart title={label}>
      {(expanded) => <BklitDataGaugeBody value={value} label={label} size={expanded ? Math.round(size * 1.8) : size} />}
    </ExpandChart>
  );
}

function BklitDataGaugeBody({ value, label, size }: Required<BklitDataGaugeProps>) {
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
