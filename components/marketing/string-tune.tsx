"use client";

import { useEffect } from "react";

// Scroll and cursor effects for the marketing pages, from String Tune
// (@fiddle-digital/string-tune, MIT). Pages mark elements with a `string`
// attribute (see kit.tsx); this starts the library once and nothing else.
//
// Native scrolling stays: smooth-scroll replacement would hijack the wheel,
// anchors and keyboard paging. Nothing is hidden until the library is running
// (the `st-on` class on <html> gates every effect in globals.css), so a visitor
// without JavaScript, or one who asks for reduced motion, gets the plain page.

export function StringTuneEffects() {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    // Bumped on every halt, so an import or frame still in flight from an earlier start does nothing.
    let token = 0;
    let starting = false;
    let running: (() => void) | undefined;

    const halt = () => {
      token++;
      starting = false;
      running?.();
      running = undefined;
    };

    const start = async () => {
      const mine = ++token;
      starting = true;
      const lib = await import("@fiddle-digital/string-tune");
      if (mine !== token) return;
      const st = lib.StringTune.getInstance();
      st.scrollDesktopMode = "default";
      st.scrollMobileMode = "default";
      st.use(lib.StringProgress);
      st.use(lib.StringSplit);
      // Pointer effects only where there is a precise pointer to follow.
      if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
        st.use(lib.StringMagnetic);
        st.use(lib.StringTilt);
      }
      st.start(60);
      // An element scrolled past without ever being on screen (a fast jump, an anchor, a reload
      // part-way down) would stay hidden when the visitor scrolls back, so mark it seen.
      let queued = false;
      const sweep = () => {
        queued = false;
        document.querySelectorAll<HTMLElement>('[data-st^="reveal"]:not(.-inview), [string="split"]:not(.-inview)').forEach((el) => {
          if (el.getBoundingClientRect().bottom < 0) el.classList.add("-inview");
        });
      };
      const onScroll = () => {
        if (!queued) {
          queued = true;
          requestAnimationFrame(sweep);
        }
      };
      // Set before the wait so a halt during it tears the library down.
      running = () => {
        window.removeEventListener("scroll", onScroll);
        document.documentElement.classList.remove("st-on");
        st.destroy();
      };
      // Wait for the first frame so elements already on screen are marked in view before anything hides.
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      if (mine !== token) return;
      sweep();
      window.addEventListener("scroll", onScroll, { passive: true });
      document.documentElement.classList.add("st-on");
      starting = false;
    };

    // Reduced motion on at mount or switched on mid-visit halts the effects; switched off starts them again.
    const sync = () => {
      if (reduce.matches) halt();
      else if (!starting && !running) void start();
    };
    // First start waits for the page load and an idle moment, so the library's download and parse
    // never compete with the hero image for the main thread.
    let idle = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      if (typeof window.requestIdleCallback === "function") idle = window.requestIdleCallback(sync, { timeout: 3000 });
      else timer = setTimeout(sync, 1500);
    };
    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });
    reduce.addEventListener("change", sync);
    return () => {
      window.removeEventListener("load", schedule);
      if (idle) window.cancelIdleCallback(idle);
      if (timer) clearTimeout(timer);
      reduce.removeEventListener("change", sync);
      halt();
    };
  }, []);

  return null;
}
