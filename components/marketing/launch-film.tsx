"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Play, Volume2 } from "lucide-react";
import { DemoNote } from "@/components/marketing/kit";
import { POSTER_640 } from "@/components/marketing/launch-film-poster";

// The platform film (videos/, Remotion, src/videos/platform) in the home page hero. It plays muted
// and looping while on screen, from a 720p WebM with an MP4 fallback for
// browsers without VP9. "Play with sound" swaps to the 1080p cut with the
// score and native controls. Visitors who prefer reduced motion see the
// poster until they press play.
const FILM = {
  webm: "/marketing/film/platform-720.webm",
  mp4: "/marketing/film/platform-720.mp4",
  soundWebm: "/marketing/film/platform-1080-sound.webm",
  soundMp4: "/marketing/film/platform-1080-sound.mp4",
  poster: "/marketing/film/platform-poster.jpg",
};
// Widths are claimed, not real: a phone at 1.75x density wants about 720 px, and the 640 px inline cut is close enough that the 960 px file need not be fetched.
const POSTER_SRCSET = `${POSTER_640} 800w, ${FILM.poster} 1280w`;
const POSTER_SIZES = "(min-width: 1024px) 640px, 100vw";

const LABEL =
  "MetricOra platform film: a field receipt photographed and approved, traced from the dashboard total to its calculation, then the reports, assurance pack and the wider modules on screen. Demo data.";

export function LaunchFilm() {
  const ref = useRef<HTMLVideoElement>(null);
  const [withSound, setWithSound] = useState(false);
  const [still, setStill] = useState(false);
  // The film (2 MB) is fetched only once the page has loaded and the browser is
  // idle, so the poster is the largest paint and the video never competes with
  // the CSS and scripts on a slow connection.
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (conn?.saveData) return;
    // Phones keep the poster; the film is 2 MB and "Play with sound" still loads it on request.
    if (!window.matchMedia("(min-width: 768px)").matches) return;
    let cancelled = false;
    const start = () => {
      const run = () => !cancelled && setReady(true);
      if ("requestIdleCallback" in window) window.requestIdleCallback(run, { timeout: 3000 });
      else setTimeout(run, 1500);
    };
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener("load", start);
    };
  }, []);

  useEffect(() => {
    const video = ref.current;
    if (!video || withSound || !ready) return;
    video.load();
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
  }, [withSound, ready]);

  // Swap to the cut with sound and start it inside the click, so the browser
  // counts it as the visitor's own action and allows audio.
  function playWithSound() {
    flushSync(() => setWithSound(true));
    ref.current?.play().catch(() => undefined);
  }

  return (
    <figure className="m-0">
      <div className="relative overflow-hidden rounded-[12px] border border-white/10 bg-mk-ink shadow-[0_24px_60px_-24px_rgba(0,0,0,0.6)]">
        {!withSound ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={FILM.poster}
            srcSet={POSTER_SRCSET}
            sizes={POSTER_SIZES}
            alt=""
            width={1280}
            height={720}
            fetchPriority="high"
            decoding="sync"
            className="block aspect-video h-auto w-full"
          />
        ) : null}
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
            <track kind="captions" />
          </video>
        ) : (
          <video
            key="loop"
            ref={ref}
            className={`absolute inset-0 block h-full w-full transition-opacity duration-300 ${playing ? "opacity-100" : "opacity-0"}`}
            muted
            loop
            playsInline
            preload="none"
            onPlaying={() => setPlaying(true)}
            aria-label={LABEL}
          >
            {ready ? (
              <>
                <source src={FILM.webm} type="video/webm" />
                <source src={FILM.mp4} type="video/mp4" />
              </>
            ) : null}
            <track kind="captions" />
          </video>
        )}
        {!withSound ? (
          <button
            type="button"
            onClick={playWithSound}
            className="absolute bottom-3 right-3 inline-flex items-center gap-2 rounded-full bg-mk-ink/80 px-3.5 py-2 text-[13px] font-medium text-white ring-1 ring-white/15 backdrop-blur transition-colors hover:bg-mk-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-accent-lit"
          >
            {still ? <Play aria-hidden className="h-3.5 w-3.5" /> : <Volume2 aria-hidden className="h-3.5 w-3.5" />}
            Play with sound
          </button>
        ) : null}
      </div>
      <DemoNote tone="dark" />
    </figure>
  );
}
