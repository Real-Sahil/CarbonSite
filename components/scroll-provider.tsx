'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';

export function ScrollProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Reduced motion keeps native scrolling; read once at mount, so a change needs a reload.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      lerp: 0.1,
    });

    // Keep the frame id so the loop stops on unmount; an uncancelled loop kept calling a destroyed instance.
    let frame = 0;
    function raf(time: number) {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    }

    frame = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
