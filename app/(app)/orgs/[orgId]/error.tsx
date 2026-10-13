"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export default function OrgError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [resetCount, setResetCount] = useState(0);

  useEffect(() => {
    console.error("[MetricOra] Org page error:", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      resetCount,
    });
  }, [error, resetCount]);

  const handleReset = () => {
    setResetCount(prev => prev + 1);
    if (resetCount > 2) {
      // After 3 failed attempts, redirect home instead of looping
      window.location.href = "/";
      return;
    }
    reset();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-6">
      <div className="text-center max-w-md">
        <h1 className="text-[32px] leading-tight text-[#131d29] mb-3">
          Something went wrong
        </h1>
        <p className="text-sm text-[#41505F] mb-2 leading-relaxed">
          There was an unexpected error. Please try refreshing or go back to the home page.
        </p>
        {error.digest && (
          <p className="text-xs text-[#5B6A78] mb-6">
            Reference: <code className="bg-[#F9FAFC] px-1.5 py-0.5 rounded text-[11px]">{error.digest}</code>
          </p>
        )}
        <div className="flex gap-3 justify-center">
          <Button
            onClick={handleReset}
            disabled={resetCount > 2}
            className="px-5 py-2.5"
          >
            {resetCount > 2 ? "Please refresh page" : "Try again"}
          </Button>
          <button
            onClick={() => { window.location.href = "/"; }}
            className="px-5 py-2.5 bg-[#fff7ed] text-[#131d29] rounded-lg text-sm font-medium hover:bg-[#FFEDD5] transition-colors"
          >
            Go home
          </button>
        </div>
      </div>
    </div>
  );
}
