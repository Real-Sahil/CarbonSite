'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useInView } from 'motion/react';

export interface NumberTickerProps {
  value: number;
  duration?: number;
  delay?: number;
  direction?: 'up' | 'down';
  decimals?: number;
  className?: string;
}

export function NumberTicker({
  value,
  duration = 2,
  delay = 0,
  direction = 'up',
  decimals = 0,
  className = '',
}: NumberTickerProps) {
  const ref = useRef(null);
  const isInView = useInView(ref);
  const [displayValue, setDisplayValue] = useState(direction === 'down' ? value : 0);

  useEffect(() => {
    if (!isInView) return;

    const startValue = direction === 'down' ? value : 0;
    const endValue = direction === 'down' ? 0 : value;
    const startTime = performance.now();
    const durationMs = duration * 1000;
    let rafId: number | null = null;

    const update = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      const current = startValue + (endValue - startValue) * progress;

      const factor = Math.pow(10, decimals);
      setDisplayValue(Math.round(current * factor) / factor);

      if (progress < 1) {
        rafId = requestAnimationFrame(update);
      }
    };

    rafId = requestAnimationFrame(update);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [isInView, direction, value, duration, decimals]);

  return (
    <motion.span ref={ref} className={className}>
      {displayValue}
    </motion.span>
  );
}
