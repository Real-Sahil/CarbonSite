"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

// Single-point reduced-motion gate for all motion/react animations.
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
