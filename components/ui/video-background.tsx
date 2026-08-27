"use client";

import { useRef, useEffect, useState } from "react";

interface VideoBackgroundProps {
  src: string;
  poster?: string;
  fallbackGradient?: string;
  overlayOpacity?: number;
  className?: string;
}

export function VideoBackground({
  src,
  poster,
  fallbackGradient = "linear-gradient(135deg, #0A1628 0%, #1C1A2E 100%)",
  overlayOpacity = 0.55,
  className,
}: VideoBackgroundProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (reducedMotion) {
      video.pause();
    } else {
      video.play().catch(() => setFailed(true));
    }
  }, [reducedMotion]);

  return (
    <div
      className={`absolute inset-0 overflow-hidden -z-10 ${className ?? ""}`}
      style={failed ? { background: fallbackGradient } : undefined}
    >
      {!failed && (
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          autoPlay={!reducedMotion}
          muted
          loop
          playsInline
          preload="metadata"
          onError={() => setFailed(true)}
          className="w-full h-full object-cover"
          aria-hidden="true"
        />
      )}
      <div
        className="absolute inset-0"
        style={{ background: `rgba(0,0,0,${overlayOpacity})` }}
        aria-hidden="true"
      />
    </div>
  );
}
