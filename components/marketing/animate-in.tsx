"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

interface AnimateInProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}

// Slide-up entrance triggered when the element enters the viewport.
// Only animates `transform` (never opacity) so SSR HTML is always visible —
// content is never invisible during the JS-loading window.
// Collapses to instant under prefers-reduced-motion.
export function AnimateIn({ children, className, delay = 0, y = 24 }: AnimateInProps) {
  const prefersReduced = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={prefersReduced ? {} : { y }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

export function AnimateInStagger({
  children,
  className,
  stagger = 0.08,
}: {
  children: ReactNode[];
  className?: string;
  stagger?: number;
}) {
  const prefersReduced = useReducedMotion();

  return (
    <div className={className}>
      {children.map((child, i) => (
        <motion.div
          key={i}
          initial={prefersReduced ? {} : { y: 20 }}
          whileInView={{ y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.45, delay: i * stagger, ease: "easeOut" }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  );
}
