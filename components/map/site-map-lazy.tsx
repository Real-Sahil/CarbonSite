"use client";

// The map (and MapLibre when a style is set) is heavy and only used on this page, so it loads after the shell.
import dynamic from "next/dynamic";

export const LazySiteMap = dynamic(() => import("./site-map").then((m) => m.SiteMap), {
  ssr: false,
  loading: () => <div aria-hidden="true" className="h-[480px] w-full animate-pulse rounded-xl bg-slate-100" />,
});
