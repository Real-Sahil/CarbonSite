"use client";

import { motion } from "motion/react";
import { usePathname } from "next/navigation";
import React, { useEffect, useLayoutEffect, useRef } from "react";

// Next keeps the old scroll offset when the loading boundary is shorter than the page it replaces,
// so a new page opened part way down. Reset on a new page, except Back/Forward (the browser restores
// its own position) and hash links (Next scrolls to the anchor).
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const shown = useRef<string | null>(null);
  const backTo = useRef<string | null>(null);

  useEffect(() => {
    const onPop = () => {
      backTo.current = window.location.pathname;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Layout effect: runs before paint, and after Next's segment handler (a child), so this reset wins.
  useLayoutEffect(() => {
    const from = shown.current;
    shown.current = pathname;
    const back = backTo.current === pathname;
    backTo.current = null;
    if (from === null || from === pathname || back || window.location.hash) return;
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <motion.div
      key={pathname}
      initial={{ y: 6 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
