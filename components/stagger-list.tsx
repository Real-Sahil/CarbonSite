'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface StaggerListProps {
  children: React.ReactNode[];
  staggerDelay?: number;
  className?: string;
  containerClassName?: string;
}

export function StaggerList({
  children,
  staggerDelay = 0.1,
  className = 'space-y-4',
  containerClassName = '',
}: StaggerListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!containerRef.current || itemRefs.current.length === 0) return;

    const items = itemRefs.current.filter((item) => item !== null);

    gsap.fromTo(
      items,
      {
        opacity: 0,
        y: 20,
      },
      {
        opacity: 1,
        y: 0,
        stagger: staggerDelay,
        duration: 0.6,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: containerRef.current,
          start: 'top 75%',
          toggleActions: 'play none none reverse',
        },
      }
    );
  }, [staggerDelay]);

  return (
    <div ref={containerRef} className={`${className} ${containerClassName}`}>
      {children.map((child, i) => (
        <div key={i} ref={(el) => { if (el) itemRefs.current[i] = el; }}>
          {child}
        </div>
      ))}
    </div>
  );
}
