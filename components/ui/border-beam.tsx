'use client';

import { motion } from 'motion/react';
import { ReactNode, CSSProperties } from 'react';

export interface BorderBeamProps {
  className?: string;
  size?: number;
  duration?: number;
  delay?: number;
  borderRadius?: string;
  colorFrom?: string;
  colorTo?: string;
  children?: ReactNode;
}

export function BorderBeam({
  className = '',
  size = 300,
  duration = 15,
  delay = 0,
  borderRadius = '0.5rem',
  colorFrom = 'transparent',
  colorTo = 'rgb(99, 102, 241)',
  children,
}: BorderBeamProps) {
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ borderRadius } as CSSProperties}
    >
      <motion.div
        className="absolute -top-1/2 -right-1/2 -bottom-1/2 -left-1/2"
        style={{
          background: `conic-gradient(from 0deg at 50% 50%, ${colorFrom}, ${colorTo}, ${colorFrom})`,
          width: size,
          height: size,
          pointerEvents: 'none',
        }}
        animate={{
          rotate: [0, 360],
        }}
        transition={{
          duration,
          delay,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
      <div
        className="relative z-10"
        style={{ borderRadius } as CSSProperties}
      >
        {children}
      </div>
    </div>
  );
}
