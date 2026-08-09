"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[CarbonSite] App error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-6">
      <div className="text-center max-w-md">
        <h1
          className="text-[32px] leading-tight text-[#0F172A] mb-3"
          
        >
          Something went wrong
        </h1>
        <p className="text-sm text-[#555] mb-6 leading-relaxed">
          There was a problem. Please try signing in again.
          {error.digest && (
            <span className="block mt-1 text-xs text-[#888]">
              Reference: <code className="bg-[#f0f0f0] px-1.5 py-0.5 rounded text-[11px]">{error.digest}</code>
            </span>
          )}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-5 py-2.5 bg-[#4F46E5] text-white rounded-lg text-sm font-medium hover:bg-[#0d3514] transition-colors"
          >
            Try again
          </button>
          <a
            href="/sign-in"
            className="px-5 py-2.5 bg-[#EEF2FF] text-[#0F172A] rounded-lg text-sm font-medium hover:bg-[#d0ecce] transition-colors"
          >
            Sign in
          </a>
        </div>
      </div>
    </div>
  );
}
