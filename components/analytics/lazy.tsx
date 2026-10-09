"use client";

// Chart and forecast panels load on demand: each pulls a charting library, and they fetch their own data after mount,
// so nothing is lost by skipping the server render.
import dynamic from "next/dynamic";

const Loading = () => <div aria-hidden="true" className="h-64 w-full animate-pulse rounded-xl bg-slate-100" />;

export const LazyEmissionsByScopeChart = dynamic(() => import("./EmissionsByScopeChart").then((m) => m.EmissionsByScopeChart), { ssr: false, loading: Loading });
export const LazyEmissionsTrendChart = dynamic(() => import("./EmissionsTrendChart").then((m) => m.EmissionsTrendChart), { ssr: false, loading: Loading });
export const LazyFacilityComparisonChart = dynamic(() => import("./FacilityComparisonChart").then((m) => m.FacilityComparisonChart), { ssr: false, loading: Loading });
export const LazyCategoryBreakdownChart = dynamic(() => import("./CategoryBreakdownChart").then((m) => m.CategoryBreakdownChart), { ssr: false, loading: Loading });
export const LazyForecastResults = dynamic(() => import("./forecast-results").then((m) => m.ForecastResults), { ssr: false, loading: Loading });
