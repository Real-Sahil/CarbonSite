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
          className="text-[32px] leading-tight text-[#111827] mb-3"
        >
          Something went wrong
        </h1>
        <p className="text-sm text-[#555] mb-2 leading-relaxed">
          There was a problem loading this page. This is usually a temporary issue.
        </p>
        {error.digest && (
          <p className="text-xs text-[#888] mb-6">
            Reference: <code className="bg-[#f0f0f0] px-1.5 py-0.5 rounded text-[11px]">{error.digest}</code>
          </p>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-5 py-2.5 bg-[#0EA5E9] text-white rounded-lg text-sm font-medium hover:bg-[#0284C7] transition-colors"
          >
            Try again
          </button>
          <button
            onClick={() => { window.location.href = "/"; }}
            className="px-5 py-2.5 bg-[#F0F9FF] text-[#111827] rounded-lg text-sm font-medium hover:bg-[#E0F2FE] transition-colors"
          >
            Go home
          </button>
        </div>
      </div>
    </div>
  );
}
