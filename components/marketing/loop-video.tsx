"use client";

import { useEffect, useRef, useState } from "react";

// A muted, looping product capture. Plays only while on screen, and shows
// the poster frame instead when the visitor prefers reduced motion.
export function LoopVideo({ src, poster, label, className }: { src: string; poster?: string; label?: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [still, setStill] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setStill(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !mq.matches) video.play().catch(() => undefined);
        else video.pause();
      },
      { threshold: 0.15 },
    );
    io.observe(video);
    return () => {
      io.disconnect();
      mq.removeEventListener("change", apply);
    };
  }, []);

  if (still && poster) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={poster} alt={label ?? ""} className={className} />;
  }
  return (
    <video
      ref={ref}
      className={className}
      src={src}
      poster={poster}
      muted
      loop
      playsInline
      preload="metadata"
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
