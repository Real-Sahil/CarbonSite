"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { acquisitionFromParams, referrerSource, withAcquisition } from "@/lib/marketing/acquisition";

/**
 * Keeps ?ref / utm_* (or the external referrer's host) on internal links so the
 * sign-up form can record where a trial came from. It only rewrites the next
 * URL; nothing is stored in the browser.
 */
export function AcquisitionCarry() {
  const router = useRouter();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (!(a instanceof HTMLAnchorElement) || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href") ?? "";
      if (!href.startsWith("/") || href.startsWith("//") || href.startsWith("/api/")) return;
      const acq = acquisitionFromParams(
        new URLSearchParams(window.location.search),
        referrerSource(document.referrer, window.location.hostname),
      );
      if (!acq) return;
      const next = withAcquisition(href, acq);
      if (next === href) return;
      e.preventDefault();
      router.push(next);
    }
    // Capture phase, so this runs before next/link's own click handler, which
    // skips navigation once the event is default-prevented.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [router]);

  return null;
}
