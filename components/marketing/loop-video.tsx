"use client";

import { useEffect, useRef, useState } from "react";

// A muted, looping product capture. Plays only while on screen, and shows
// the poster frame instead when the visitor prefers reduced motion.
// `decorative` is for blurred section backgrounds: nothing is rendered on the
// server or on narrow screens, so the video never delays the page's largest
// paint or costs a phone the download.
export function LoopVideo({
  src,
  poster,
  label,
  className,
  decorative,
}: {
  src: string;
  poster?: string;
  label?: string;
  className?: string;
  decorative?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [still, setStill] = useState(false);
  const [mounted, setMounted] = useState(!decorative);

  useEffect(() => {
    if (!decorative) return;
    const wide = window.matchMedia("(min-width: 768px)");
    const apply = () => setMounted(wide.matches);
    apply();
    wide.addEventListener("change", apply);
    return () => wide.removeEventListener("change", apply);
  }, [decorative]);

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
  }, [mounted]);

  if (!mounted) return null;
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
