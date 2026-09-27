import { Easing } from "remotion";

import { step } from "../kit/spring";
import { clamp01 } from "../kit/time";

export const landEase = Easing.bezier(0.22, 1, 0.36, 1);

/** 0 to 1 over `length` seconds from `start`, on the landing ease. */
export const ease = (t: number, start: number, length = 0.3) => landEase(clamp01((t - start) / length));

/** A word, field or row arriving: blur in from 12 px, rise `rise` px. */
export function arrive(t: number, start: number, rise = 18, length = 0.3) {
  const u = ease(t, start, length);
  return { opacity: u, translate: `0 ${(1 - u) * rise}px`, filter: u < 1 ? `blur(${(1 - u) * 12}px)` : undefined } as const;
}

/** A whole scene: blur and scale in at `from`, blur out ending at `to`. */
export function scene(t: number, from: number, to: number, enter = 0.4, leave = 0.3) {
  const i = step(t - from, { stiffness: 140, damping: 22 });
  const o = clamp01((t - (to - leave)) / leave);
  const v = clamp01(i) * (1 - o);
  return {
    visible: t >= from - 0.01 && t <= to + 0.01,
    style: {
      opacity: v,
      scale: String(0.96 + 0.04 * i - 0.03 * o),
      filter: v < 0.999 ? `blur(${(1 - v) * 14}px)` : undefined,
    },
  };
}

/** A number counting up to `value` over `length` seconds, formatted like the app. */
export function countUp(t: number, start: number, length: number, value: number, decimals = 2) {
  const u = landEase(clamp01((t - start) / length));
  return (value * u).toLocaleString("en-GB", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** A tap on the phone: a gray disc that grows and fades. */
export function tap(t: number, at: number) {
  const u = clamp01((t - at + 0.08) / 0.45);
  return { visible: u > 0 && u < 1, scale: 0.5 + 0.8 * u, opacity: 0.35 * (1 - u) };
}
