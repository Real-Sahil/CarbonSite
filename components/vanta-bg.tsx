'use client';

import { useEffect, useRef } from 'react';
// @ts-ignore
import * as THREE from 'three';

type VantaEffect = any;

export function VantaBg({ children, variant = 'dots' }: { children?: React.ReactNode; variant?: 'dots' | 'waves' | 'net' }) {
  const ref = useRef<HTMLDivElement>(null);
  const vantaEffect = useRef<VantaEffect>(null);

  useEffect(() => {
    if (!ref.current) return;

    const loadVanta = async () => {
      try {
        let VantaModule: any;
        if (variant === 'dots') {
          // @ts-ignore
          const vantaDots = await import('vanta/dist/vanta.dots.min');
          VantaModule = vantaDots.default;
        } else if (variant === 'waves') {
          // @ts-ignore
          const vantaWaves = await import('vanta/dist/vanta.waves.min');
          VantaModule = vantaWaves.default;
        } else {
          // @ts-ignore
          const vantaNet = await import('vanta/dist/vanta.net.min');
          VantaModule = vantaNet.default;
        }

        if (vantaEffect.current) {
          vantaEffect.current.destroy();
        }

        vantaEffect.current = VantaModule({
          el: ref.current,
          THREE,
          mouseControls: true,
          touchControls: true,
          gyroControls: false,
          minHeight: 200.0,
          minWidth: 200.0,
          scale: 1.0,
          scaleMobile: 1.0,
          color: 0x0f172a,
          backgroundColor: 0x0f172a,
          ...(variant === 'dots' && {
            spacing: 20.0,
            showLines: false,
          }),
          ...(variant === 'waves' && {
            waveHeight: 15.0,
            waveSpeed: 1.0,
            waveOpacity: 0.5,
          }),
          ...(variant === 'net' && {
            points: [[0, 0, 0]],
            maxDistance: 20.0,
            spacing: 15.0,
          }),
        });
      } catch (err) {
        console.warn('Vanta effect failed to load:', err);
      }
    };

    loadVanta();

    return () => {
      if (vantaEffect.current) {
        vantaEffect.current.destroy();
      }
    };
  }, [variant]);

  return (
    <div ref={ref} className="relative w-full h-full">
      <div className="relative z-10">{children}</div>
    </div>
  );
}
