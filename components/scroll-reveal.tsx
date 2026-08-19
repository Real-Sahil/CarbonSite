'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface ScrollRevealProps {
  children: React.ReactNode;
  direction?: 'up' | 'down' | 'left' | 'right';
  delay?: number;
  duration?: number;
  once?: boolean;
  className?: string;
}

export function ScrollReveal({
  children,
  direction = 'up',
  delay = 0,
  duration = 0.8,
  once = true,
  className = '',
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const directionMap: Record<string, { x: number; y: number }> = {
      up: { x: 0, y: 40 },
      down: { x: 0, y: -40 },
      left: { x: 40, y: 0 },
      right: { x: -40, y: 0 },
    };

    const { x, y } = directionMap[direction];

    gsap.fromTo(
      ref.current,
      {
        opacity: 0,
        x,
        y,
      },
      {
        opacity: 1,
        x: 0,
        y: 0,
        duration,
        delay,
        scrollTrigger: {
          trigger: ref.current,
          start: 'top 80%',
          end: 'top 50%',
          toggleActions: once ? 'play none none none' : 'play reverse play reverse',
        },
      }
    );
  }, [direction, delay, duration, once]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
