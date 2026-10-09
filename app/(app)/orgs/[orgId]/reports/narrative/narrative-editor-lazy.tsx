"use client";

// The rich text editor (Tiptap) is only needed once the page is ready to type into.
import dynamic from "next/dynamic";

export const LazyNarrativeEditor = dynamic(() => import("./narrative-editor").then((m) => m.NarrativeEditor), {
  ssr: false,
  loading: () => <div aria-hidden="true" className="h-72 w-full animate-pulse rounded-xl bg-slate-100" />,
});
