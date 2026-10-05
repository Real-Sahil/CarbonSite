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
    if (reduce.matches) return;

    let stop: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const lib = await import("@fiddle-digital/string-tune");
      if (cancelled) return;
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
      // Wait for the first frame so elements already on screen are marked in view before anything hides.
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      if (cancelled) {
        st.destroy();
        return;
      }
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
      sweep();
      window.addEventListener("scroll", onScroll, { passive: true });
      document.documentElement.classList.add("st-on");
      stop = () => {
        window.removeEventListener("scroll", onScroll);
        document.documentElement.classList.remove("st-on");
        st.destroy();
      };
    })();

    // Turning reduced motion on mid-visit switches the effects off.
    const onChange = () => {
      if (reduce.matches) stop?.();
    };
    reduce.addEventListener("change", onChange);
    return () => {
      cancelled = true;
      reduce.removeEventListener("change", onChange);
      stop?.();
    };
  }, []);

  return null;
}
