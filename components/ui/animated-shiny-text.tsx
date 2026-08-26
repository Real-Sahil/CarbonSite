'use client';

import { ReactNode } from 'react';
import { motion } from 'motion/react';

export interface AnimatedShinyTextProps {
  children: ReactNode;
  className?: string;
  shimmerWidth?: number;
  shimmerDuration?: number;
}

export function AnimatedShinyText({
  children,
  className = '',
  shimmerWidth = 100,
  shimmerDuration = 3,
}: AnimatedShinyTextProps) {
  return (
    <motion.span
      className={`relative inline-block overflow-hidden ${className}`}
      style={{
        backgroundImage:
          'linear-gradient(90deg, currentColor 0%, currentColor calc(100% - ' +
          shimmerWidth +
          'px), rgba(255,255,255,0.3) 100%)',
        backgroundSize: '200% 100%',
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
      }}
      animate={{
        backgroundPosition: ['200% 0', '-200% 0'],
      }}
      transition={{
        duration: shimmerDuration,
        repeat: Infinity,
        ease: 'linear',
      }}
    >
      {children}
    </motion.span>
  );
}
