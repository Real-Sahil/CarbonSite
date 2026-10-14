'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';

export function ScrollProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Reduced motion keeps native scrolling; the listener starts or stops Lenis when the setting changes.
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    let lenis: Lenis | undefined;

    // Keep the frame id so the loop stops with Lenis; an uncancelled loop kept calling a destroyed instance.
    let frame = 0;
    function raf(time: number) {
      lenis?.raf(time);
      frame = requestAnimationFrame(raf);
    }

    function stop() {
      cancelAnimationFrame(frame);
      lenis?.destroy();
      lenis = undefined;
    }

    function sync() {
      if (query.matches) {
        stop();
        return;
      }
      if (lenis) return;
      lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        lerp: 0.1,
      });
      frame = requestAnimationFrame(raf);
    }

    sync();
    query.addEventListener('change', sync);
    return () => {
      query.removeEventListener('change', sync);
      stop();
    };
  }, []);

  return <>{children}</>;
}
