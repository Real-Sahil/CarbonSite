"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * Text with a light sweep, for work in progress ("Drafting", "Calculating").
 * Adapted from ForgeUI's TextShimmer (Aman Shakya, forgeui.in; use and
 * modification allowed, no redistribution as a library). Changes: the motion
 * element is created once rather than on every render, it stands still under
 * reduced motion, and colours come from the page rather than fixed hex values.
 */
const MotionSpan = motion.create("span");

export function TextShimmer({
  children,
  className,
  duration = 2,
  spread = 2,
}: {
  children: string;
  className?: string;
  duration?: number;
  spread?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <span className={cn("text-zinc-600", className)}>{children}</span>;
  return (
    <MotionSpan
      className={cn(
        "inline-block bg-size-[250%_100%,auto] bg-clip-text text-transparent [--shimmer-base:#71717a] [--shimmer-peak:#18181b] [background-repeat:no-repeat,padding-box]",
        className,
      )}
      initial={{ backgroundPosition: "105% center" }}
      animate={{ backgroundPosition: "-5% center" }}
      transition={{ repeat: Number.POSITIVE_INFINITY, duration, ease: "linear" }}
      style={
        {
          "--spread": `${children.length * spread}px`,
          backgroundImage:
            "linear-gradient(90deg,#0000 calc(50% - var(--spread)),var(--shimmer-peak),#0000 calc(50% + var(--spread))),linear-gradient(var(--shimmer-base),var(--shimmer-base))",
        } as React.CSSProperties
      }
    >
      {children}
    </MotionSpan>
  );
}
