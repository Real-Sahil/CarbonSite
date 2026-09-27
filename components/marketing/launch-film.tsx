"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Play, Volume2 } from "lucide-react";

// The launch film (videos/, Remotion) in the home page hero. It plays muted
// and looping while on screen, from a 720p WebM with an MP4 fallback for
// browsers without VP9. "Play with sound" swaps to the 1080p cut with the
// score and native controls. Visitors who prefer reduced motion see the
// poster until they press play.
const FILM = {
  webm: "/marketing/film/launch-720.webm",
  mp4: "/marketing/film/launch-720.mp4",
  soundWebm: "/marketing/film/launch-1080-sound.webm",
  soundMp4: "/marketing/film/launch-1080-sound.mp4",
  poster: "/marketing/film/poster.jpg",
};

const LABEL =
  "MetricOra launch film: a fuel receipt photographed in the field app, approved in review, traced from the dashboard total to its calculation, then the Carbon Reduction Plan, SECR and GHG Protocol reports and the assurance pack. Demo data.";

export function LaunchFilm() {
  const ref = useRef<HTMLVideoElement>(null);
  const [withSound, setWithSound] = useState(false);
  const [still, setStill] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video || withSound) return;
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
  }, [withSound]);

  // Swap to the cut with sound and start it inside the click, so the browser
  // counts it as the visitor's own action and allows audio.
  function playWithSound() {
    flushSync(() => setWithSound(true));
    ref.current?.play().catch(() => undefined);
  }

  return (
    <figure className="m-0">
      <div className="relative overflow-hidden rounded-[12px] border border-white/10 bg-mk-ink shadow-[0_24px_60px_-24px_rgba(0,0,0,0.6)]">
        {withSound ? (
          <video
            key="sound"
            ref={ref}
            className="block aspect-video h-auto w-full"
            poster={FILM.poster}
            controls
            playsInline
            preload="auto"
            aria-label={LABEL}
          >
            <source src={FILM.soundWebm} type="video/webm" />
            <source src={FILM.soundMp4} type="video/mp4" />
          </video>
        ) : (
          <video
            key="loop"
            ref={ref}
            className="block aspect-video h-auto w-full"
            poster={FILM.poster}
            muted
            loop
            playsInline
            autoPlay={!still}
            preload="metadata"
            aria-label={LABEL}
          >
            <source src={FILM.webm} type="video/webm" />
            <source src={FILM.mp4} type="video/mp4" />
          </video>
        )}
        {!withSound ? (
          <button
            type="button"
            onClick={playWithSound}
            className="absolute bottom-3 right-3 inline-flex items-center gap-2 rounded-full bg-mk-ink/80 px-3.5 py-2 text-[13px] font-medium text-mk-on-dark ring-1 ring-white/15 backdrop-blur transition-colors hover:bg-mk-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-accent-lit"
          >
            {still ? <Play aria-hidden className="h-3.5 w-3.5" /> : <Volume2 aria-hidden className="h-3.5 w-3.5" />}
            Play with sound
          </button>
        ) : null}
      </div>
      <figcaption className="mt-3 text-[13px] text-mk-on-dark-3">Launch film, 56 seconds. Figures are demo data.</figcaption>
    </figure>
  );
}
