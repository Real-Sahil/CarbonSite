"use client";

// Run results charts load after the page shell, so the numbers and table show first.
import dynamic from "next/dynamic";

const Loading = () => <div aria-hidden="true" className="h-56 w-full animate-pulse rounded-xl bg-slate-100" />;

export const LazyScopeDonut = dynamic(() => import("./scope-donut").then((m) => m.ScopeDonut), { ssr: false, loading: Loading });
export const LazyCategoryBar = dynamic(() => import("./category-bar").then((m) => m.CategoryBar), { ssr: false, loading: Loading });
