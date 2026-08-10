"use client";

import { useEffect, useState } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [resetCount, setResetCount] = useState(0);

  useEffect(() => {
    console.error("[CarbonSite] App error:", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      resetCount,
    });

    // If we hit this error more than once, it's likely in the layout bootstrap.
    // After 2 attempts, redirect to sign-in to reset auth state.
    if (resetCount > 1) {
      const timer = setTimeout(() => {
        window.location.href = "/sign-in";
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [error, resetCount]);

  const handleReset = () => {
    setResetCount(prev => prev + 1);
    reset();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-6">
      <div className="text-center max-w-md">
        <h1 className="text-[32px] leading-tight text-[#111827] mb-3">
          Something went wrong
        </h1>
        <p className="text-sm text-[#555] mb-2 leading-relaxed">
          {resetCount > 1
            ? "This error persists. Redirecting to sign in to refresh your session..."
            : "There was an unexpected error. Please try again."}
        </p>
        {error.digest && (
          <p className="text-xs text-[#888] mb-6">
            Reference: <code className="bg-[#f0f0f0] px-1.5 py-0.5 rounded text-[11px]">{error.digest}</code>
          </p>
        )}
        {resetCount <= 1 && (
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleReset}
              className="px-5 py-2.5 bg-[#0EA5E9] text-white rounded-lg text-sm font-medium hover:bg-[#0284C7] transition-colors"
            >
              Try again
            </button>
            <button
              onClick={() => { window.location.href = "/sign-in"; }}
              className="px-5 py-2.5 bg-[#F0F9FF] text-[#111827] rounded-lg text-sm font-medium hover:bg-[#E0F2FE] transition-colors"
            >
              Sign in
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
